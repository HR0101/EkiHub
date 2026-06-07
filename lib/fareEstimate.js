// 運賃概算ロジック
// 経路検索APIが無くても運賃の目安を出せるよう、距離から普通運賃(円)を概算する.
// 値はJR東日本の電車特定区間運賃を参考にした概算であり、実運賃とは異なる.
// 直線距離は実際の線路距離より短いため、呼び出し側で迂回係数を掛けて鉄道kmへ換算してから渡す.

// 鉄道距離(km)と概算運賃(円)の対応表（上限km, 運賃円）
const FARE_TABLE = [
  [3, 150],
  [6, 170],
  [10, 200],
  [15, 240],
  [20, 320],
  [25, 410],
  [30, 480],
  [35, 580],
  [40, 670],
  [45, 770],
  [50, 860],
  [60, 990],
  [70, 1170],
  [80, 1340]
];

// 80kmを超える分の追加運賃(円/10kmあたり)
const EXTRA_FARE_PER_10KM = 200;

// 鉄道距離(km)から概算運賃(円)を返す
export function estimateFareYen(distanceKm) {
  if (typeof distanceKm !== "number" || Number.isNaN(distanceKm) || distanceKm <= 0) {
    return 0;
  }
  for (const [upperKm, fare] of FARE_TABLE) {
    if (distanceKm <= upperKm) return fare;
  }
  // 表の上限(80km)超過分を加算する
  const lastEntry = FARE_TABLE[FARE_TABLE.length - 1];
  const baseKm = lastEntry[0];
  const baseFare = lastEntry[1];
  const extraBlocks = Math.ceil((distanceKm - baseKm) / 10);
  return baseFare + extraBlocks * EXTRA_FARE_PER_10KM;
}
