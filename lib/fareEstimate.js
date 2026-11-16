// 運賃概算ロジック
// 経路検索APIが無くても運賃の目安を出せるよう、距離から普通運賃(円)を概算する.
// 値はJR東日本の2026年3月14日改定後の「幹線」IC運賃(1円単位)であり、実運賃とは異なる.
//   - 改定で「山手線内」「電車特定区間」は廃止され、幹線運賃に統合された.
//   - 私鉄・地下鉄への乗り継ぎ(初乗りの二重加算)や、JR他社の運賃は反映しない.
// 呼び出し側で迂回係数を掛けて鉄道の営業キロ相当へ換算してから渡す.

// 営業キロ(km)とIC運賃(円)の対応表（区間の上限km, 運賃円）
const FARE_TABLE = [
  [3, 155],
  [6, 199],
  [10, 209],
  [15, 253],
  [20, 341],
  [25, 440],
  [30, 528],
  [35, 616],
  [40, 715],
  [45, 803],
  [50, 902],
  [60, 1034],
  [70, 1221],
  [80, 1408],
  [90, 1595],
  [100, 1782],
  [120, 2090],
  [140, 2420],
  [160, 2750]
];

// 表の上限(160km)を超える区間の刻み幅(km)と、1刻みあたりの加算額(円).
// 120〜160kmの刻み(20kmごとに330円)をそのまま延長した概算値.
const EXTRA_BLOCK_KM = 20;
const EXTRA_FARE_PER_BLOCK = 330;

// 鉄道距離(km)から概算運賃(円)を返す
export function estimateFareYen(distanceKm) {
  if (typeof distanceKm !== "number" || Number.isNaN(distanceKm) || distanceKm <= 0) {
    return 0;
  }
  // 営業キロは1km未満を切り上げて運賃区間を決める
  const fareKm = Math.ceil(distanceKm);
  for (const [upperKm, fare] of FARE_TABLE) {
    if (fareKm <= upperKm) return fare;
  }
  // 表の上限超過分を加算する
  const [baseKm, baseFare] = FARE_TABLE[FARE_TABLE.length - 1];
  const extraBlocks = Math.ceil((fareKm - baseKm) / EXTRA_BLOCK_KM);
  return baseFare + extraBlocks * EXTRA_FARE_PER_BLOCK;
}
