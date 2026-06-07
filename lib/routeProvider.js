// 経路プロバイダ
// 役割: 駅間の「所要時間(分)・運賃(円)・乗換回数」を返す共通インターフェースを提供する.
//
// 設計:
//   - 環境変数で利用プロバイダを選択する. 未設定なら null を返し、
//     呼び出し側(centerLogic)は距離からの概算へ自動フォールバックする.
//   - 全候補(最大約2000駅)をAPIで叩くのは非現実的なため、centerLogic 側で
//     距離ベースの絞り込み後の「finalists」のみに対してこのプロバイダを使う.
//   - 返り値は { minutes, fareYen, transfers }（取得できない項目は null）.
//
// 対応プロバイダ:
//   ROUTING_PROVIDER=otp  : OpenTripPlanner(自前ホスト・無料・キー不要)
//     ROUTING_OTP_URL に OTP2 の GraphQL エンドポイントを設定する
//     例: http://localhost:8080/otp/routers/default/index/graphql
//   （将来: 駅すぱあと/NAVITIME 等は makeProviderFromEnv に分岐を追加すれば差し替え可能）

// 取得結果の簡易キャッシュ（同一区間の再問い合わせを抑制）。プロセス生存中保持.
const routeCache = new Map();

function cacheKey(origin, candidate) {
  return `${origin.name}__${candidate.name}`;
}

// 指定ミリ秒でタイムアウトするfetch
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ── OpenTripPlanner(OTP2) アダプタ ───────────────────────────────
// 自前で立てたOTPサーバへGraphQLでプランを問い合わせ、所要時間・乗換・運賃を取り出す.
function makeOtpProvider(endpoint, timeoutMs) {
  return async (origin, candidate) => {
    // GraphQLクエリ（座標は数値のため文字列直挿しでも安全）
    const query = `{
      plan(
        from: { lat: ${origin.lat}, lon: ${origin.lng} },
        to: { lat: ${candidate.lat}, lon: ${candidate.lng} },
        transportModes: [{ mode: TRANSIT }, { mode: WALK }],
        numItineraries: 1
      ) {
        itineraries {
          duration
          legs { mode }
          fares { type cents currency }
        }
      }
    }`;

    const res = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query })
      },
      timeoutMs
    );
    if (!res.ok) throw new Error("OTP応答エラー: " + res.status);
    const json = await res.json();

    const itinerary = json?.data?.plan?.itineraries?.[0];
    if (!itinerary) return null;

    // 所要時間: 秒 -> 分
    const minutes =
      typeof itinerary.duration === "number"
        ? Math.round(itinerary.duration / 60)
        : null;

    // 乗換回数: 鉄道(WALK以外)のレッグ数 - 1
    const transitLegs = Array.isArray(itinerary.legs)
      ? itinerary.legs.filter((l) => l && l.mode && l.mode !== "WALK").length
      : 0;
    const transfers = transitLegs > 0 ? transitLegs - 1 : 0;

    // 運賃: GTFSに運賃情報がある場合のみ取得できる. regular運賃を優先.
    let fareYen = null;
    if (Array.isArray(itinerary.fares) && itinerary.fares.length > 0) {
      const regular =
        itinerary.fares.find((f) => f && f.type === "regular") || itinerary.fares[0];
      if (regular && typeof regular.cents === "number") {
        // JPYは少数を持たないため cents をそのまま円とみなす（GTFS-JPの慣例）
        fareYen = Math.round(regular.cents);
      }
    }

    return { minutes, fareYen, transfers };
  };
}

// 環境変数からプロバイダを生成する. 対象外なら null（=フォールバック）.
export function makeProviderFromEnv(env = process.env) {
  const provider = (env.ROUTING_PROVIDER || "").toLowerCase();
  const timeoutMs = Number(env.ROUTING_TIMEOUT_MS) > 0 ? Number(env.ROUTING_TIMEOUT_MS) : 8000;

  let base = null;
  if (provider === "otp" && env.ROUTING_OTP_URL) {
    base = makeOtpProvider(env.ROUTING_OTP_URL, timeoutMs);
  }
  // 他プロバイダ（駅すぱあと/NAVITIME等）はここに分岐を追加して差し替える.

  if (!base) return null;

  // キャッシュ＋失敗時nullラッパ（呼び出し側は安全にフォールバックできる）
  return async (origin, candidate) => {
    const key = cacheKey(origin, candidate);
    if (routeCache.has(key)) return routeCache.get(key);
    try {
      const result = await base(origin, candidate);
      routeCache.set(key, result);
      return result;
    } catch (error) {
      console.error(`[routeProvider] 取得失敗(${key}):`, error.message);
      routeCache.set(key, null); // 失敗もキャッシュし連続失敗を避ける
      return null;
    }
  };
}

// テスト用にキャッシュをクリアする
export function clearRouteCache() {
  routeCache.clear();
}
