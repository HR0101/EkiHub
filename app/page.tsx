import { loadStations } from "@/server/stationRepository";

/**
 * トップページ。
 *
 * いまは移行の土台が動くことを確かめるための最小構成で、
 * 駅マスタの読み込み（サーバー側）だけを行っている。
 * 入力フォーム・地図・結果表示はこのあとクライアントコンポーネントとして載せる。
 */
export default async function HomePage() {
  const stations = await loadStations();
  const majorCount = stations.filter((station) => station.isMajor).length;

  return (
    <>
      <div className="aurora" aria-hidden="true" />

      <main className="app">
        <header className="hero">
          <div className="hero__badge">EkiHub</div>
          <h1 className="hero__title">
            みんなの<span className="accent">中心駅</span>を探す
          </h1>
          <p className="hero__lead">
            複数人の最寄駅を入力すると、全員が集まりやすい駅を提案します。
          </p>
        </header>

        <section className="panel" aria-label="移行状況">
          <h2 className="panel__title">移行中です</h2>
          <p>
            Next.js + TypeScript への移行を進めています。
            サーバー側の駅マスタとAPIはすでに動いています。
          </p>
          <div className="metrics" style={{ marginTop: 18 }}>
            <div className="metric">
              <span className="metric__value">
                {stations.length.toLocaleString("ja-JP")}
              </span>
              <span className="metric__label">読み込み済みの駅</span>
            </div>
            <div className="metric">
              <span className="metric__value">
                {majorCount.toLocaleString("ja-JP")}
              </span>
              <span className="metric__label">うち主要駅</span>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
