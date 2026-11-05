"use client";

import { ResultActions } from "@/components/ResultActions";
import { MeetingJourney } from "@/components/MeetingJourney";
import { useTranslation } from "@/i18n/LocaleProvider";
import type { MessageKey } from "@/i18n";
import type { CenterResult, RankingEntry } from "@/types/ekihub";

interface Props {
  result: CenterResult | null;
  station: RankingEntry | null;
  /** 空の状態から例をすぐ試せるようにする */
  onQuickStart: (origins: string[]) => void;
}

/**
 * 空のときに出す試し打ち用の組み合わせ。
 * どれも駅マスタに必ずある主要駅から選んでいる。
 */
const QUICK_STARTS: string[][] = [
  ["新宿", "横浜"],
  ["渋谷", "大宮"],
  ["東京", "川崎", "船橋"],
];

/** 円マーク付きの金額。0 円のときは「—」 */
function formatYen(value: number): string {
  return value > 0 ? `¥${value.toLocaleString("ja-JP")}` : "—";
}

/** 所要時間をどう求めたかを示す文言のキー */
function routingSourceKey(
  result: CenterResult,
  station: RankingEntry,
): MessageKey {
  if (result.routingRefined || station.routed) return "result.sourceRouted";
  if (result.routingMethod === "graph") return "result.sourceGraph";
  return "result.sourceStraight";
}

/** 提案された中心駅（またはランキングから選んだ候補駅）を表示する */
export function ResultCard({ result, station, onQuickStart }: Props) {
  const { t } = useTranslation();

  /** 駅の見出し行（読みがな・規模） */
  function stationSubtitle(entry: RankingEntry): string {
    const parts = [entry.kana];
    if (entry.isMajor) parts.push(t("result.majorStation"));
    if (entry.ridership) {
      parts.push(
        t("result.ridership", { man: Math.round(entry.ridership / 10000) }),
      );
    }
    return parts.join(" ・");
  }

  // 空の状態は次の操作と、入力なしで試せる例に絞る。
  if (!result || !station) {
    return (
      <div className="result-card is-empty">
        <div className="result-card__empty">
          <MeetingJourney />
          <h3 className="result-card__empty-title">{t("result.emptyTitle")}</h3>
          <p className="result-card__empty-lead">{t("result.emptyLead")}</p>

          <div className="quick-start">
            <span className="quick-start__label">
              {t("result.quickStartLabel")}
            </span>
            <div className="quick-start__items">
              {QUICK_STARTS.map((origins) => (
                <button
                  key={origins.join("-")}
                  type="button"
                  className="tool-btn"
                  onClick={() => onQuickStart(origins)}
                >
                  {origins.join(" × ")}
                </button>
              ))}
            </div>
          </div>

          <details className="disclosure empty-details">
            <summary>{t("result.detailsLabel")}</summary>
            <ul className="result-card__points">
              <li>{t("result.emptyPoint1")}</li>
              <li>{t("result.emptyPoint2")}</li>
              <li>{t("result.emptyPoint3")}</li>
            </ul>
          </details>
        </div>
      </div>
    );
  }

  const isTop = result.best.name === station.name;
  const transfers =
    typeof station.averageTransfers === "number"
      ? t("result.transfers", { count: station.averageTransfers })
      : "";

  return (
    <div className="result-card">
      <div className="result-card__content">
        <div className="result-card__identity" key={station.name}>
          <span className="result-card__eyebrow">
            {t(isTop ? "result.eyebrowBest" : "result.eyebrowSelected")}
          </span>
          <h3 className="result-card__name">{station.name}</h3>
          <p className="result-card__kana">{stationSubtitle(station)}</p>
        </div>

        <ul className="chips">
          {station.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <div className="metrics">
          <div className="metric">
            <span className="metric__value">{station.averageMinutes}</span>
            <span className="metric__label">{t("result.avgMinutes")}</span>
          </div>
          <div className="metric">
            <span className="metric__value">±{station.fairness}</span>
            <span className="metric__label">{t("result.fairness")}</span>
          </div>
        </div>

        <dl className="result-card__facts">
          <div>
            <dt>{t("result.avgFare")}</dt>
            <dd>{formatYen(station.averageFareYen)}</dd>
          </div>
          <div>
            <dt>{t("result.distance")}</dt>
            <dd>{station.distanceToCentroidKm}</dd>
          </div>
        </dl>

        <p className="result-card__range">
          {t("result.range", {
            min: station.minMinutes,
            max: station.maxMinutes,
            transfers,
            source: t(routingSourceKey(result, station)),
          })}
        </p>

        <ResultActions station={station} />
      </div>
    </div>
  );
}
