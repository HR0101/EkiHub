// 周辺スポット取得サービス
// 集合駅の周辺にある「集まれる場所」(カフェ・居酒屋・カラオケ等)を
// OpenStreetMap(Overpass API)から取得する. キー不要・無料.
// ネットワーク不調時は空配列を返し、UI側は「取得できませんでした」を表示する.

// カテゴリ -> Overpassのタグ条件（複数条件で網羅性を上げる）
// 値は OSM の amenity / leisure / shop / cuisine タグ
const CATEGORY_SELECTORS = {
  cafe: ['["amenity"="cafe"]', '["shop"="coffee"]'],
  restaurant: ['["amenity"="restaurant"]', '["amenity"="food_court"]'],
  izakaya: ['["amenity"="pub"]', '["amenity"="bar"]', '["amenity"="biergarten"]', '["cuisine"~"izakaya"]'],
  fastfood: ['["amenity"="fast_food"]'],
  karaoke: ['["leisure"="karaoke"]', '["amenity"="karaoke_box"]'],
  convenience: ['["shop"="convenience"]'],
  park: ['["leisure"="park"]', '["leisure"="garden"]']
};

// Overpassから取得する最大件数（従来40→拡大）
const RESULT_CAP = 120;

// カテゴリのタグ条件から node/way/relation を網羅する Overpass クエリを組み立てる
function buildOverpassQuery(selectors, lat, lng, radius) {
  const parts = [];
  for (const sel of selectors) {
    parts.push(`node${sel}(around:${radius},${lat},${lng});`);
    parts.push(`way${sel}(around:${radius},${lat},${lng});`);
    parts.push(`relation${sel}(around:${radius},${lat},${lng});`);
  }
  return `[out:json][timeout:25];(${parts.join("")});out center tags ${RESULT_CAP};`;
}

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
export async function fetchNearbySpots({ lat, lng, category = "cafe", radius = 800 }) {
  if (typeof lat !== "number" || typeof lng !== "number") {
    throw new Error("緯度経度が不正です.");
  }
  const selectors = CATEGORY_SELECTORS[category];
  if (!selectors) {
    throw new Error("未対応のカテゴリです: " + category);
  }

  // キャッシュ確認
  const key = cacheKey(lat, lng, category, radius);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
    return cached.data;
  }

  // Overpassクエリ（node/way/relation を半径内で検索し中心点を返す）
  const query = buildOverpassQuery(selectors, lat, lng, radius);

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

// カテゴリごとに期待するタグ値を定義（OSMの誤タグ付きデータを除外するため二重検証）
const CATEGORY_TAG_CHECK = {
  cafe:        (t) => t.amenity === "cafe" || t.shop === "coffee",
  restaurant:  (t) => t.amenity === "restaurant" || t.amenity === "food_court",
  izakaya:     (t) => /^(pub|bar|biergarten)$/.test(t.amenity || "") || /izakaya/i.test(t.cuisine || ""),
  fastfood:    (t) => t.amenity === "fast_food",
  karaoke:     (t) => t.leisure === "karaoke" || t.amenity === "karaoke_box",
  convenience: (t) => t.shop === "convenience",
  park:        (t) => t.leisure === "park" || t.leisure === "garden",
};

// 居酒屋カテゴリでホール・センター等の明らかに別業態の名前を除外する
const IZAKAYA_NAME_EXCLUDE = /(?:ホール|文化センター|会館|公会堂|体育館|図書館|学校|大学|病院|クリニック|診療所|薬局|神社|寺院?|教会|郵便局|銀行|警察署|消防署|市役所|区役所|町役場)/;

// Overpassレスポンスを内部形式へ正規化する
function normalize(raw, category) {
  const seen = new Set();
  const result = [];
  const tagCheck = CATEGORY_TAG_CHECK[category];
  for (const el of raw.elements || []) {
    const tags = el.tags || {};
    // 名称が無い場合はブランド名で代替（チェーン店の取りこぼしを防ぐ）
    const name = tags.name || tags["name:ja"] || tags.brand;
    if (!name) continue;
    // タグが実際にカテゴリと一致するか検証（OSMの誤タグ付き要素を除外）
    if (tagCheck && !tagCheck(tags)) continue;
    // 居酒屋カテゴリで明らかに別業態の名前は除外
    if (category === "izakaya" && IZAKAYA_NAME_EXCLUDE.test(name)) continue;
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    // 同名でも別地点なら別店舗として残す（名前+座標で重複判定。約11m単位）
    const dedup = name + "@" + Math.round(lat * 1e4) + "," + Math.round(lng * 1e4);
    if (seen.has(dedup)) continue;
    seen.add(dedup);
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
