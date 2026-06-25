// タスク2: 路線情報の補完（curl版）
// Overpass API の relation[route=*] を使って各駅に路線名リストを付与。
// Node fetch が失敗するためcurlをspawn。
//
// 実行: node scripts/enrichLines.js
// 出力: data/stations-osm.json を上書き

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OSM_PATH = join(__dirname, "../data/stations-osm.json");
const TMP_DIR  = join(__dirname, "../data/.tmp");

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function normalizeName(raw) {
  if (!raw) return null;
  return raw.replace(/駅$/u, "").trim();
}

function overpassCurl(query, outFile) {
  const ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
  ];
  for (const ep of ENDPOINTS) {
    try {
      execSync(
        `curl -s --max-time 300 -X POST "${ep}" --data-urlencode "data=${query.replace(/"/g, '\\"')}" -o "${outFile}"`,
        { timeout: 320000 }
      );
      const txt = readFileSync(outFile, "utf-8");
      if (txt.includes('"elements"')) {
        console.log(`  ✅ 成功: ${ep}`);
        return JSON.parse(txt);
      }
      console.warn(`  ⚠ レスポンス異常: ${ep}, 内容: ${txt.slice(0,100)}`);
    } catch (e) {
      console.warn(`  ❌ 失敗: ${ep} - ${e.message.slice(0, 60)}`);
    }
  }
  throw new Error("全Overpassエンドポイント失敗");
}

async function main() {
  mkdirSync(TMP_DIR, { recursive: true });

  // 駅データ読み込み
  const stations = JSON.parse(readFileSync(OSM_PATH, "utf-8"));
  console.log(`駅データ読み込み: ${stations.length}駅`);
  const noLinesBefore = stations.filter((s) => !s.lines || s.lines.length === 0).length;
  console.log(`路線情報なし: ${noLinesBefore}駅\n`);

  // ── Step 1: 路線リレーションを取得 ─────────────────────────────────────
  console.log("=== Step1: Overpassから路線リレーション取得 ===");
  const relQuery = `
[out:json][timeout:300];
(
  relation["route"="railway"](24.0,122.9,46.0,149.0);
  relation["route"="subway"](24.0,122.9,46.0,149.0);
  relation["route"="light_rail"](24.0,122.9,46.0,149.0);
  relation["route"="tram"](24.0,122.9,46.0,149.0);
  relation["route"="monorail"](24.0,122.9,46.0,149.0);
);
out tags members;
`.trim();

  const relFile = join(TMP_DIR, "relations.json");
  const relData = overpassCurl(relQuery, relFile);
  const relations = (relData.elements || []).filter((e) => e.type === "relation");
  console.log(`路線リレーション数: ${relations.length}\n`);

  // 路線リレーションからstop/station node refを収集
  const nodeRefToLines = new Map(); // nodeRef(number) → Set<路線名>
  for (const rel of relations) {
    const tags = rel.tags || {};
    const lineName = tags["name:ja"] || tags["name"] || tags["ref"] || null;
    if (!lineName) continue;
    for (const m of rel.members || []) {
      if (m.type !== "node") continue;
      const role = m.role || "";
      if (role === "" || role.includes("stop") || role.includes("station")) {
        if (!nodeRefToLines.has(m.ref)) nodeRefToLines.set(m.ref, new Set());
        nodeRefToLines.get(m.ref).add(lineName);
      }
    }
  }
  console.log(`stop/stationノード総数: ${nodeRefToLines.size}`);

  // ── Step 2: node refからstation nameを取得 ──────────────────────────────
  console.log("\n=== Step2: nodeタグ取得（分割クエリ） ===");
  const allRefs = Array.from(nodeRefToLines.keys());
  const CHUNK = 3000;
  const nameToLines = new Map(); // 駅名 → Set<路線名>

  for (let i = 0; i < allRefs.length; i += CHUNK) {
    const chunk = allRefs.slice(i, i + CHUNK);
    const chunkNum = Math.floor(i / CHUNK) + 1;
    const total    = Math.ceil(allRefs.length / CHUNK);
    console.log(`  chunk ${chunkNum}/${total} (${chunk.length}件)...`);

    const nodeQuery = `[out:json][timeout:120];node(id:${chunk.join(",")});out tags;`.trim();
    const nodeFile  = join(TMP_DIR, `nodes_${chunkNum}.json`);

    try {
      const nodeData = overpassCurl(nodeQuery, nodeFile);
      for (const node of nodeData.elements || []) {
        const rawName = node.tags?.["name"];
        if (!rawName) continue;
        const name = normalizeName(rawName);
        if (!name) continue;
        const lines = nodeRefToLines.get(node.id);
        if (!lines) continue;
        if (!nameToLines.has(name)) nameToLines.set(name, new Set());
        for (const l of lines) nameToLines.get(name).add(l);
      }
    } catch (e) {
      console.warn(`  chunk ${chunkNum} スキップ:`, e.message);
    }
    await sleep(2000);
  }

  console.log(`\n路線情報を取得できた駅名: ${nameToLines.size}件`);

  // ── Step 3: 駅データにマージ ────────────────────────────────────────────
  console.log("\n=== Step3: 駅データにマージ ===");
  let enriched   = 0;
  let supplement = 0;

  for (const s of stations) {
    const newLines = nameToLines.get(s.name);
    if (!newLines || newLines.size === 0) continue;

    const existing = new Set(s.lines || []);
    const before   = existing.size;
    for (const l of newLines) existing.add(l);

    if (existing.size > before) {
      s.lines = Array.from(existing);
      if (before === 0) enriched++;
      else              supplement++;
    }
  }

  console.log(`路線情報を新規付与: ${enriched}駅`);
  console.log(`路線情報を追加補完: ${supplement}駅`);

  // 保存
  writeFileSync(OSM_PATH, JSON.stringify(stations, null, 2), "utf-8");
  console.log(`\n✅ stations-osm.json 更新完了 (${stations.length}駅)`);

  const noLinesAfter = stations.filter((s) => !s.lines || s.lines.length === 0).length;
  console.log(`路線情報なし(残): ${noLinesAfter}駅 (改善: ${noLinesBefore - noLinesAfter}駅)`);
}

main().catch((e) => {
  console.error("エラー:", e.message);
  process.exit(1);
});
