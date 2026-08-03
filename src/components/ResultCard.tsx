"use client";

import { ResultActions } from "@/components/ResultActions";
import { useTranslation } from "@/i18n/LocaleProvider";
import type { MessageKey } from "@/i18n";
import type { CenterResult, RankingEntry } from "@/types/ekihub";

interface Props {
  result: CenterResult | null;
  station: RankingEntry | null;
}

/** 円マーク付きの金額。0 円のときは「—」 */
function formatYen(value: number): string {
  return value > 0 ? `¥${value.toLocaleString("ja-JP")}` : "—";
}

/** 所要時間をどう求めたかを示す文言のキー */
function routingSourceKey(
  result: CenterResult,
  station: RankingEntry
): MessageKey {
  if (result.routingRefined || station.routed) return "result.sourceRouted";
  if (result.routingMethod === "graph") return "result.sourceGraph";
  return "result.sourceStraight";
}

/** 提案された中心駅（またはランキングから選んだ候補駅）を表示する */
export function ResultCard({ result, station }: Props) {
  const { t } = useTranslation();

  /** 駅の見出し行（読みがな・規模） */
  function stationSubtitle(entry: RankingEntry): string {
    const parts = [entry.kana];
    if (entry.isMajor) parts.push(t("result.majorStation"));
    if (entry.ridership) {
      parts.push(
        t("result.ridership", { man: Math.round(entry.ridership / 10000) })
      );
    }
    return parts.join(" ・");
  }

  if (!result || !station) {
    return (
      <div className="result-card is-empty">
        <div className="result-card__empty">
          <div className="result-card__icon">🗾</div>
          <p>
            {t("result.emptyLine1")}
            <br />
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
        <span className="result-card__eyebrow">
          {t(isTop ? "result.eyebrowBest" : "result.eyebrowSelected")}
        </span>
        <h3 className="result-card__name">{station.name}</h3>
        <p className="result-card__kana">{stationSubtitle(station)}</p>

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
