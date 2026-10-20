"use client";

import { useState } from "react";

import { useTranslation } from "@/i18n/LocaleProvider";
import type { RankingEntry, SpotCategory } from "@/types/ekihub";

interface Props {
  station: RankingEntry;
}

/** 表示順（文言は辞書の spots.categories から引く） */
const CATEGORIES: SpotCategory[] = [
  "cafe",
  "restaurant",
  "fastfood",
  "izakaya",
  "karaoke",
  "convenience",
  "park",
];

/** 集合駅の周辺で集まれる場所を探す */
export function NearbySpots({ station }: Props) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<SpotCategory | null>(null);

  return (
    <details className="disclosure nearby-spots">
      <summary>
        <h3 className="fpanel__title">{t("spots.title")}</h3>
      </summary>
      <div className="nearby-spots__content">
        <p className="spot-note">
          {t("spots.mapHint", { station: station.name })}
        </p>
        <div className="spot-controls">
          {CATEGORIES.map((option) => (
            <button
              key={option}
              type="button"
              className={`tool-btn ${category === option ? "is-active" : ""}`}
              aria-pressed={category === option}
              onClick={() => setCategory(option)}
            >
              {t(`spots.categories.${option}`)}
            </button>
          ))}
        </div>

        <div className="spot-controls spot-controls--map">
          <a
            className="tool-btn"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t("spots.mapQuery", { station: station.name, category: category ? t(`spots.categories.${category}`) : "" }).trim())}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("spots.openMap")}
          </a>
        </div>
      </div>
    </details>
  );
}
