"use client";

import { BackToHome } from "@/components/PageChrome";
import { LocaleToggle } from "@/components/LocaleToggle";
import { useTranslation } from "@/i18n/LocaleProvider";
import { HowToEn } from "@/i18n/howto/en";
import { HowToJa } from "@/i18n/howto/ja";
import { HowToKo } from "@/i18n/howto/ko";
import { HowToZh } from "@/i18n/howto/zh";
import type { Locale } from "@/i18n";

/**
 * 使い方ガイドの本文を言語ごとに差し替える。
 *
 * 短い文言（ボタン名など）は辞書へ集約しているが、この本文は
 * 見出しと段落が入り混じる長文なので、言語ごとの JSX として持つ。
 * 言語を足すときは howto/<code>.tsx を作ってここへ追加する。
 */
const HOWTO_BY_LOCALE: Record<Locale, () => React.JSX.Element> = {
  ja: HowToJa,
  en: HowToEn,
  zh: HowToZh,
  ko: HowToKo,
};

export function HowToContent() {
  const { locale, t } = useTranslation();
  const Body = HOWTO_BY_LOCALE[locale];

  return (
    <>
      <div className="toolbar" id="toolbar">
        <LocaleToggle />
      </div>

      <BackToHome />

      <header className="hero">
        <div className="hero__badge">GUIDE</div>
        <h1 className="hero__title">
          EkiHub<span className="accent">{t("nav.howto")}</span>
        </h1>
      </header>

      <div className="howto-content">
        <Body />
      </div>
    </>
  );
}
