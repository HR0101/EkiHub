import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "使い方 - EkiHub",
  description: "EkiHubの使い方ガイド",
};

/** 使い方ガイド。内容が変わらないので静的に配信される */
export default function HowToPage() {
  return (
    <>
      <div className="aurora" aria-hidden="true" />

      <main className="app">
        <nav className="top-nav">
          <Link href="/" className="nav-link">
            ← ホームに戻る
          </Link>
        </nav>

        <header className="hero">
          <div className="hero__badge">GUIDE</div>
          <h1 className="hero__title">
            EkiHubの<span className="accent">使い方</span>
          </h1>
        </header>

        <div className="howto-content">
          <h2>基本的な使い方</h2>
          <p>
            EkiHubは、複数人の最寄駅から、全員が集まりやすい「中心駅」を見つけるためのツールです。
          </p>

          <h3>1. 駅を入力する</h3>
          <p>
            トップページの左側にある「最寄駅を入力」パネルで、参加者の最寄駅を入力します。
            <br />
            「＋ 駅を追加」ボタンで、入力欄を増やすことができます（3人以上の集まりでも利用可能です）。
          </p>

          <h3>2. 候補の絞り込みを設定する</h3>
          <p>目的に合わせて、探索モードを切り替えます。</p>
          <ul>
            <li>
              <strong>主要駅限定：</strong>
              新宿や渋谷、東京など、乗り換えが便利で周辺にお店が多い大きな駅だけを候補にします（飲み会や遊びに最適です）。
            </li>
            <li>
              <strong>規模不問：</strong>
              純粋に移動時間が最も短くなる駅を探します（ローカルな駅も含まれます）。
            </li>
          </ul>

          <h3>3. 重視ポイントを調整する</h3>
          <p>スライダーを使って、以下のバランスを調整できます。</p>
          <ul>
            <li>
              <strong>近さ重視：</strong>
              全員の合計移動時間が最も短くなる駅を選びます（全体的な効率優先）。
            </li>
            <li>
              <strong>公平さ重視：</strong>
              特定の人が遠くならないよう、全員の移動時間の「ばらつき」が少ない駅を選びます（平等優先）。
            </li>
            <li>
              <strong>運賃の重視度：</strong>
              交通費の平均が安くなる駅を優先します。
            </li>
          </ul>

          <h3>4. 算出する</h3>
          <p>
            「中心駅を算出する」ボタンを押すと、最適な駅が提案され、右側に結果が表示されます。
            <br />
            各駅からの所要時間や、地図上での位置関係を確認できます。
            候補駅ランキングから別の駅を選ぶと、その駅を基準にした所要時間へ切り替わります。
          </p>
        </div>
      </main>
    </>
  );
}
