"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { fetchSpotsWithFallback } from "@/lib/spots";
import type { RankingEntry, SpotCategory } from "@/types/ekihub";

interface Props {
  station: RankingEntry;
}

const CATEGORIES: { value: SpotCategory; label: string }[] = [
  { value: "cafe", label: "カフェ" },
  { value: "restaurant", label: "レストラン" },
  { value: "fastfood", label: "ファストフード" },
  { value: "izakaya", label: "居酒屋・バー" },
  { value: "karaoke", label: "カラオケ" },
  { value: "convenience", label: "コンビニ" },
  { value: "park", label: "公園" },
];

const RADIUS_OPTIONS = [400, 800, 1500] as const;

/** 表示する最大件数（Overpass は数百件返すことがある） */
const MAX_VISIBLE = 20;

/** 集合駅の周辺で集まれる場所を探す */
export function NearbySpots({ station }: Props) {
  const [category, setCategory] = useState<SpotCategory | null>(null);
  const [radius, setRadius] = useState<number>(800);

  const spotsQuery = useQuery({
    // 駅・カテゴリ・半径の組み合わせごとにキャッシュする
    queryKey: ["spots", station.name, category, radius],
    queryFn: async ({ signal }) => {
      // enabled で null を弾いているので、ここに来る時点で必ず選ばれている
      if (category === null) throw new Error("カテゴリが選ばれていません");
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
    <section className="fpanel" aria-label="周辺スポット">
      <h3 className="fpanel__title">周辺スポット</h3>

      <div className="spot-controls">
        {CATEGORIES.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`tool-btn ${category === option.value ? "is-active" : ""}`}
            aria-pressed={category === option.value}
            onClick={() => setCategory(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="spot-controls spot-controls--radius">
        <span className="spot-controls__label">範囲</span>
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
        <p className="spot-note">カテゴリを選んでください</p>
      )}

      {spotsQuery.isPending && category !== null && (
        <p className="spot-note">探しています…</p>
      )}

      {spotsQuery.isError && (
        <p className="spot-note">
          周辺スポットを取得できませんでした。時間をおいて試してください。
        </p>
      )}

      {spotsQuery.isSuccess && spotsQuery.data.length === 0 && (
        <p className="spot-note">この範囲では見つかりませんでした。</p>
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
              ほか {spotsQuery.data.length - MAX_VISIBLE} 件（上位
              {MAX_VISIBLE}件のみ表示）
            </p>
          )}
        </>
      )}
    </section>
  );
}
