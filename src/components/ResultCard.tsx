"use client";

import { ResultActions } from "@/components/ResultActions";
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

  // 空の状態は「何ができるか」を伝えて、そのまま試せる場にしている
  if (!result || !station) {
    return (
      <div className="result-card is-empty">
        <div className="result-card__empty">
          <div className="result-card__icon" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <circle
                cx="20"
                cy="20"
                r="6"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M20 4v7m0 18v7M4 20h7m18 0h7M9 9l5 5m12 12 5 5M9 31l5-5m12-12 5-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h3 className="result-card__empty-title">{t("result.emptyTitle")}</h3>
          <p className="result-card__empty-lead">{t("result.emptyLead")}</p>

          <details className="disclosure empty-details">
            <summary>{t("result.detailsLabel")}</summary>
            <ul className="result-card__points">
              <li>{t("result.emptyPoint1")}</li>
              <li>{t("result.emptyPoint2")}</li>
              <li>{t("result.emptyPoint3")}</li>
            </ul>
          </details>

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

          <p className="result-card__empty-hint">
            {t("result.emptyLine1")}
            {t("result.emptyLine2")}
          </p>
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
        <div className="result-card__identity">
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
          <div className="metric">
            <span className="metric__value">
              {formatYen(station.averageFareYen)}
            </span>
            <span className="metric__label">{t("result.avgFare")}</span>
          </div>
          <div className="metric">
            <span className="metric__value">
              {station.distanceToCentroidKm}
            </span>
            <span className="metric__label">{t("result.distance")}</span>
          </div>
        </div>

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
