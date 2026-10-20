// 周辺スポット取得サービス
// 集合駅の周辺にある「集まれる場所」(カフェ・居酒屋・カラオケ等)を
// OpenStreetMap(Overpass API)から取得する. キー不要・無料.
// 取得失敗は例外として返し、0件と通信エラーを区別する.

// カテゴリ -> Overpassのタグ条件（複数条件で網羅性を上げる）
// 値は OSM の amenity / leisure / shop / cuisine タグ
const CATEGORY_SELECTORS = {
  cafe: ['["amenity"="cafe"]', '["shop"="coffee"]'],
  restaurant: ['["amenity"="restaurant"]', '["amenity"="food_court"]'],
  izakaya: [
    '["amenity"="pub"]',
    '["amenity"="bar"]',
    '["amenity"="biergarten"]',
    '["cuisine"~"izakaya"]',
  ],
  fastfood: ['["amenity"="fast_food"]'],
  karaoke: ['["leisure"="karaoke"]', '["amenity"="karaoke_box"]'],
  convenience: ['["shop"="convenience"]'],
  park: ['["leisure"="park"]', '["leisure"="garden"]'],
};

// Overpassから取得する最大件数（従来40→拡大）
const RESULT_CAP = 120;

// Overpass 側に許す計算時間（秒）と、こちらが待つ上限（ミリ秒）。
// 待つ側を必ず長くしておくこと。
const OVERPASS_TIMEOUT_SEC = 20;
const REQUEST_TIMEOUT_MS = 25000;

// カテゴリのタグ条件から node/way/relation を網羅する Overpass クエリを組み立てる
function buildOverpassQuery(selectors, lat, lng, radius) {
  const parts = [];
  for (const sel of selectors) {
    parts.push(`node${sel}(around:${radius},${lat},${lng});`);
    parts.push(`way${sel}(around:${radius},${lat},${lng});`);
    parts.push(`relation${sel}(around:${radius},${lat},${lng});`);
  }
  // Overpass 側の上限は、こちらが待つ時間（REQUEST_TIMEOUT_MS）より短くする。
  // 逆にすると、サーバーがまだ計算中なのにこちらが先に切ってしまう。
  return `[out:json][timeout:${OVERPASS_TIMEOUT_SEC}];(${parts.join("")});out body center ${RESULT_CAP};`;
}

// カテゴリの表示ラベル(日本語)
export const CATEGORY_LABELS = {
  cafe: "カフェ",
  restaurant: "レストラン",
  izakaya: "居酒屋・バー",
  fastfood: "ファストフード",
  karaoke: "カラオケ",
  convenience: "コンビニ",
  park: "公園",
};

// 取得結果の簡易キャッシュ（同一地点・カテゴリの再取得を抑制）
const cache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30分

// Overpassミラー（応答が遅いときは時間差で並行取得する）
// 本家を先頭に置く。ミラーは落ちていることがあり、
// 死んでいる相手を先に試すとタイムアウトぶんだけ待たされるため、
// 稼働率の高い順に並べること。
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

// 直近で応答したエンドポイント。次回はここから試すので、
// 1つ目が落ちている状況でも2回目以降は待たされない。
let preferredEndpoint = null;

// 試す順番を組み立てる（直近で成功した相手を先頭へ）
function endpointsInOrder() {
  if (!preferredEndpoint) return ENDPOINTS;
  return [
    preferredEndpoint,
    ...ENDPOINTS.filter((e) => e !== preferredEndpoint),
  ];
}

// 異なる駅の検索範囲を混ぜないよう正確な座標でキャッシュする
function cacheKey(lat, lng, category, radius) {
  const rl = lat;
  const rg = lng;
  return `${rl},${rg},${category},${radius}`;
}

// 遅いミラーを待ち切らず、1.2秒後に次を開始。成功後は残りを中止する。
async function requestMirrors(query, signal, fetchImpl) {
  signal?.throwIfAborted();
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  signal?.addEventListener("abort", cancel, { once: true });
  const timers = [];
  try {
    return await Promise.any(
      endpointsInOrder().map(
        (endpoint, index) =>
          new Promise((resolve, reject) => {
            const abort = () =>
              reject(
                controller.signal.reason ??
                  new DOMException("Aborted", "AbortError"),
              );
            controller.signal.addEventListener("abort", abort, { once: true });
            timers.push(
              setTimeout(async () => {
                try {
                  const res = await fetchImpl(endpoint, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/x-www-form-urlencoded",
                      Accept: "application/json",
                    },
                    body: "data=" + encodeURIComponent(query),
                    signal: controller.signal,
                  });
                  if (!res.ok) {
                    const detail = (await res.text())
                      .replace(/<[^>]*>/g, " ")
                      .replace(/\s+/g, " ")
                      .slice(0, 240);
                    throw new Error(`HTTP ${res.status}: ${detail}`);
                  }
                  const raw = await res.json();
                  if (raw.remark || !Array.isArray(raw.elements))
                    throw new Error("Incomplete Overpass response");
                  preferredEndpoint = endpoint;
                  resolve(raw);
                } catch (error) {
                  const reason =
                    error?.cause?.code || error?.message || String(error);
                  reject(new Error(`${new URL(endpoint).hostname}: ${reason}`));
                } finally {
                  controller.signal.removeEventListener("abort", abort);
                }
              }, index * 1200),
            );
          }),
      ),
    );
  } finally {
    timers.forEach(clearTimeout);
    controller.abort();
    signal?.removeEventListener("abort", cancel);
  }
}

// 周辺スポットを取得する
// 引数: { lat, lng, category, radius(メートル) }
// 戻り値: [{ name, category, lat, lng, tags }]
export async function fetchNearbySpots(
  { lat, lng, category = "cafe", radius = 800 },
  signal,
  fetchImpl = fetch,
) {
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

  // Use AbortController for browsers without AbortSignal.any/timeout.
  const controller = new AbortController();
  signal?.throwIfAborted();
  const cancel = () => controller.abort(signal.reason);
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(
    () =>
      controller.abort(
        new DOMException("Spot request timed out", "TimeoutError"),
      ),
    REQUEST_TIMEOUT_MS,
  );
  let spots;
  try {
    let raw;
    try {
      raw = await requestMirrors(query, controller.signal, fetchImpl);
    } catch (error) {
      if (error instanceof AggregateError) {
        throw new Error(error.errors.map((item) => item.message).join("; "));
      }
      throw error;
    }
    spots = normalize(raw, category);
    cache.set(key, { time: Date.now(), data: spots });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
  return spots;
}

// カテゴリごとに期待するタグ値を定義（OSMの誤タグ付きデータを除外するため二重検証）
const CATEGORY_TAG_CHECK = {
  cafe: (t) => t.amenity === "cafe" || t.shop === "coffee",
  restaurant: (t) => t.amenity === "restaurant" || t.amenity === "food_court",
  izakaya: (t) =>
    /^(pub|bar|biergarten)$/.test(t.amenity || "") ||
    /izakaya/i.test(t.cuisine || ""),
  fastfood: (t) => t.amenity === "fast_food",
  karaoke: (t) => t.leisure === "karaoke" || t.amenity === "karaoke_box",
  convenience: (t) => t.shop === "convenience",
  park: (t) => t.leisure === "park" || t.leisure === "garden",
};

// 居酒屋カテゴリでホール・センター等の明らかに別業態の名前を除外する
const IZAKAYA_NAME_EXCLUDE =
  /(?:ホール|文化センター|会館|公会堂|体育館|図書館|学校|大学|病院|クリニック|診療所|薬局|神社|寺院?|教会|郵便局|銀行|警察署|消防署|市役所|区役所|町役場)/;

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
    const dedup =
      name + "@" + Math.round(lat * 1e4) + "," + Math.round(lng * 1e4);
    if (seen.has(dedup)) continue;
    seen.add(dedup);
    result.push({
      name,
      category,
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
      tags: {
        cuisine: tags.cuisine || null,
        opening_hours: tags.opening_hours || null,
      },
    });
  }
  return result;
}
