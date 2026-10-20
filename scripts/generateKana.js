// Apply reviewed kana and normalize existing notation. Do not publish kuromoji
// guesses as station readings: general dictionaries misread proper names.
// Usage: node scripts/generateKana.js [--check]
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { findStationKanaOverride, normalizeStationKana } from "../lib/stationKana.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(root, "data/stations-osm.json");
const stations = JSON.parse(readFileSync(path, "utf8"));
const overrides = JSON.parse(readFileSync(join(root, "data/station-kana-overrides.json"), "utf8"));
const check = process.argv.includes("--check");
let changed = 0;
const needsReview = [];
for (const station of stations) {
  const override = findStationKanaOverride(station, overrides);
  const reading = override?.kana ?? normalizeStationKana(station.kana);
  // Keep unresolved data intact; do not replace unknown kanji/ヶ with guesses.
  if (!/^[ぁ-ゔー]+$/.test(reading) || /[ゕゖ]/.test(reading)) {
    needsReview.push({ name: station.name, kana: station.kana });
    continue;
  }
  if (reading !== station.kana) { station.kana = reading; changed++; }
}
if (!check && changed) writeFileSync(path, JSON.stringify(stations, null, 2) + "\n");
console.log(`${check ? "変更予定" : "修正"}: ${changed}件 / 要確認: ${needsReview.length}件`);
if (needsReview.length) console.log(JSON.stringify(needsReview, null, 2));
if (check && changed) process.exitCode = 1;
