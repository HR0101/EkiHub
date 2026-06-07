// 周辺スポット取得サービス
// 集合駅の周辺にある「集まれる場所」(カフェ・居酒屋・カラオケ等)を
// OpenStreetMap(Overpass API)から取得する. キー不要・無料.
// ネットワーク不調時は空配列を返し、UI側は「取得できませんでした」を表示する.

// カテゴリ -> Overpassのタグ条件 のマッピング
// 値は OSM の amenity / leisure / shop タグ
const CATEGORY_QUERY = {
  cafe: '["amenity"="cafe"]',
  restaurant: '["amenity"="restaurant"]',
  izakaya: '["amenity"~"bar|pub|biergarten"]',
  fastfood: '["amenity"="fast_food"]',
  karaoke: '["leisure"="karaoke"]',
  convenience: '["shop"="convenience"]',
  park: '["leisure"="park"]'
};

// カテゴリの表示ラベル(日本語)
export const CATEGORY_LABELS = {
  cafe: "カフェ",
  restaurant: "レストラン",
  izakaya: "居酒屋・バー",
  fastfood: "ファストフード",
  karaoke: "カラオケ",
  convenience: "コンビニ",
  park: "公園"
};

// 取得結果の簡易キャッシュ（同一地点・カテゴリの再取得を抑制）
const cache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30分

// Overpassミラー（順に試す）
const ENDPOINTS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];

// キャッシュキーを作る（座標は小数3桁=約100m単位に丸める）
function cacheKey(lat, lng, category, radius) {
  const rl = Math.round(lat * 1000) / 1000;
  const rg = Math.round(lng * 1000) / 1000;
  return `${rl},${rg},${category},${radius}`;
}

// 指定時間でタイムアウトするfetch
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// 周辺スポットを取得する
// 引数: { lat, lng, category, radius(メートル) }
// 戻り値: [{ name, category, lat, lng, tags }]
export async function fetchNearbySpots({ lat, lng, category = "cafe", radius = 400 }) {
  if (typeof lat !== "number" || typeof lng !== "number") {
    throw new Error("緯度経度が不正です.");
  }
  const tagQuery = CATEGORY_QUERY[category];
  if (!tagQuery) {
    throw new Error("未対応のカテゴリです: " + category);
  }

  // キャッシュ確認
  const key = cacheKey(lat, lng, category, radius);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
    return cached.data;
  }

  // Overpassクエリ（node/way/relation を半径内で検索し中心点を返す）
  const query = `
[out:json][timeout:20];
(
  node${tagQuery}(around:${radius},${lat},${lng});
  way${tagQuery}(around:${radius},${lat},${lng});
);
out center tags 40;
`;

  let lastError = null;
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            "User-Agent": "EkiHub/1.0 (nearby spots)"
          },
          body: "data=" + encodeURIComponent(query)
        },
        9000
      );
      if (!res.ok) throw new Error("HTTP " + res.status);
      const raw = await res.json();
      const spots = normalize(raw, category);
      cache.set(key, { time: Date.now(), data: spots });
      return spots;
    } catch (error) {
      lastError = error;
    }
  }
  // 全ミラー失敗（ネットワーク不可等）は例外にする。
  // これによりルートは500を返し、フロント側で「0件」と「取得失敗」を区別できる。
  console.error("周辺スポット取得に失敗:", lastError?.message);
  throw new Error("周辺スポットの取得に失敗しました: " + (lastError ? lastError.message : "unknown"));
}

// Overpassレスポンスを内部形式へ正規化する
function normalize(raw, category) {
  const seen = new Set();
  const result = [];
  for (const el of raw.elements || []) {
    const tags = el.tags || {};
    const name = tags.name || tags["name:ja"];
    if (!name) continue; // 名前のないものは表示価値が低いため除外
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    if (seen.has(name)) continue;
    seen.add(name);
    result.push({
      name,
      category,
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
      tags: {
        cuisine: tags.cuisine || null,
        opening_hours: tags.opening_hours || null
      }
    });
  }
  return result;
}
