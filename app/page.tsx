import { HomeView } from "@/components/HomeView";
import { Footer, Hero } from "@/components/PageChrome";

/**
 * トップページ。
 *
 * 骨組みはサーバーコンポーネントのまま返し、
 * 文言の翻訳と状態を持つ部分だけをクライアントへ渡している。
 * ツールバーは履歴と状態を共有する必要があるため HomeView 側で描く。
 */
export default function HomePage() {
  return (
    <>
      <div className="aurora" aria-hidden="true" />

      <main className="app">
        <header className="hero">
          <Hero />
        </header>

        <HomeView />

        <Footer />
      </main>
    </>
  );
}
