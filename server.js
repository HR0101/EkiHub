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
import { getOrBuildGraph } from "./lib/stationGraph.js";
import { fetchNearbySpots, CATEGORY_LABELS } from "./lib/poiService.js";
import { makeProviderFromEnv } from "./lib/routeProvider.js";

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

// 関東以外の主要駅リスト（ridership.json にデータがない地域向け）
const EXTRA_MAJOR_STATIONS = new Set([
  "札幌", "青森", "盛岡", "仙台", "秋田", "山形", "福島",
  "新潟", "富山", "金沢", "福井", "甲府", "長野",
  "岐阜", "静岡", "浜松", "名古屋", "豊橋",
  "津", "大津", "京都", "大阪", "新大阪", "天王寺", "難波", "なんば", "京橋",
  "神戸", "三ノ宮", "姫路", "奈良", "和歌山",
  "鳥取", "松江", "岡山", "倉敷", "広島", "福山", "山口", "新山口",
  "徳島", "高松", "松山", "高知",
  "福岡", "博多", "小倉", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島中央", "那覇空港"
]);

// マージ済み駅リストへ乗降客数を適用し、主要駅フラグを再計算する.
// S12データがある駅は実測値で上書きし、規模をモードA判定へ反映する.
function applyRidership(stations) {
  for (const s of stations) {
    const measured = ridershipMap[s.name];
    if (typeof measured === "number" && measured > 0) {
      s.ridership = measured;
    }
    // 実測 or 既存フラグ or 関東外主要駅リストのいずれかで主要駅とみなす
    s.isMajor = s.isMajor === true || s.ridership >= MAJOR_THRESHOLD || EXTRA_MAJOR_STATIONS.has(s.name);
  }
  return stations;
}

const app = express();
const PORT = process.env.PORT || 3000;
const ODPT_TOKEN = process.env.ODPT_TOKEN || null;
// 経路プロバイダ（環境変数で選択。未設定なら null = 距離概算へフォールバック）
const routeProvider = makeProviderFromEnv();
const ROUTING_ENABLED = Boolean(routeProvider);

// index.html を起動時に読み込み、OGP等の絶対URLを配信時に注入できるようにする.
// ビルドはせず、配信時に __ORIGIN__ をリクエストのホストへ置換するだけ.
const INDEX_TEMPLATE = (() => {
  try {
    return readFileSync(join(__dirname, "public", "index.html"), "utf-8");
  } catch (error) {
    console.error("index.htmlの読込に失敗:", error.message);
    return null;
  }
})();

// リクエストから絶対オリジン(scheme://host)を組み立てる.
// リバースプロキシ経由を考慮し X-Forwarded-* を優先する.
function resolveOrigin(req) {
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "http")
    .split(",")[0]
    .trim();
  const host = req.headers["x-forwarded-host"] || req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

// Content-Security-Policy（外部CDN/タイル/フォント/Overpassのみ許可）.
// 値を変えると地図やフォントが壊れるため、利用元の追加時のみ慎重に更新する.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // スクリプトは Leaflet(unpkg) と QRコード(jsDelivr) のみ外部許可
  "script-src 'self' https://unpkg.com https://cdn.jsdelivr.net",
  // injectStyle と style 属性のため inline を許可。CSSは Leaflet(unpkg)/Google Fonts
  "style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  // 地図タイル(CARTO/OpenRailwayMap) と Leaflet のマーカー画像(unpkg)
  "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://*.tiles.openrailwaymap.org https://unpkg.com",
  // 自API と、ブラウザから直接叩く Overpass ミラー
  "connect-src 'self' https://overpass-api.de https://overpass.private.coffee https://overpass.kumi.systems",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join("; ");

// セキュリティヘッダ（全レスポンス共通）.
// 認証/Cookieは扱わないが、クリックジャッキングやMIMEスニッフィング等を防ぐ.
app.use((_req, res, next) => {
  res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  res.setHeader("X-Frame-Options", "DENY"); // 旧ブラウザ向けの保険
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(self), camera=(), microphone=(), payment=()"
  );
  // HTTPS接続を強制（本番HTTPS前提。HTTPでは各ブラウザが無視する）
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

app.use(express.json());

// トップページは OGP 等の絶対URLを注入して返す（静的配信より前に処理する）.
app.get(["/", "/index.html"], (req, res, next) => {
  if (!INDEX_TEMPLATE) return next();
  const html = INDEX_TEMPLATE.replaceAll("__ORIGIN__", resolveOrigin(req));
  res.type("html").send(html);
});

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
    // 内部例外の詳細はログのみに残し、利用者には一般化したメッセージを返す
    console.error("駅一覧の取得に失敗:", error);
    res.status(500).json({ error: "駅データの取得に失敗しました。時間をおいて再度お試しください。" });
  }
});

// 中心駅算出API
// リクエストボディ: { origins: ["新宿","横浜",...], mode: "A" | "B" }
app.post("/api/center", async (req, res) => {
  try {
    const { origins, mode, weight, fareWeight, peopleCounts } = req.body || {};

    // 入力バリデーション
    if (!Array.isArray(origins) || origins.length < 2) {
      return res.status(400).json({ error: "最寄駅を2駅以上入力してください." });
    }
    const safeMode = mode === "A" ? "A" : "B";
    // 重視ポイント(公平さ重み 0〜1)。未指定や不正値は既定にフォールバック.
    const fairnessWeight =
      typeof weight === "number" && weight >= 0 && weight <= 1 ? weight : 0.6;
    // 運賃重視の重み(0〜1)。未指定は0(運賃を考慮しない).
    const safeFareWeight =
      typeof fareWeight === "number" && fareWeight >= 0 && fareWeight <= 1 ? fareWeight : 0;

    const allStations = await loadStations();
    const stationByName = new Map(allStations.map((s) => [s.name, s]));

    // 入力された駅名を実データへ解決する（人数重みも付与）
    const originStations = [];
    const unknown = [];
    origins.forEach((name, index) => {
      const trimmed = typeof name === "string" ? name.trim() : "";
      const found = stationByName.get(trimmed);
      if (found) {
        // 駅マスタを汚さないよう複製し、人数(重み)を付与する
        const peopleRaw = Array.isArray(peopleCounts) ? Number(peopleCounts[index]) : 1;
        const people = Number.isFinite(peopleRaw) && peopleRaw > 0 ? Math.floor(peopleRaw) : 1;
        originStations.push({ ...found, people });
      } else if (trimmed.length > 0) {
        unknown.push(trimmed);
      }
    });

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
      routeProvider,
      topN: 8,
      fairnessWeight,
      fareWeight: safeFareWeight,
      refineCount: 8
    });

    res.json({
      ...result,
      origins: originStations.map((s) => ({
        name: s.name,
        kana: s.kana,
        lat: s.lat,
        lng: s.lng,
        people: s.people
      })),
      routingUsed: ROUTING_ENABLED
    });
  } catch (error) {
    // 内部例外の詳細はログのみに残し、利用者には一般化したメッセージを返す
    console.error("中心駅の算出に失敗:", error);
    res.status(500).json({ error: "算出に失敗しました。時間をおいて再度お試しください。" });
  }
});

// 周辺スポットAPI: 集合駅周辺の集まれる場所(カフェ・居酒屋等)を返す
// クエリ: ?lat=&lng=&category=&radius=
app.get("/api/spots", async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const category = String(req.query.category || "cafe");
    const radius = Math.min(1500, Math.max(100, Number(req.query.radius) || 800));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "緯度経度を指定してください." });
    }
    const spots = await fetchNearbySpots({ lat, lng, category, radius });
    res.json({ count: spots.length, category, radius, spots });
  } catch (error) {
    // 内部例外の詳細はログのみに残し、利用者には一般化したメッセージを返す
    console.error("周辺スポットの取得に失敗:", error);
    res.status(500).json({ error: "周辺スポットの取得に失敗しました。時間をおいて再度お試しください。" });
  }
});

// 周辺スポットのカテゴリ一覧
app.get("/api/spot-categories", (_req, res) => {
  res.json({ categories: CATEGORY_LABELS });
});

// ヘルスチェック（有効な機能の一覧つき）
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    odptEnabled: Boolean(ODPT_TOKEN),
    routingEnabled: ROUTING_ENABLED,
    routingProvider: ROUTING_ENABLED ? (process.env.ROUTING_PROVIDER || "custom") : null,
    features: ["center", "fare", "people-weight", "spots", "routing"]
  });
});

// 404ハンドラ（既知のルート・静的ファイルに合致しない場合）.
// APIはJSON、それ以外は導線つきの404ページを返す.
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "指定されたAPIは存在しません。" });
  }
  res.status(404);
  const notFoundPage = join(__dirname, "public", "404.html");
  if (existsSync(notFoundPage)) return res.sendFile(notFoundPage);
  res.type("text").send("404 Not Found");
});

app.listen(PORT, () => {
  console.log(`EkiHub サーバー起動: http://localhost:${PORT}`);
  console.log(`ODPT拡張: ${ODPT_TOKEN ? "有効" : "無効（埋め込みデータで動作）"}`);
  console.log(
    `経路API: ${ROUTING_ENABLED ? `有効（${process.env.ROUTING_PROVIDER}）` : "無効（距離概算で動作）"}`
  );

  // 駅ネットワークグラフを起動時に構築しておく（初回リクエストの遅延を避ける）.
  // 失敗しても /api/center 側で都度構築されるため致命的ではない.
  loadStations()
    .then((stations) => {
      const start = Date.now();
      const graph = getOrBuildGraph(stations);
      const edges = graph.adjacency.reduce((sum, list) => sum + list.length, 0) / 2;
      console.log(
        `駅ネットワーク構築: ${graph.count}駅 / ${edges}区間 (${Date.now() - start}ms) ` +
          `― 経路ベースで中心駅を算出します`
      );
    })
    .catch((error) => {
      console.error("駅ネットワークの事前構築に失敗:", error.message);
    });
});
