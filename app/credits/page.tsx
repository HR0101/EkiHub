import type { Metadata } from "next";

import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL, CREDITS_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "データ出典・ライセンス - EkiHub",
  description: "EkiHubが利用しているデータとソフトウェアの出典・ライセンス",
  // ルートの canonical（/）を引き継がないよう、自身のURLを明示する
  alternates: { canonical: "/credits" },
};

/** 国土数値情報（駅別乗降客数）の配布ページ。data/ridership.json の元データ（S12-23） */
const RIDERSHIP_SOURCE_URL =
  "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-S12-2023.html";

/** 出典表示に載せる主なオープンソースソフトウェア（package.json の dependencies から） */
const SOFTWARE_LICENSES = [
  { name: "Next.js", license: "MIT License" },
  { name: "React", license: "MIT License" },
  { name: "Leaflet", license: "BSD 2-Clause License" },
  { name: "React Leaflet", license: "Hippocratic License 2.1" },
  { name: "TanStack Query", license: "MIT License" },
  { name: "Zustand", license: "MIT License" },
  { name: "node-qrcode", license: "MIT License" },
  { name: "Noto Sans JP / M PLUS Rounded 1c（フォント）", license: "SIL Open Font License 1.1" },
] as const;

/**
 * データ出典・ライセンス。
 *
 * 各データの提供元が求める表示（出典・加工の旨・免責文）をまとめて載せる。
 * データソースを足したり、data/ 以下の元データを差し替えたりしたときは、ここも更新すること。
 */
export default function CreditsPage() {
  return (
    <>
      <div className="aurora" aria-hidden="true" />

      <main className="app">
        <LegalPage badge="CREDITS" titleKey="legal.credits">
          <p>
            EkiHub（以下「本サービス」といいます。）は、次のオープンデータ・外部サービス・ソフトウェアを利用しています。各データの権利は提供元に帰属し、それぞれのライセンスに従って利用しています。
          </p>

          <h2>駅の位置情報（OpenStreetMap）</h2>
          <p>
            駅の位置・路線の情報は、OpenStreetMap のデータを利用しています。駅の位置情報は、本サービスで読み仮名の補完や重複する駅の統合などの加工を行っています。
          </p>
          <ul>
            <li>出典：© OpenStreetMap contributors</li>
            <li>
              ライセンス：
              <a
                href="https://opendatacommons.org/licenses/odbl/1-0/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Database License（ODbL）1.0
              </a>
            </li>
            <li>
              詳細：
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
              >
                https://www.openstreetmap.org/copyright
              </a>
            </li>
          </ul>

          <h2>駅別乗降客数（国土数値情報）</h2>
          <p>
            主要駅の判定に使う駅別乗降客数は、次のデータを加工して作成しています。
          </p>
          <ul>
            <li>
              「国土数値情報（駅別乗降客数データ）」（国土交通省）（
              <a href={RIDERSHIP_SOURCE_URL} target="_blank" rel="noopener noreferrer">
                {RIDERSHIP_SOURCE_URL}
              </a>
              ）を加工して作成
            </li>
            <li>
              ライセンス：
              <a
                href="https://creativecommons.org/licenses/by/4.0/deed.ja"
                target="_blank"
                rel="noopener noreferrer"
              >
                クリエイティブ・コモンズ 表示 4.0 国際（CC BY 4.0）
              </a>
            </li>
          </ul>

          <h2>鉄道の運行情報・駅データ（公共交通オープンデータセンター）</h2>
          <p>
            鉄道の運行情報と一部の駅データは、
            <a href="https://www.odpt.org/" target="_blank" rel="noopener noreferrer">
              公共交通オープンデータセンター
            </a>
            から取得しています。
          </p>
          <p className="legal-quote">
            本サービスで利用する公共交通データは、公共交通オープンデータセンターにおいて提供されるものです。公共交通事業者により提供されたデータを元にしていますが、必ずしも正確・完全なものとは限りません。本サービスの表示内容について、公共交通事業者への直接の問い合わせは行わないでください。本サービスに関するお問い合わせは、以下のメールアドレスにお願いします。
            <br />
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>

          <h2>地図</h2>
          <ul>
            <li>
              背景地図：
              <a
                href="https://maps.gsi.go.jp/development/ichiran.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                地理院タイル
              </a>
              （国土地理院の淡色地図）
            </li>
            <li>
              鉄道路線の重ね合わせ：
              <a href="https://www.openrailwaymap.org/" target="_blank" rel="noopener noreferrer">
                OpenRailwayMap
              </a>
              （表示スタイル CC BY-SA 2.0）、地図データ © OpenStreetMap contributors
            </li>
          </ul>

          <h2>ソフトウェア</h2>
          <p>本サービスは、主に次のオープンソースソフトウェアを利用しています。</p>
          <div className="legal-table-wrap">
            <table>
              <caption>表1　主なオープンソースソフトウェア</caption>
              <thead>
                <tr>
                  <th scope="col">名称</th>
                  <th scope="col">ライセンス</th>
                </tr>
              </thead>
              <tbody>
                {SOFTWARE_LICENSES.map((item) => (
                  <tr key={item.name}>
                    <th scope="row">{item.name}</th>
                    <td>{item.license}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="legal-meta">{CREDITS_UPDATED} 更新</p>
        </LegalPage>
      </main>
    </>
  );
}
