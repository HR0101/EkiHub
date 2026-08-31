"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useTranslation } from "@/i18n/LocaleProvider";
import { fetchSpotsWithFallback } from "@/lib/spots";
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

const RADIUS_OPTIONS = [400, 800, 1500] as const;

/** 表示する最大件数（Overpass は数百件返すことがある） */
const MAX_VISIBLE = 20;

/** 集合駅の周辺で集まれる場所を探す */
export function NearbySpots({ station }: Props) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<SpotCategory | null>(null);
  const [radius, setRadius] = useState<number>(800);

  const spotsQuery = useQuery({
    // 駅・カテゴリ・半径の組み合わせごとにキャッシュする
    queryKey: ["spots", station.name, category, radius],
    queryFn: async ({ signal }) => {
      // enabled で null を弾いているので、ここに来る時点で必ず選ばれている
      if (category === null) throw new Error("category is required");
      const result = await fetchSpotsWithFallback(
        { lat: station.lat, lng: station.lng, category, radius },
        signal
      );
      return result.spots;
    },
    // カテゴリを選ぶまでは問い合わせない
    enabled: category !== null,
  });

  return (
    <section className="fpanel" aria-label={t("spots.title")}>
      <h3 className="fpanel__title">{t("spots.title")}</h3>

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

      <div className="spot-controls spot-controls--radius">
        <span className="spot-controls__label">{t("spots.radiusLabel")}</span>
        {RADIUS_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            className={`tool-btn ${radius === option ? "is-active" : ""}`}
            aria-pressed={radius === option}
            onClick={() => setRadius(option)}
          >
            {option >= 1000 ? `〜${option / 1000}km` : `〜${option}m`}
          </button>
        ))}
      </div>

      {category === null && (
        <p className="spot-note">{t("spots.chooseCategory")}</p>
      )}

      {spotsQuery.isPending && category !== null && (
        <p className="spot-note">{t("spots.searching")}</p>
      )}

      {spotsQuery.isError && (
        <p className="spot-note">{t("spots.failed")}</p>
      )}

      {spotsQuery.isSuccess && spotsQuery.data.length === 0 && (
        <p className="spot-note">{t("spots.empty")}</p>
      )}

      {spotsQuery.isSuccess && spotsQuery.data.length > 0 && (
        <>
          <ul className="spot-list">
            {spotsQuery.data.slice(0, MAX_VISIBLE).map((spot) => (
              <li className="spot-item" key={`${spot.name}-${spot.lat}-${spot.lng}`}>
                <span className="spot-item__name">{spot.name}</span>
                {spot.tags.opening_hours && (
                  <span className="spot-item__meta">
                    {spot.tags.opening_hours}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {spotsQuery.data.length > MAX_VISIBLE && (
            <p className="spot-note">
              {t("spots.more", {
                count: spotsQuery.data.length - MAX_VISIBLE,
                limit: MAX_VISIBLE,
              })}
            </p>
          )}
        </>
      )}
    </section>
  );
}
