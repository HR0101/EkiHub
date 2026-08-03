import type { NextConfig } from "next";

/**
 * Content-Security-Policy
 *
 * 旧 server.js から引き継いだ方針（外部は地図タイルと Overpass のみ許可）を保ちつつ、
 * Next.js の都合に合わせて調整している。
 *   - Leaflet / QRコードは npm から読むため、外部 CDN の許可は不要になった
 *   - フォントは next/font で自ホストするため font-src は 'self' のみ
 *   - Next.js はハイドレーション用のインラインスクリプトを埋め込むため
 *     'unsafe-inline' が必要（開発時は HMR のため 'unsafe-eval' も要る）
 * 値を変えると地図やフォントが壊れるので、利用元が増えた時だけ慎重に更新すること。
 */
function contentSecurityPolicy(isDev: boolean): string {
  const scriptSrc = isDev
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : "'self' 'unsafe-inline'";

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://*.tiles.openrailwaymap.org",
    // 自APIと、ブラウザから直接叩く Overpass ミラー
    "connect-src 'self' https://overpass-api.de https://overpass.private.coffee https://overpass.kumi.systems",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

const nextConfig: NextConfig = {
  // Oracle VM へは .next/standalone をそのまま置いて node server.js で起動する
  output: "standalone",
  reactStrictMode: true,

  // 旧 server.js のセキュリティヘッダをそのまま引き継ぐ
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy(isDev) },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // 現在地の取得機能を廃止したため geolocation も閉じている
            value: "geolocation=(), camera=(), microphone=(), payment=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
