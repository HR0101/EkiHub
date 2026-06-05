// EkiHub バックエンドサーバー（Express）
// 役割:
//   1) 静的フロントエンド(public/)の配信
//   2) /api/stations  : 候補・入力補完用の駅一覧を返す（ODPTトークンがあれば全駅へ拡張）
//   3) /api/center    : 入力駅群と モードA/B から中心駅を算出して返す
//
// 外部APIキー（任意）は環境変数で受け取り、秘匿する:
//   ODPT_TOKEN        : 公共交通オープンデータ(ODPT)の駅データ拡張に利用
//   ROUTING_API_KEY   : 経路検索API（移動時間補正）に利用（routeProvider実装は雛形）

import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync, existsSync } from "fs";

import { stations as embeddedStations } from "./data/stations.js";
import { computeCenterStation } from "./lib/centerLogic.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// OSM(関東圏全駅)データを起動時に読み込む（scripts/fetchKantoStations.js で生成）
// 乗降客数つきの埋め込みデータを優先しつつ、未収録駅をこれで補完する.
function loadOsmStations() {
  const path = join(__dirname, "data", "stations-osm.json");
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("OSM駅データの読込に失敗:", error.message);
    return [];
  }
}

const osmStations = loadOsmStations();

// 乗降客数マップ(駅名 -> 1日あたり乗降客数)を読み込む
// scripts/buildRidership.js が国土数値情報S12から生成する.
function loadRidershipMap() {
  const path = join(__dirname, "data", "ridership.json");
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.error("乗降客数データの読込に失敗:", error.message);
    return {};
  }
}

const ridershipMap = loadRidershipMap();
// モードA(主要駅)判定の閾値(1日あたり乗降客数). data/stations.js と揃える.
const MAJOR_THRESHOLD = 200000;

// マージ済み駅リストへ乗降客数を適用し、主要駅フラグを再計算する.
// S12データがある駅は実測値で上書きし、規模をモードA判定へ反映する.
function applyRidership(stations) {
  for (const s of stations) {
    const measured = ridershipMap[s.name];
    if (typeof measured === "number" && measured > 0) {
      s.ridership = measured;
    }
    // 実測 or 既存フラグのいずれかで主要駅とみなす
    s.isMajor = s.isMajor === true || s.ridership >= MAJOR_THRESHOLD;
  }
  return stations;
}

const app = express();
const PORT = process.env.PORT || 3000;
const ODPT_TOKEN = process.env.ODPT_TOKEN || null;
const ROUTING_API_KEY = process.env.ROUTING_API_KEY || null;

app.use(express.json());
app.use(express.static(join(__dirname, "public")));

// 駅一覧のキャッシュ（ハイブリッド: 埋め込み + 任意でODPT拡張）
let stationCache = null;

// 同名駅の重複を排除して2配列をマージする（埋め込みデータを優先）
function mergeStations(base, extra) {
  const map = new Map();
  for (const s of base) {
    map.set(s.name, s);
  }
  for (const s of extra) {
    if (!map.has(s.name)) {
      map.set(s.name, s);
    }
  }
  return Array.from(map.values());
}

// ODPTから駅データを取得して埋め込みデータへマージする（トークンがある時のみ）
async function loadStations() {
  if (stationCache) return stationCache;

  // まず 埋め込み(主要駅・乗降客数つき) と OSM(関東全駅) をマージし、
  // 国土数値情報S12の乗降客数を適用して主要駅フラグを確定する.
  const baseStations = applyRidership(mergeStations(embeddedStations, osmStations));

  if (!ODPT_TOKEN) {
    // トークン未設定: 埋め込み + OSM で関東圏をカバー
    stationCache = baseStations;
    return stationCache;
  }

  try {
    // ODPT 駅情報API（東京メトロ/JR東日本等の駅 location を取得）
    const endpoint =
      "https://api.odpt.org/api/v4/odpt:Station?acl:consumerKey=" +
      encodeURIComponent(ODPT_TOKEN);
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error("ODPT応答エラー: " + response.status);
    }
    const raw = await response.json();

    // ODPTレスポンスを内部形式へ正規化する
    const odptStations = raw
      .filter((item) => item["geo:lat"] && item["geo:long"] && item["dc:title"])
      .map((item) => ({
        name: item["dc:title"],
        kana: item["odpt:stationTitle"]?.ja || item["dc:title"],
        lat: Number(item["geo:lat"]),
        lng: Number(item["geo:long"]),
        lines: item["odpt:railway"] ? [String(item["odpt:railway"]).split(".").pop()] : [],
        ridership: 0, // ODPTは乗降客数を含まないため0（モードAでは埋め込み主要駅が優先）
        isMajor: false
      }));

    stationCache = mergeStations(baseStations, odptStations);
    console.log(`ODPT拡張完了: 合計 ${stationCache.length} 駅`);
    return stationCache;
  } catch (error) {
    console.error("ODPT取得失敗のため埋め込み+OSMデータで継続します:", error.message);
    stationCache = baseStations;
    return stationCache;
  }
}

// 経路検索APIによる所要時間取得（雛形）。
// ROUTING_API_KEY 未設定時は null を返し、centerLogic 側が距離推定へフォールバックする.
function makeRouteProvider() {
  if (!ROUTING_API_KEY) return null;
  // 実APIを使う場合はここで origin->candidate の所要時間(分)を返す実装を行う.
  // 例: Google Directions API / 駅すぱあとAPI / NAVITIME など.
  // 雛形では未実装のため null を返し、フォールバックさせる.
  return async (_origin, _candidate) => null;
}

// 駅一覧API: フロントの入力補完・候補表示に利用
app.get("/api/stations", async (_req, res) => {
  try {
    const stations = await loadStations();
    // 入力補完に必要な最小限のフィールドのみ返す
    const slim = stations.map((s) => ({
      name: s.name,
      kana: s.kana,
      lat: s.lat,
      lng: s.lng,
      lines: s.lines,
      isMajor: s.isMajor
    }));
    res.json({ count: slim.length, stations: slim });
  } catch (error) {
    res.status(500).json({ error: "駅データの取得に失敗しました: " + error.message });
  }
});

// 中心駅算出API
// リクエストボディ: { origins: ["新宿","横浜",...], mode: "A" | "B" }
app.post("/api/center", async (req, res) => {
  try {
    const { origins, mode } = req.body || {};

    // 入力バリデーション
    if (!Array.isArray(origins) || origins.length < 2) {
      return res.status(400).json({ error: "最寄駅を2駅以上入力してください." });
    }
    const safeMode = mode === "A" ? "A" : "B";

    const allStations = await loadStations();
    const stationByName = new Map(allStations.map((s) => [s.name, s]));

    // 入力された駅名を実データへ解決する
    const originStations = [];
    const unknown = [];
    for (const name of origins) {
      const trimmed = typeof name === "string" ? name.trim() : "";
      const found = stationByName.get(trimmed);
      if (found) {
        originStations.push(found);
      } else if (trimmed.length > 0) {
        unknown.push(trimmed);
      }
    }

    if (unknown.length > 0) {
      return res.status(400).json({
        error: "登録されていない駅名があります: " + unknown.join("、"),
        unknown
      });
    }
    if (originStations.length < 2) {
      return res.status(400).json({ error: "有効な最寄駅を2駅以上入力してください." });
    }

    const result = await computeCenterStation({
      originStations,
      allStations,
      mode: safeMode,
      routeProvider: makeRouteProvider(),
      topN: 5
    });

    res.json({
      ...result,
      origins: originStations.map((s) => ({
        name: s.name,
        kana: s.kana,
        lat: s.lat,
        lng: s.lng
      })),
      routingUsed: Boolean(ROUTING_API_KEY)
    });
  } catch (error) {
    res.status(500).json({ error: "算出に失敗しました: " + error.message });
  }
});

// ヘルスチェック
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", odptEnabled: Boolean(ODPT_TOKEN) });
});

app.listen(PORT, () => {
  console.log(`EkiHub サーバー起動: http://localhost:${PORT}`);
  console.log(`ODPT拡張: ${ODPT_TOKEN ? "有効" : "無効（埋め込みデータで動作）"}`);
});
