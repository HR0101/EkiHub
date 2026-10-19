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
      <div className="hero__badge">
        <svg className="hero__mark" width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <path d="M6 5v7a5 5 0 0 0 5 5h6a5 5 0 0 1 5 5v1M22 5v2a5 5 0 0 1-5 5h-6a5 5 0 0 0-5 5v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="6" cy="5" r="2.5" fill="currentColor" />
          <circle cx="22" cy="5" r="2.5" fill="currentColor" />
          <circle cx="14" cy="14.5" r="3" fill="var(--nm-surface)" stroke="currentColor" strokeWidth="2" />
        </svg>
        {t("hero.badge")}
      </div>
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
      <nav className="foot__links" aria-label={t("legal.linksLabel")}>
        <Link href="/terms">{t("legal.terms")}</Link>
        <Link href="/privacy">{t("legal.privacy")}</Link>
        <Link href="/credits">{t("legal.credits")}</Link>
      </nav>
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
