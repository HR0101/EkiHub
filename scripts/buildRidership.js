// 国土数値情報「駅別乗降客数」(S12) のGeoJSONから、
// 駅名 -> 1日あたり乗降客数(関東圏・全事業者合算) のマップを生成する.
//
// 前提: 先に S12-23 のGeoJSONを展開しておくこと.
//   入力GeoJSONパスは第1引数で指定（省略時は既定パス）.
// 出力: data/ridership.json  { "新宿": 1500000, ... }
//
// S12レコード構造:
//   S12_001 = 駅名 / S12_002 = 事業者 / S12_003 = 路線
//   年度別の乗降客数が4フィールド周期で並ぶ([値, フラグ, フラグ, 備考]).
//   最古 S12_009 〜 最新 S12_053. 最新の非null値を採用する.

import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, "..", "data", "ridership.json");

// 関東1都6県のおおよそのバウンディングボックス [南, 西, 北, 東]
const BBOX = { south: 34.9, west: 138.9, north: 37.2, east: 141.1 };

// 年度別乗降客数フィールド（新しい順に試す）
const YEAR_FIELDS = [
  "S12_053", "S12_049", "S12_045", "S12_041", "S12_037", "S12_033",
  "S12_029", "S12_025", "S12_021", "S12_017", "S12_013", "S12_009"
];

// 駅名末尾の「駅」を除去して表記を統一する
function normalizeName(name) {
  if (!name) return null;
  return String(name).replace(/駅$/u, "").trim();
}

// 1レコードから最新の有効な乗降客数を取り出す
function latestPassengers(props) {
  for (const field of YEAR_FIELDS) {
    const v = props[field];
    if (typeof v === "number" && v > 0) return v;
  }
  return 0;
}

// 座標が関東圏内かを判定する
function inKanto(lng, lat) {
  return (
    lat >= BBOX.south && lat <= BBOX.north && lng >= BBOX.west && lng <= BBOX.east
  );
}

// FeatureのおおよそのPoint座標を求める（Point/LineString双方に対応）
function featureCoord(geometry) {
  if (!geometry) return null;
  if (geometry.type === "Point") {
    return geometry.coordinates; // [lng, lat]
  }
  if (geometry.type === "LineString" && geometry.coordinates.length > 0) {
    // 路線中点を代表点とする
    const mid = geometry.coordinates[Math.floor(geometry.coordinates.length / 2)];
    return mid;
  }
  if (geometry.type === "MultiLineString" && geometry.coordinates[0]?.length > 0) {
    const line = geometry.coordinates[0];
    return line[Math.floor(line.length / 2)];
  }
  return null;
}

function main() {
  const inputPath = process.argv[2] || "/tmp/s12/UTF-8/S12-23_NumberOfPassengers.geojson";
  if (!existsSync(inputPath)) {
    console.error("入力GeoJSONが見つかりません:", inputPath);
    console.error("国土数値情報S12を展開してパスを指定してください.");
    process.exit(1);
  }

  const geojson = JSON.parse(readFileSync(inputPath, "utf-8"));
  const features = geojson.features || [];

  // 駅名ごとに全事業者の乗降客数を合算する
  const ridershipByName = new Map();
  let kantoCount = 0;

  for (const f of features) {
    const coord = featureCoord(f.geometry);
    if (!coord) continue;
    const [lng, lat] = coord;
    if (!inKanto(lng, lat)) continue; // 関東圏のみ対象

    const name = normalizeName(f.properties?.S12_001);
    if (!name) continue;

    const passengers = latestPassengers(f.properties);
    if (passengers <= 0) continue;

    kantoCount += 1;
    ridershipByName.set(name, (ridershipByName.get(name) || 0) + passengers);
  }

  // 整数へ丸めてオブジェクト化
  const result = {};
  for (const [name, value] of ridershipByName) {
    result[name] = Math.round(value);
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 0), "utf-8");
  console.log(`関東圏レコード: ${kantoCount} 件`);
  console.log(`乗降客数マップ生成: ${Object.keys(result).length} 駅 -> ${OUTPUT_PATH}`);

  // 上位10駅を確認用に出力
  const top = Object.entries(result)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  console.log("--- 乗降客数 上位10駅 ---");
  for (const [name, value] of top) {
    console.log(`  ${name}: ${value.toLocaleString()} 人/日`);
  }
}

main();
