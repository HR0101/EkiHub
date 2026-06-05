// 関東1都6県の鉄道駅をOpenStreetMap(Overpass API)から一括取得し、
// data/stations-osm.json として保存するビルドスクリプト.
//
// 実行: node scripts/fetchKantoStations.js
//   - キー不要・無料
//   - 取得した駅は { name, kana, lat, lng, lines, ridership:0, isMajor:false } 形式
//   - server.js が埋め込みデータ(乗降客数つき)とマージして利用する

import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, "..", "data", "stations-osm.json");

// 関東1都6県をおおよそ覆うバウンディングボックス (south, west, north, east)
const BBOX = [34.9, 138.9, 37.2, 141.1];

// Overpassクエリ: railway=station の node / way を取得（廃止・地下のみ等は除外しない簡易版）
const QUERY = `
[out:json][timeout:120];
(
  node["railway"="station"](${BBOX.join(",")});
  way["railway"="station"](${BBOX.join(",")});
);
out center tags;
`;

// 複数のミラーを順に試す（混雑対策）
const ENDPOINTS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
];

// 指定ミリ秒待機する
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 駅名末尾の「駅」を除去して表記を統一する
function normalizeName(name) {
  if (!name) return null;
  return name.replace(/駅$/u, "").trim();
}

async function fetchOverpass() {
  let lastError = null;
  const MAX_ROUNDS = 4; // レート制限(429)対策で複数回りトライ
  for (let round = 0; round < MAX_ROUNDS; round++) {
    for (const endpoint of ENDPOINTS) {
      try {
        console.log(`取得中(${round + 1}回目):`, endpoint);
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "User-Agent": "EkiHub/1.0 (station data builder)"
          },
          body: "data=" + encodeURIComponent(QUERY)
        });
        if (res.status === 429) throw new Error("HTTP 429 (rate limited)");
        if (!res.ok) throw new Error("HTTP " + res.status);
        return await res.json();
      } catch (error) {
        console.warn("失敗:", endpoint, error.message);
        lastError = error;
        await sleep(3000); // ミラー間で間隔を空ける
      }
    }
    console.log("全ミラー失敗。15秒待機して再試行します...");
    await sleep(15000);
  }
  throw lastError || new Error("全エンドポイントで取得に失敗しました");
}

function convert(raw) {
  const byName = new Map();
  for (const el of raw.elements || []) {
    const tags = el.tags || {};
    const name = normalizeName(tags["name"]);
    if (!name) continue;

    // 座標（nodeはlat/lon、wayはcenter）
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (typeof lat !== "number" || typeof lng !== "number") continue;

    // 読み（あれば）
    const kana = tags["name:ja-Hira"] || tags["name:kana"] || "";
    // 運営路線（あれば）
    const operator = tags["operator"] || "";
    const network = tags["network"] || "";
    const lines = [network, operator].filter(Boolean);

    // 同名駅は最初の1件のみ採用（重複排除）
    if (!byName.has(name)) {
      byName.set(name, {
        name,
        kana,
        lat: Math.round(lat * 1e6) / 1e6,
        lng: Math.round(lng * 1e6) / 1e6,
        lines,
        ridership: 0,
        isMajor: false
      });
    }
  }
  return Array.from(byName.values());
}

async function main() {
  const raw = await fetchOverpass();
  const stations = convert(raw);
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(stations, null, 0), "utf-8");
  console.log(`保存完了: ${stations.length} 駅 -> ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error("エラー:", error.message);
  process.exit(1);
});
