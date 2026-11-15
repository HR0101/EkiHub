// 中心駅算出ロジック
// - モードA: 主要駅（ridership >= 閾値 または isMajor=true）のみを候補にする
// - モードB: 規模を問わず全駅を候補にする
//
// 算出の流れ:
//   1) 入力駅群の（人数で重み付けした）地理的重心を求める
//   2) 候補駅ごとに 各メンバーの所要時間・運賃・直通可能性 を算出
//   3) 「近さ」「時間の公平性」「運賃」の複合スコアで最良駅を選ぶ
//
// 移動時間・運賃は外部APIが無くても動くよう距離からの概算を用いる.
// （routeProvider を渡せば、実APIによる所要時間に差し替え可能）

const MAJOR_RIDERSHIP_THRESHOLD = 200000;
import { estimateFareYen } from "./fareEstimate.js";
import { getOrBuildGraph, shortestFrom } from "./stationGraph.js";

// 地球半径(メートル)
const EARTH_RADIUS_M = 6371000;
// 鉄道のおおよその表定速度(km/h)。各停〜快速混在を想定した概算値
const AVERAGE_TRAIN_SPEED_KMH = 35;
// 乗車前後の徒歩・待ち時間など固定オーバーヘッド(分)
const FIXED_OVERHEAD_MIN = 5;
// 直線距離→鉄道距離の迂回係数（直線概算フォールバック時の運賃に用いる）
const RAIL_DETOUR_FACTOR = 1.3;
// グラフ経路距離→鉄道距離の迂回係数（駅間を直線で結んだ累積距離は実線形よりやや短いため補正）
const GRAPH_FARE_DETOUR = 1.15;
// 公平性スコアと近接スコアの既定の重み（合計1.0）。時間補正を重視する配分。
const DEFAULT_WEIGHT_FAIRNESS = 0.6;
// スライダーを「近さ最優先」にしても確保する最低限の公平さ比率。
// 0にすると極端な偏りが起きやすいため下限を設ける。
const MIN_FAIRNESS_RATIO = 0.15;
// 近距離の入力で、遠方なのに所要時間差だけが小さい駅を候補から外すための最低半径。
const MIN_CANDIDATE_RADIUS_M = 20000;
// 入力駅同士が離れている場合は、重心から各入力駅までの距離に応じて候補半径を広げる。
const CANDIDATE_RADIUS_ORIGIN_MULTIPLIER = 1.6;
const CANDIDATE_RADIUS_BUFFER_M = 5000;
// 所要時間の標準偏差がこの範囲なら十分公平とみなし、相対評価の過剰減点を避ける。
const FAIRNESS_STD_FULL_SCORE_MIN = 5;
// これ以上ばらつく候補は公平性スコアを0にする。
const FAIRNESS_STD_ZERO_SCORE_MIN = 30;

// 重み(0〜1)を安全な範囲に丸める
function clampWeight(value, fallback) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

// 度をラジアンに変換する
function toRadians(degree) {
  return (degree * Math.PI) / 180;
}

// 2地点間のハバーサイン距離(メートル)を返す
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

// 入力駅群の地理的重心(緯度経度)を求める（人数で重み付け可能）
export function calculateCentroid(originStations) {
  if (!Array.isArray(originStations) || originStations.length === 0) {
    throw new Error("重心計算には1つ以上の入力駅が必要です.");
  }
  let sumLat = 0;
  let sumLng = 0;
  let sumWeight = 0;
  for (const station of originStations) {
    const w = stationPeople(station);
    sumLat += station.lat * w;
    sumLng += station.lng * w;
    sumWeight += w;
  }
  return {
    lat: sumLat / sumWeight,
    lng: sumLng / sumWeight
  };
}

// 駅に紐づく人数（重み）を返す。未指定は1人.
function stationPeople(station) {
  const p = Number(station.people);
  return Number.isFinite(p) && p > 0 ? p : 1;
}

// 直線距離(メートル)から推定所要時間(分)を求める（経路API非利用時のフォールバック）
export function estimateTravelMinutes(distanceMeters) {
  const distanceKm = distanceMeters / 1000;
  const ridingMinutes = (distanceKm / AVERAGE_TRAIN_SPEED_KMH) * 60;
  return ridingMinutes + FIXED_OVERHEAD_MIN;
}

// モードに応じて候補駅を絞り込む
export function filterCandidates(allStations, mode) {
  if (mode === "A") {
    return allStations.filter(
      (s) => s.isMajor === true || s.ridership >= MAJOR_RIDERSHIP_THRESHOLD
    );
  }
  return allStations.slice();
}

// 入力駅の広がりに応じた候補探索半径を返す。
function calculateCandidateRadius(originStations, centroid) {
  const originDistances = originStations.map((origin) =>
    haversineDistance(centroid.lat, centroid.lng, origin.lat, origin.lng)
  );
  const maxOriginDistance = Math.max(...originDistances);
  return Math.max(
    MIN_CANDIDATE_RADIUS_M,
    maxOriginDistance * CANDIDATE_RADIUS_ORIGIN_MULTIPLIER + CANDIDATE_RADIUS_BUFFER_M
  );
}

// 入力駅そのものを除外しつつ、重心から遠すぎる候補駅を足切りする。
function filterUsableCandidates(candidates, originNames, centroid, radiusMeters) {
  const nonOriginCandidates = candidates.filter((c) => !originNames.has(c.name));
  const nearbyCandidates = nonOriginCandidates.filter((c) => {
    const distance = haversineDistance(centroid.lat, centroid.lng, c.lat, c.lng);
    return distance <= radiusMeters;
  });

  // 候補が空になる地域やデータ不足時は従来通りの候補集合へフォールバックする。
  if (nearbyCandidates.length > 0) return nearbyCandidates;
  if (nonOriginCandidates.length > 0) return nonOriginCandidates;
  return candidates;
}

// 重み付き平均を返す
function weightedMean(values, weights) {
  let sum = 0;
  let wsum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i] * weights[i];
    wsum += weights[i];
  }
  return wsum === 0 ? 0 : sum / wsum;
}

// 重み付き標準偏差を返す（公平性の指標。小さいほど均等）
function weightedStd(values, weights) {
  if (values.length === 0) return 0;
  const mean = weightedMean(values, weights);
  let variance = 0;
  let wsum = 0;
  for (let i = 0; i < values.length; i++) {
    variance += weights[i] * (values[i] - mean) * (values[i] - mean);
    wsum += weights[i];
  }
  return wsum === 0 ? 0 : Math.sqrt(variance / wsum);
}

// 0〜1へ正規化する（最小=最良=1.0、最大=最悪=0.0となるよう反転）
function normalizeInverted(value, min, max) {
  if (max === min) return 1;
  return 1 - (value - min) / (max - min);
}

// 公平性は候補集合内の相対順位ではなく、分単位の絶対基準で評価する。
function scoreFairnessAbsolute(fairnessStdMinutes) {
  if (fairnessStdMinutes <= FAIRNESS_STD_FULL_SCORE_MIN) return 1;
  if (fairnessStdMinutes >= FAIRNESS_STD_ZERO_SCORE_MIN) return 0;
  return (
    1 -
    (fairnessStdMinutes - FAIRNESS_STD_FULL_SCORE_MIN) /
      (FAIRNESS_STD_ZERO_SCORE_MIN - FAIRNESS_STD_FULL_SCORE_MIN)
  );
}

// 2駅が同一路線を共有するか（直通の可能性の概算）
function sharesLine(a, b) {
  const linesA = Array.isArray(a.lines) ? a.lines : [];
  const linesB = Array.isArray(b.lines) ? b.lines : [];
  if (linesA.length === 0 || linesB.length === 0) return false;
  const setB = new Set(linesB);
  return linesA.some((line) => setB.has(line));
}

// travelTimes(各メンバーの所要・運賃・乗換)から候補駅の集計メトリクスを組み立てる.
// グラフ経路・直線概算・OTP精緻化のいずれの経路でも共通で使う最終整形処理.
function finalizeMetrics(candidate, travelTimes, centroid, routedAny) {
  const weights = travelTimes.map((t) => t.people);
  const minutesOnly = travelTimes.map((t) => t.minutes);
  const fares = travelTimes.map((t) => t.fareYen);
  const totalPeople = weights.reduce((a, b) => a + b, 0);
  // 乗換回数は取得できたメンバーのみで平均する
  const transferVals = travelTimes.map((t) => t.transfers).filter((v) => typeof v === "number");
  const averageTransfers =
    transferVals.length > 0
      ? Math.round((transferVals.reduce((a, b) => a + b, 0) / transferVals.length) * 10) / 10
      : null;

  const distanceToCentroid = haversineDistance(
    centroid.lat,
    centroid.lng,
    candidate.lat,
    candidate.lng
  );

  return {
    station: candidate,
    travelTimes,
    totalMinutes: minutesOnly.reduce((a, b) => a + b, 0),
    averageMinutes: Math.round(weightedMean(minutesOnly, weights)),
    minMinutes: Math.min(...minutesOnly),
    maxMinutes: Math.max(...minutesOnly),
    fairness: weightedStd(minutesOnly, weights), // 小さいほど全員が均等
    averageFareYen: Math.round(weightedMean(fares, weights)),
    totalFareYen: fares.reduce((acc, f, i) => acc + f * weights[i], 0), // 人数込みの総額
    averageTransfers,
    directCount: travelTimes.filter((t) => t.directPossible).length,
    routed: routedAny,
    totalPeople,
    distanceToCentroid
  };
}

// 候補駅メトリクスを「駅ネットワークの最短経路」から構築する.
// originDistances[k] = { origin, minutes:number[], meters:number[] }（originStationsと同順・index一致）.
// いずれかの始点から到達不能な駅は集合場所として不適切なので null を返す.
function buildMetricsFromGraph(candidate, candidateIndex, originStations, originDistances, centroid) {
  const travelTimes = [];
  for (let k = 0; k < originStations.length; k++) {
    const origin = originStations[k];
    const minutes = originDistances[k].minutes[candidateIndex];
    const meters = originDistances[k].meters[candidateIndex];
    // 全員が到達できる駅のみを候補として残す（島嶼や孤立駅を除外）
    if (!Number.isFinite(minutes)) return null;
    const fareYen = estimateFareYen((meters / 1000) * GRAPH_FARE_DETOUR);
    travelTimes.push({
      from: origin.name,
      minutes: Math.round(minutes),
      meters,
      fareYen: Math.round(fareYen),
      transfers: null, // 概算ネットワークでは乗換回数は不明
      people: stationPeople(origin),
      directPossible: sharesLine(origin, candidate),
      routed: false
    });
  }
  return finalizeMetrics(candidate, travelTimes, centroid, false);
}

// 候補駅メトリクスを「直線距離からの概算」で構築する（グラフが使えない場合のフォールバック）.
function buildStraightMetrics(candidate, originStations, centroid) {
  const travelTimes = originStations.map((origin) => {
    const distance = haversineDistance(origin.lat, origin.lng, candidate.lat, candidate.lng);
    return {
      from: origin.name,
      minutes: Math.round(estimateTravelMinutes(distance)),
      meters: distance,
      fareYen: Math.round(estimateFareYen((distance / 1000) * RAIL_DETOUR_FACTOR)),
      transfers: null,
      people: stationPeople(origin),
      directPossible: sharesLine(origin, candidate),
      routed: false
    };
  });
  return finalizeMetrics(candidate, travelTimes, centroid, false);
}

// 既存メトリクス(グラフ概算)を土台に、経路プロバイダ(OTP等)の実データで上書きして精緻化する.
// 取得できない項目はグラフ概算値のまま維持する.
async function refineWithProvider(metric, originStations, centroid, routeProvider) {
  const candidate = metric.station;
  const travelTimes = [];
  let routedAny = false; // この候補で実経路データを1件でも使ったか
  for (let k = 0; k < originStations.length; k++) {
    const origin = originStations[k];
    const base = metric.travelTimes[k]; // グラフ概算の値
    let minutes = base.minutes;
    let fareYen = base.fareYen;
    let transfers = base.transfers;
    let routed = false;

    try {
      const r = await routeProvider(origin, candidate);
      if (r) {
        if (typeof r.minutes === "number" && !Number.isNaN(r.minutes)) {
          minutes = Math.round(r.minutes);
          routed = true;
        }
        if (typeof r.fareYen === "number" && !Number.isNaN(r.fareYen)) {
          fareYen = Math.round(r.fareYen);
          routed = true;
        }
        if (typeof r.transfers === "number" && !Number.isNaN(r.transfers)) {
          transfers = r.transfers;
        }
      }
    } catch {
      // 失敗時はグラフ概算のまま継続
    }
    if (routed) routedAny = true;

    travelTimes.push({
      from: origin.name,
      minutes,
      meters: base.meters,
      fareYen,
      transfers,
      people: base.people,
      directPossible: base.directPossible,
      routed
    });
  }
  return finalizeMetrics(candidate, travelTimes, centroid, routedAny);
}

// メトリクス集合へ複合スコアを正規化付きで付与する（集合内で相対評価）
// 「近さ」は重心距離ではなく実際の平均所要時間で評価する。
// こうすることで経路APIで所要時間が正確になると順位へ直接反映される。
function scoreMetrics(metrics, weightFairness, weightProximity, wFare) {
  if (metrics.length === 0) return;
  const proximityValues = metrics.map((m) => m.averageMinutes);
  const fareValues = metrics.map((m) => m.averageFareYen);
  const minProximity = Math.min(...proximityValues);
  const maxProximity = Math.max(...proximityValues);
  const minFare = Math.min(...fareValues);
  const maxFare = Math.max(...fareValues);

  for (const m of metrics) {
    const fairnessScore = scoreFairnessAbsolute(m.fairness);
    const proximityScore = normalizeInverted(m.averageMinutes, minProximity, maxProximity);
    const fareScore = normalizeInverted(m.averageFareYen, minFare, maxFare);
    m.fairnessScore = fairnessScore;
    m.proximityScore = proximityScore;
    m.fareScore = fareScore;
    m.score = weightFairness * fairnessScore + weightProximity * proximityScore + wFare * fareScore;
  }
}

// メトリクスをランキング表示用オブジェクトへ変換する
function toRankingEntry(m) {
  return {
    name: m.station.name,
    kana: m.station.kana,
    lat: m.station.lat,
    lng: m.station.lng,
    lines: m.station.lines,
    ridership: m.station.ridership,
    isMajor: m.station.isMajor,
    averageMinutes: m.averageMinutes,
    totalMinutes: m.totalMinutes,
    minMinutes: m.minMinutes,
    maxMinutes: m.maxMinutes,
    fairness: Math.round(m.fairness * 10) / 10,
    averageFareYen: m.averageFareYen,
    totalFareYen: Math.round(m.totalFareYen),
    averageTransfers: m.averageTransfers,
    directCount: m.directCount,
    routed: Boolean(m.routed),
    distanceToCentroidKm: Math.round((m.distanceToCentroid / 1000) * 10) / 10,
    score: Math.round(m.score * 1000) / 1000,
    // 内部用の meters を除いた公開フィールドのみ返す
    travelTimes: m.travelTimes.map((t) => ({
      from: t.from,
      minutes: t.minutes,
      fareYen: t.fareYen,
      transfers: t.transfers,
      people: t.people,
      directPossible: t.directPossible,
      routed: t.routed
    }))
  };
}

// メイン関数: 入力駅群と全駅・モードから中心駅候補を算出する
export async function computeCenterStation({
  originStations,
  allStations,
  mode = "B",
  routeProvider = null,
  topN = 5,
  fairnessWeight = DEFAULT_WEIGHT_FAIRNESS,
  fareWeight = 0,
  refineCount = 8
}) {
  if (!Array.isArray(originStations) || originStations.length < 2) {
    throw new Error("中心駅の算出には2駅以上の入力が必要です.");
  }

  // 運賃の重み(0〜0.8)。残りを「公平さ:近さ」のスライダー比で配分する.
  const wFare = clampWeight(fareWeight, 0) * 0.8;
  // スライダー値を最低限の公平さ比率で下限クランプ（極端な片寄りを防ぐ）
  const fairRatio = Math.max(MIN_FAIRNESS_RATIO, clampWeight(fairnessWeight, DEFAULT_WEIGHT_FAIRNESS));
  const weightFairness = (1 - wFare) * fairRatio;
  const weightProximity = (1 - wFare) * (1 - fairRatio);

  // 重心は地図表示・参考指標として算出する（中心駅の選定には用いない）.
  const centroid = calculateCentroid(originStations);
  const candidates = filterCandidates(allStations, mode);
  if (candidates.length === 0) {
    throw new Error("選択したモードに合致する候補駅がありません.");
  }

  // 入力駅そのものは集合場所として不適切なので候補から除外する。
  // さらに重心から遠すぎる候補を足切りし、公平性だけで遠方駅が勝つのを防ぐ。
  const originNames = new Set(originStations.map((s) => s.name));
  const candidateRadiusMeters = calculateCandidateRadius(originStations, centroid);
  const effectiveCandidates = filterUsableCandidates(
    candidates,
    originNames,
    centroid,
    candidateRadiusMeters
  );

  // ── 駅ネットワークを構築し、各始点から全駅への最短経路を求める ──
  // 海上に線路は無いため、重心が海上に出ても海を渡る経路は生まれない（海上重心問題の根治）.
  const graph = getOrBuildGraph(allStations);
  const originDistances = originStations.map((origin) => {
    const index = graph.indexByName.has(origin.name) ? graph.indexByName.get(origin.name) : -1;
    const { minutes, meters } = shortestFrom(graph, index);
    return { origin, minutes, meters, index };
  });
  // 全始点がグラフ上に存在する場合のみネットワーク経路を使える
  const graphUsable = originDistances.every((d) => d.index >= 0);

  // ── 第1段階: 全候補をネットワーク経路で評価する ──
  let metrics = [];
  let routingMethod = "graph"; // graph(ネットワーク概算) / straight(直線概算) / otp(実経路)
  if (graphUsable) {
    for (const candidate of effectiveCandidates) {
      const index = graph.indexByName.get(candidate.name);
      if (index === undefined) continue;
      const m = buildMetricsFromGraph(candidate, index, originStations, originDistances, centroid);
      if (m) metrics.push(m); // 全員が到達できる駅のみ
    }
  }
  // グラフが使えない/全候補が到達不能だった場合は直線概算へフォールバック
  if (metrics.length === 0) {
    routingMethod = "straight";
    metrics = effectiveCandidates.map((c) => buildStraightMetrics(c, originStations, centroid));
  }
  scoreMetrics(metrics, weightFairness, weightProximity, wFare);
  metrics.sort((a, b) => b.score - a.score);

  // ── 第2段階: 経路API(OTP等)があれば finalists のみ実データで精緻化して再評価 ──
  let finalMetrics = metrics;
  if (typeof routeProvider === "function" && refineCount > 0 && routingMethod !== "straight") {
    const finalists = metrics.slice(0, Math.max(topN, refineCount));
    const refined = [];
    for (const m of finalists) {
      refined.push(await refineWithProvider(m, originStations, centroid, routeProvider));
    }
    if (refined.some((m) => m.routed)) routingMethod = "otp";
    // finalists集合内で相対スコアを再計算し並べ替える
    scoreMetrics(refined, weightFairness, weightProximity, wFare);
    refined.sort((a, b) => b.score - a.score);
    finalMetrics = refined;
  }

  const ranking = finalMetrics.slice(0, topN).map(toRankingEntry);

  return {
    centroid,
    best: ranking[0],
    ranking,
    mode,
    candidateCount: effectiveCandidates.length,
    candidateRadiusKm: Math.round((candidateRadiusMeters / 1000) * 10) / 10,
    routingMethod,
    routingRefined: routingMethod === "otp", // 後方互換（実経路で精緻化したか）
    weights: {
      fairness: Math.round(weightFairness * 100) / 100,
      proximity: Math.round(weightProximity * 100) / 100,
      fare: Math.round(wFare * 100) / 100
    }
  };
}
