// 駅マスタ読み込みの共有モジュール（待ち合わせスポット用スクリプトから利用）
// 埋め込み駅(data/stations.js)・OSM駅・乗降客数(S12)をマージして返す.
// 同名駅は埋め込みを優先する（server.js と同じ方針）.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { stations as embeddedStations } from '../data/stations.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const osmPath = join(__dirname, '../data/stations-osm.json');
const ridershipPath = join(__dirname, '../data/ridership.json');

// JSONファイルを読み込む（失敗時は原因を明示して終了）
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (error) {
    console.error(`読み込みに失敗しました: ${path}\n原因: ${error.message}`);
    process.exit(1);
  }
}

// 駅マスタを配列で返す（ridership は S12 値があれば上書き）
export function loadStationMaster() {
  const osm = readJson(osmPath);
  const ridershipMap = readJson(ridershipPath);

  const embeddedNames = new Set(embeddedStations.map((s) => s.name));
  const merged = [
    ...embeddedStations,
    ...osm.filter((s) => s.name && !embeddedNames.has(s.name))
  ];

  return merged.map((s) => ({
    ...s,
    ridership: ridershipMap[s.name] ?? s.ridership ?? 0
  }));
}

// 駅名 -> 同名駅の配列 の索引を作る（「大町」のような同名駅に備える）
export function groupByName(stationList) {
  const map = new Map();
  for (const s of stationList) {
    if (!map.has(s.name)) map.set(s.name, []);
    map.get(s.name).push(s);
  }
  return map;
}

// 2点間の距離（メートル, haversine）
export function distanceMeters(aLat, aLng, bLat, bLng) {
  const EARTH_RADIUS_M = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}
