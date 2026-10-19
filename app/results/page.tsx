import { HomeView } from "@/components/HomeView";
import { Footer } from "@/components/PageChrome";
import "../home.css";

export default function ResultsPage() {
  return (
    <>
      <div className="aurora" aria-hidden="true" />
      <main className="app home-app">
        <HomeView page="results" />
        <Footer />
      </main>
    </>
  );
}
