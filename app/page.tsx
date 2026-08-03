import { HomeView } from "@/components/HomeView";

/**
 * トップページ。
 *
 * 見出しまわりはサーバーコンポーネントのまま静的に返し、
 * 入力と結果表示（状態を持つ部分）だけをクライアントへ渡している。
 */
export default function HomePage() {
  return (
    <>
      <div className="aurora" aria-hidden="true" />

      <main className="app">
        <header className="hero">
          <div className="toolbar" id="toolbar">
            <a href="/howto" className="tool-btn">
              使い方
            </a>
          </div>
          <div className="hero__badge">EkiHub</div>
          <h1 className="hero__title">
            みんなの<span className="accent">中心駅</span>を探す
          </h1>
          <p className="hero__lead">
            複数人の最寄駅を入力すると、全員が集まりやすい駅を提案します。
          </p>
        </header>

        <HomeView />

        <footer className="foot">
          <p>
            EkiHub — 重心＋移動時間補正アルゴリズムによる中心駅提案 / 地図データ
            © OpenStreetMap contributors
          </p>
        </footer>
      </main>
    </>
  );
}
