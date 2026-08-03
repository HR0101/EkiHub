"use client";

import type { TravelTime } from "@/types/ekihub";

interface Props {
  travelTimes: readonly TravelTime[];
}

/** 各最寄駅からの所要時間。棒の長さは一番遠い人を基準にした相対値 */
export function TravelList({ travelTimes }: Props) {
  if (travelTimes.length === 0) return null;

  const maxMinutes = Math.max(...travelTimes.map((t) => t.minutes), 1);

  return (
    <div className="travel-list">
      <h4 className="travel-list__title">各最寄駅からの所要時間（推定）</h4>
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
                乗換{travel.transfers}回
              </span>
            ) : (
              travel.directPossible && (
                <span className="badge badge--direct">直通</span>
              )
            )}
            <span className="travel-item__min">{travel.minutes}分</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
