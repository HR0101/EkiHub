"use client";

import Link from "next/link";
import { LocaleToggle } from "@/components/LocaleToggle";
import { useTranslation } from "@/i18n/LocaleProvider";

export function NotFoundContent() {
  const { t } = useTranslation();
  return (
    <main className="app not-found-page">
      <div className="not-found-page__locale"><LocaleToggle /></div>
      <section className="not-found-card" aria-labelledby="not-found-title">
        <span className="not-found-card__code">404</span>
        <h1 id="not-found-title">{t("notFound.title")}</h1>
        <p>{t("notFound.description")}</p>
        <div className="not-found-card__actions">
          <Link className="not-found-card__home" href="/">{t("nav.home")}</Link>
          <Link href="/howto">{t("nav.howto")}</Link>
        </div>
      </section>
    </main>
  );
}
