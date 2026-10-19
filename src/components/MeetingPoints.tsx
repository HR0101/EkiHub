"use client";

import { useMemo } from "react";

import { useTranslation } from "@/i18n/LocaleProvider";
import { getMeetingPoints } from "@/lib/meetingPoints";
import type { MessageKey } from "@/i18n";
import type {
  MeetingPointType,
  RankingEntry,
  StationMeetingPoints,
} from "@/types/ekihub";

interface Props {
  station: RankingEntry;
  /** 動作確認やテスト用の任意データセット */
  dataset?: readonly StationMeetingPoints[] | StationMeetingPoints[];
}

/** スポット種別のバッジラベル用キー */
function typeLabelKey(type: MeetingPointType): MessageKey {
  return `meetingPoints.types.${type}` as MessageKey;
}

/**
 * 集合駅の待ち合わせスポット一覧。
 *
 * 同梱データ（data/meetingPoints.json）を参照し、データが存在する駅でのみ表示する。
 * データのない駅では空の枠も出さず、セクションごと非表示（null）になる。
 */
export function MeetingPoints({ station, dataset }: Props) {
  const { t } = useTranslation();

  const spots = useMemo(() => {
    return getMeetingPoints(
      station.name,
      station.lines,
      dataset,
      { lat: station.lat, lng: station.lng },
    );
  }, [station.name, station.lines, station.lat, station.lng, dataset]);

  // データが無い駅ではセクションごと非表示
  if (spots.length === 0) {
    return null;
  }

  return (
    <section className="fpanel meeting-points" aria-labelledby="meeting-points-heading">
      <div className="fpanel__head">
        <h3 id="meeting-points-heading" className="fpanel__title">
          {t("meetingPoints.title")}
        </h3>
        <span className="meeting-points__count">
          {spots.length}
        </span>
      </div>

      <ul className="meeting-points__list">
        {spots.map((spot) => (
          <li key={`${spot.name}-${spot.lat}-${spot.lng}`} className="meeting-point-card">
            <div className="meeting-point-card__header">
              <div className="meeting-point-card__title-group">
                <h4 className="meeting-point-card__name">{spot.name}</h4>
                {spot.kana && (
                  <span className="meeting-point-card__kana">{spot.kana}</span>
                )}
              </div>
              <span className={`meeting-point-badge meeting-point-badge--${spot.type}`}>
                {t(typeLabelKey(spot.type))}
              </span>
            </div>

            <div className="meeting-point-card__meta">
              {spot.exit && (
                <span className="meeting-point-card__tag meeting-point-card__tag--exit">
                  {t("meetingPoints.exit", { exit: spot.exit })}
                </span>
              )}
              {typeof spot.distanceMeters === "number" &&
                typeof spot.walkingMinutes === "number" && (
                  <span className="meeting-point-card__tag meeting-point-card__tag--distance">
                    {t("meetingPoints.distance", {
                      meters: spot.distanceMeters,
                      minutes: spot.walkingMinutes,
                    })}
                  </span>
                )}
            </div>

            <p className="meeting-point-card__description">{spot.description}</p>

            {spot.sourceUrl && (
              <div className="meeting-point-card__footer">
                <a
                  href={spot.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="meeting-point-card__source"
                >
                  {t("meetingPoints.source")}
                  <span className="meeting-point-card__external-icon" aria-hidden="true">
                    ↗
                  </span>
                </a>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
