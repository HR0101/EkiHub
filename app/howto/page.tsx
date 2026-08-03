import type { Metadata } from "next";

import { HowToContent } from "@/components/HowToContent";

export const metadata: Metadata = {
  title: "使い方 - EkiHub",
  description: "EkiHubの使い方ガイド",
};

/**
 * 使い方ガイド。
 * 本文は表示言語で切り替わるため、中身はクライアント側で描く。
 */
export default function HowToPage() {
  return (
    <>
      <div className="aurora" aria-hidden="true" />

      <main className="app">
        <HowToContent />
      </main>
    </>
  );
}
