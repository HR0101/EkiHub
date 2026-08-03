import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";

import { Providers } from "@/components/Providers";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

// Leaflet の基本スタイル。自前のCSSより先に読み込んで上書きできるようにする
import "leaflet/dist/leaflet.css";
import "./globals.css";

/**
 * 本文フォント。next/font が自ホストするので、
 * Google Fonts への外部リクエストは発生しない（CSP を絞れる）。
 */
const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
  variable: "--font-noto-sans-jp",
});

/**
 * OGP の絶対URLはここを起点に組み立てられる。
 * 旧実装の __ORIGIN__ 置換はこれで不要になった。
 */
const siteOrigin = process.env.SITE_ORIGIN ?? "https://ekihub.jp";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: "EkiHub（エキハブ）— みんなの中心駅を探す",
  description:
    "複数人の最寄駅から、全員が集まりやすい中心駅を提案するWebアプリ",
  alternates: { canonical: "/" },
  icons: {
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "EkiHub",
    title: "EkiHub — みんなの中心駅を探す",
    description:
      "複数人の最寄駅から、全員が集まりやすい中心駅を提案するWebアプリ",
    url: "/",
    locale: "ja_JP",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "EkiHub — みんなの中心駅を探す",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "EkiHub — みんなの中心駅を探す",
    description:
      "複数人の最寄駅から、全員が集まりやすい中心駅を提案するWebアプリ",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f3f7fa",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className={notoSansJp.variable} suppressHydrationWarning>
      <head>
        {/*
          保存済みテーマを描画前に当てる。React のマウントを待つと
          一瞬ライトで表示されてちらつくため、同期スクリプトで先に流す。
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
