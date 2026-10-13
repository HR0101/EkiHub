"use client";

import { LocaleToggle } from "@/components/LocaleToggle";
import { BackToHome, Footer } from "@/components/PageChrome";
import type { MessageKey } from "@/i18n";
import { useTranslation } from "@/i18n/LocaleProvider";

/**
 * 利用規約・プライバシーポリシー・データ出典の共通の外枠。
 *
 * 本文は日本語だけを正本とし、言語ごとには訳さない。
 * 法的な文書は訳のずれがそのまま解釈の違いになるため。
 * 日本語以外を選んでいるときは、その言語で「日本語のみ」と添える。
 *
 * 本文は page.tsx（サーバーコンポーネント）から children で受け取るので、
 * 言語切替に関係なく最初の HTML に含まれる（検索エンジンにも読める）。
 */

interface LegalPageProps {
  /** タイトル上の小さなラベル（英字） */
  badge: string;
  /** ページ名の辞書キー。フッターのリンク名と同じ文言を使う */
  titleKey: MessageKey;
  children: React.ReactNode;
}

export function LegalPage({ badge, titleKey, children }: LegalPageProps) {
  const { locale, t } = useTranslation();

  return (
    <>
      <div className="toolbar" id="toolbar">
        <LocaleToggle />
      </div>

      <BackToHome />

      <header className="hero">
        <div className="hero__badge">{badge}</div>
        <h1 className="hero__title">
          <span className="accent">{t(titleKey)}</span>
        </h1>
      </header>

      {locale !== "ja" && (
        <p className="legal-notice" role="note">
          {t("legal.japaneseOnly")}
        </p>
      )}

      <article className="howto-content legal-content" lang="ja">
        {children}
      </article>

      <Footer />
    </>
  );
}
