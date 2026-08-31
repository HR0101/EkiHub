"use client";

import { useTranslation } from "@/i18n/LocaleProvider";
import type { TravelTime } from "@/types/ekihub";

interface Props {
  travelTimes: readonly TravelTime[];
}

/** 各最寄駅からの所要時間。棒の長さは一番遠い人を基準にした相対値 */
export function TravelList({ travelTimes }: Props) {
  const { t } = useTranslation();
  if (travelTimes.length === 0) return null;

  const maxMinutes = Math.max(...travelTimes.map((t) => t.minutes), 1);

  return (
    <div className="travel-list">
      <h4 className="travel-list__title">{t("travel.title")}</h4>
      <ul>
        {travelTimes.map((travel) => (
          <li className="travel-item" key={travel.from}>
            <span className="travel-item__name">{travel.from}</span>
            <span className="travel-item__bar">
              <span
                className="travel-item__fill"
                style={{ width: `${(travel.minutes / maxMinutes) * 100}%` }}
              />
            </span>
            {travel.fareYen > 0 && (
              <span className="travel-item__fare">
                ¥{travel.fareYen.toLocaleString("ja-JP")}
              </span>
            )}
            {typeof travel.transfers === "number" ? (
              <span className="badge badge--transfer">
                {t("travel.transfer", { count: travel.transfers })}
              </span>
            ) : (
              travel.directPossible && (
                <span className="badge badge--direct">{t("travel.direct")}</span>
              )
            )}
            <span className="travel-item__min">
              {t("travel.minutes", { count: travel.minutes })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
