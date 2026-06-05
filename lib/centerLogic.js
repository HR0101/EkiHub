// 中心駅算出ロジック
// - モードA: 主要駅（ridership >= 閾値 または isMajor=true）のみを候補にする
// - モードB: 規模を問わず全駅を候補にする
//
// 算出は2段階:
//   1) 入力駅群の地理的重心を求める
//   2) 候補駅を「重心からの近さ」と「移動時間の均等さ（公平性）」で複合スコア化し最良駅を選ぶ
//
// 移動時間は外部の経路検索APIが無くても動くよう、駅間直線距離を
// 平均的な鉄道表定速度で割り、乗換ペナルティを加えた推定値を用いる.
// （routeProvider を渡せば、実APIによる所要時間に差し替え可能）

import { MAJOR_RIDERSHIP_THRESHOLD } from "../data/stations.js";

// 地球半径(メートル)
const EARTH_RADIUS_M = 6371000;
// 鉄道のおおよその表定速度(km/h)。各停〜快速混在を想定した概算値
const AVERAGE_TRAIN_SPEED_KMH = 35;
// 乗車前後の徒歩・待ち時間など固定オーバーヘッド(分)
const FIXED_OVERHEAD_MIN = 5;
// 公平性スコアと近接スコアの既定の重み（合計1.0）。時間補正を重視する配分。
// UIの「重視ポイント」スライダーから fairnessWeight を渡して上書きできる。
const DEFAULT_WEIGHT_FAIRNESS = 0.6;

// 公平性の重み(0〜1)を安全な範囲に丸める
function clampWeight(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return DEFAULT_WEIGHT_FAIRNESS;
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

// 入力駅群の地理的重心(緯度経度)を求める
export function calculateCentroid(originStations) {
  if (!Array.isArray(originStations) || originStations.length === 0) {
    throw new Error("重心計算には1つ以上の入力駅が必要です.");
  }
  let sumLat = 0;
  let sumLng = 0;
  for (const station of originStations) {
    sumLat += station.lat;
    sumLng += station.lng;
  }
  return {
    lat: sumLat / originStations.length,
    lng: sumLng / originStations.length
  };
}

// 直線距離(メートル)から推定所要時間(分)を求める（経路API非利用時のフォールバック）
export function estimateTravelMinutes(distanceMeters) {
  const distanceKm = distanceMeters / 1000;
  const ridingMinutes = (distanceKm / AVERAGE_TRAIN_SPEED_KMH) * 60;
  return ridingMinutes + FIXED_OVERHEAD_MIN;
}

// モードに応じて候補駅を絞り込む
// mode: "A" = 主要駅限定 / "B" = 規模不問
export function filterCandidates(allStations, mode) {
  if (mode === "A") {
    return allStations.filter(
      (s) => s.isMajor === true || s.ridership >= MAJOR_RIDERSHIP_THRESHOLD
    );
  }
  return allStations.slice();
}

// 配列の標準偏差を返す（公平性の指標として利用）
function standardDeviation(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / values.length;
  return Math.sqrt(variance);
}

// 0〜1へ正規化する（最小=最良=1.0、最大=最悪=0.0となるよう反転）
function normalizeInverted(value, min, max) {
  if (max === min) return 1; // 全候補が同値なら差を付けない
  return 1 - (value - min) / (max - min);
}

// 候補駅ごとに、各入力駅からの所要時間を算出する
// routeProvider(originStation, candidateStation) -> 所要時間(分) を返す関数があれば優先利用
async function buildCandidateMetrics(candidate, originStations, centroid, routeProvider) {
  const travelTimes = [];
  for (const origin of originStations) {
    let minutes;
    if (typeof routeProvider === "function") {
      try {
        minutes = await routeProvider(origin, candidate);
      } catch (error) {
        // 経路API失敗時は推定値へフォールバックする
        minutes = null;
      }
    }
    if (minutes === null || minutes === undefined || Number.isNaN(minutes)) {
      const distance = haversineDistance(origin.lat, origin.lng, candidate.lat, candidate.lng);
      minutes = estimateTravelMinutes(distance);
    }
    travelTimes.push({ from: origin.name, minutes: Math.round(minutes) });
  }
  const minutesOnly = travelTimes.map((t) => t.minutes);
  const totalMinutes = minutesOnly.reduce((acc, v) => acc + v, 0);
  const distanceToCentroid = haversineDistance(centroid.lat, centroid.lng, candidate.lat, candidate.lng);
  return {
    station: candidate,
    travelTimes,
    totalMinutes,
    averageMinutes: Math.round(totalMinutes / originStations.length),
    fairness: standardDeviation(minutesOnly), // 小さいほど全員が均等
    distanceToCentroid // 小さいほど地理的中心に近い
  };
}

// メイン関数: 入力駅群と全駅・モードから中心駅候補を算出する
// 戻り値: { centroid, best, ranking, mode, candidateCount }
export async function computeCenterStation({
  originStations,
  allStations,
  mode = "B",
  routeProvider = null,
  topN = 5,
  fairnessWeight = DEFAULT_WEIGHT_FAIRNESS
}) {
  // 「公平さ重視 ⇄ 近さ重視」の配分（合計1.0）
  const weightFairness = clampWeight(fairnessWeight);
  const weightProximity = 1 - weightFairness;
  if (!Array.isArray(originStations) || originStations.length < 2) {
    throw new Error("中心駅の算出には2駅以上の入力が必要です.");
  }

  const centroid = calculateCentroid(originStations);
  const candidates = filterCandidates(allStations, mode);
  if (candidates.length === 0) {
    throw new Error("選択したモードに合致する候補駅がありません.");
  }

  // 入力駅そのものは集合場所として不適切なので候補から除外する
  const originNames = new Set(originStations.map((s) => s.name));
  const usableCandidates = candidates.filter((c) => !originNames.has(c.name));
  const effectiveCandidates = usableCandidates.length > 0 ? usableCandidates : candidates;

  // 各候補のメトリクスを算出
  const metrics = [];
  for (const candidate of effectiveCandidates) {
    const m = await buildCandidateMetrics(candidate, originStations, centroid, routeProvider);
    metrics.push(m);
  }

  // 正規化のための最小・最大を取得
  const fairnessValues = metrics.map((m) => m.fairness);
  const proximityValues = metrics.map((m) => m.distanceToCentroid);
  const minFairness = Math.min(...fairnessValues);
  const maxFairness = Math.max(...fairnessValues);
  const minProximity = Math.min(...proximityValues);
  const maxProximity = Math.max(...proximityValues);

  // 複合スコア（高いほど良い）を付与する
  for (const m of metrics) {
    const fairnessScore = normalizeInverted(m.fairness, minFairness, maxFairness);
    const proximityScore = normalizeInverted(m.distanceToCentroid, minProximity, maxProximity);
    m.fairnessScore = fairnessScore;
    m.proximityScore = proximityScore;
    m.score = weightFairness * fairnessScore + weightProximity * proximityScore;
  }

  // スコア降順で並べ替え
  metrics.sort((a, b) => b.score - a.score);

  const ranking = metrics.slice(0, topN).map((m) => ({
    name: m.station.name,
    kana: m.station.kana,
    lat: m.station.lat,
    lng: m.station.lng,
    lines: m.station.lines,
    ridership: m.station.ridership,
    isMajor: m.station.isMajor,
    averageMinutes: m.averageMinutes,
    totalMinutes: m.totalMinutes,
    fairness: Math.round(m.fairness * 10) / 10,
    distanceToCentroidKm: Math.round((m.distanceToCentroid / 1000) * 10) / 10,
    score: Math.round(m.score * 1000) / 1000,
    travelTimes: m.travelTimes
  }));

  return {
    centroid,
    best: ranking[0],
    ranking,
    mode,
    candidateCount: effectiveCandidates.length
  };
}
