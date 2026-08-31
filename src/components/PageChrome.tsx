"use client";

import Link from "next/link";

import { HistoryPanel } from "@/components/HistoryPanel";
import { LocaleToggle } from "@/components/LocaleToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTranslation } from "@/i18n/LocaleProvider";
import type { HistoryEntry } from "@/hooks/useSearchHistory";

/**
 * ページの外枠（見出し・ツールバー・フッター）。
 *
 * 文言を翻訳するにはクライアント側で言語を知る必要があるため、
 * サーバーコンポーネントの page.tsx から切り出している。
 */

interface ToolbarProps {
  history?: {
    entries: HistoryEntry[];
    onRestore: (entry: HistoryEntry) => void;
    onToggleFavorite: (id: string) => void;
    onRemove: (id: string) => void;
  };
}

export function Toolbar({ history }: ToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="toolbar" id="toolbar">
      <LocaleToggle />
      <Link href="/howto" className="tool-btn">
        {t("nav.howto")}
      </Link>
      <ThemeToggle />
      {history && (
        <HistoryPanel
          entries={history.entries}
          onRestore={history.onRestore}
          onToggleFavorite={history.onToggleFavorite}
          onRemove={history.onRemove}
        />
      )}
    </div>
  );
}

export function Hero() {
  const { t } = useTranslation();

  return (
    <>
      <div className="hero__badge">{t("hero.badge")}</div>
      <h1 className="hero__title">
        {t("hero.titleBefore")}
        <span className="accent">{t("hero.titleAccent")}</span>
        {t("hero.titleAfter")}
      </h1>
      <p className="hero__lead">{t("hero.lead")}</p>
    </>
  );
}

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="foot">
      <p>{t("footer.text")}</p>
    </footer>
  );
}

export function BackToHome() {
  const { t } = useTranslation();

  return (
    <nav className="top-nav">
      <Link href="/" className="nav-link">
        {t("nav.home")}
      </Link>
    </nav>
  );
}
