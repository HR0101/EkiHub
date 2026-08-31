"use client";

import { LOCALES, LOCALE_LABELS } from "@/i18n";
import { useTranslation } from "@/i18n/LocaleProvider";

/** 表示言語の切替。選択肢はその言語自身の表記で並べる */
export function LocaleToggle() {
  const { locale, setLocale, t } = useTranslation();

  return (
    <div
      className="locale-toggle"
      role="group"
      aria-label={t("locale.dialogLabel")}
    >
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          className={`locale-toggle__option ${locale === option ? "is-active" : ""}`}
          aria-pressed={locale === option}
          lang={option}
          onClick={() => setLocale(option)}
        >
          {LOCALE_LABELS[option]}
        </button>
      ))}
    </div>
  );
}
