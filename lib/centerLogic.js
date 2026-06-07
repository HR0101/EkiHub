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

import { MAJOR_RIDERSHIP_THRESHOLD } from "../data/stations.js";
import { estimateFareYen } from "./fareEstimate.js";

// 地球半径(メートル)
const EARTH_RADIUS_M = 6371000;
// 鉄道のおおよその表定速度(km/h)。各停〜快速混在を想定した概算値
const AVERAGE_TRAIN_SPEED_KMH = 35;
// 乗車前後の徒歩・待ち時間など固定オーバーヘッド(分)
const FIXED_OVERHEAD_MIN = 5;
// 直線距離→鉄道距離の迂回係数（運賃の概算に用いる）
const RAIL_DETOUR_FACTOR = 1.3;
// 公平性スコアと近接スコアの既定の重み（合計1.0）。時間補正を重視する配分。
const DEFAULT_WEIGHT_FAIRNESS = 0.6;

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

// 2駅が同一路線を共有するか（直通の可能性の概算）
function sharesLine(a, b) {
  const linesA = Array.isArray(a.lines) ? a.lines : [];
  const linesB = Array.isArray(b.lines) ? b.lines : [];
  if (linesA.length === 0 || linesB.length === 0) return false;
  const setB = new Set(linesB);
  return linesA.some((line) => setB.has(line));
}

// 候補駅ごとに、各入力駅からの所要時間・運賃・直通可能性・乗換回数を算出する
// routeProvider があれば実経路の {minutes, fareYen, transfers} で上書きする.
// 取得できない項目は距離からの概算へフォールバックする.
async function buildCandidateMetrics(candidate, originStations, centroid, routeProvider) {
  const travelTimes = [];
  let routedAny = false; // この候補で実経路データを1件でも使ったか
  for (const origin of originStations) {
    const distance = haversineDistance(origin.lat, origin.lng, candidate.lat, candidate.lng);

    // 既定は距離からの概算
    let minutes = estimateTravelMinutes(distance);
    let fareYen = estimateFareYen((distance / 1000) * RAIL_DETOUR_FACTOR);
    let transfers = null; // 概算では乗換回数は不明
    let routed = false;

    // 経路プロバイダがあれば実データで上書き
    if (typeof routeProvider === "function") {
      try {
        const r = await routeProvider(origin, candidate);
        if (r) {
          if (typeof r.minutes === "number" && !Number.isNaN(r.minutes)) {
            minutes = r.minutes;
            routed = true;
          }
          if (typeof r.fareYen === "number" && !Number.isNaN(r.fareYen)) {
            fareYen = r.fareYen;
            routed = true;
          }
          if (typeof r.transfers === "number" && !Number.isNaN(r.transfers)) {
            transfers = r.transfers;
          }
        }
      } catch (error) {
        // 失敗時は概算のまま継続
      }
    }
    if (routed) routedAny = true;

    travelTimes.push({
      from: origin.name,
      minutes: Math.round(minutes),
      fareYen: Math.round(fareYen),
      transfers,
      people: stationPeople(origin),
      directPossible: sharesLine(origin, candidate),
      routed
    });
  }

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

// メトリクス集合へ複合スコアを正規化付きで付与する（集合内で相対評価）
// 「近さ」は重心距離ではなく実際の平均所要時間で評価する。
// こうすることで経路APIで所要時間が正確になると順位へ直接反映される。
function scoreMetrics(metrics, weightFairness, weightProximity, wFare) {
  if (metrics.length === 0) return;
  const fairnessValues = metrics.map((m) => m.fairness);
  const proximityValues = metrics.map((m) => m.averageMinutes);
  const fareValues = metrics.map((m) => m.averageFareYen);
  const minFairness = Math.min(...fairnessValues);
  const maxFairness = Math.max(...fairnessValues);
  const minProximity = Math.min(...proximityValues);
  const maxProximity = Math.max(...proximityValues);
  const minFare = Math.min(...fareValues);
  const maxFare = Math.max(...fareValues);

  for (const m of metrics) {
    const fairnessScore = normalizeInverted(m.fairness, minFairness, maxFairness);
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
    travelTimes: m.travelTimes
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
  const fairRatio = clampWeight(fairnessWeight, DEFAULT_WEIGHT_FAIRNESS);
  const weightFairness = (1 - wFare) * fairRatio;
  const weightProximity = (1 - wFare) * (1 - fairRatio);

  const centroid = calculateCentroid(originStations);
  const candidates = filterCandidates(allStations, mode);
  if (candidates.length === 0) {
    throw new Error("選択したモードに合致する候補駅がありません.");
  }

  // 入力駅そのものは集合場所として不適切なので候補から除外する
  const originNames = new Set(originStations.map((s) => s.name));
  const usableCandidates = candidates.filter((c) => !originNames.has(c.name));
  const effectiveCandidates = usableCandidates.length > 0 ? usableCandidates : candidates;

  // ── 第1段階: 距離からの概算で全候補を評価し、上位を絞り込む ──
  // （最大約2000駅を経路APIで叩くのは非現実的なため、まず安価な概算で粗選別する）
  const heuristic = [];
  for (const candidate of effectiveCandidates) {
    heuristic.push(await buildCandidateMetrics(candidate, originStations, centroid, null));
  }
  scoreMetrics(heuristic, weightFairness, weightProximity, wFare);
  heuristic.sort((a, b) => b.score - a.score);

  // ── 第2段階: 経路APIがあれば finalists のみ実データで精緻化して再評価 ──
  let finalMetrics = heuristic;
  let routingRefined = false;
  if (typeof routeProvider === "function" && refineCount > 0) {
    const finalists = heuristic.slice(0, Math.max(topN, refineCount));
    const refined = [];
    for (const m of finalists) {
      refined.push(await buildCandidateMetrics(m.station, originStations, centroid, routeProvider));
    }
    routingRefined = refined.some((m) => m.routed);
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
    routingRefined,
    weights: {
      fairness: Math.round(weightFairness * 100) / 100,
      proximity: Math.round(weightProximity * 100) / 100,
      fare: Math.round(wFare * 100) / 100
    }
  };
}
