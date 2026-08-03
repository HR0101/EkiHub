"use client";

import { ResultActions } from "@/components/ResultActions";
import type { CenterResult, RankingEntry } from "@/types/ekihub";

interface Props {
  result: CenterResult | null;
  station: RankingEntry | null;
}

/** 円マーク付きの金額。0 円のときは「—」 */
function formatYen(value: number): string {
  return value > 0 ? `¥${value.toLocaleString("ja-JP")}` : "—";
}

/** 所要時間をどう求めたかを一言で示す */
function routingSourceLabel(
  result: CenterResult,
  station: RankingEntry
): string {
  if (result.routingRefined || station.routed) return "（実経路データ）";
  if (result.routingMethod === "graph") return "（鉄道網ルート概算）";
  return "（距離からの概算）";
}

/** 駅の見出し行（読みがな・規模） */
function stationSubtitle(station: RankingEntry): string {
  const parts = [station.kana];
  if (station.isMajor) parts.push("主要ターミナル駅");
  if (station.ridership) {
    parts.push(`乗降 約${Math.round(station.ridership / 10000)}万人/日`);
  }
  return parts.join(" ・");
}

/** 提案された中心駅（またはランキングから選んだ候補駅）を表示する */
export function ResultCard({ result, station }: Props) {
  if (!result || !station) {
    return (
      <div className="result-card is-empty">
        <div className="result-card__empty">
          <div className="result-card__icon">🗾</div>
          <p>
            最寄駅を2駅以上入力して
            <br />
            「算出する」を押してください。
          </p>
        </div>
      </div>
    );
  }

  const isTop = result.best.name === station.name;
  const transfers =
    typeof station.averageTransfers === "number"
      ? ` ・平均乗換 ${station.averageTransfers}回`
      : "";

  return (
    <div className="result-card">
      <div className="result-card__content">
        <span className="result-card__eyebrow">
          {isTop ? "提案された中心駅" : "選択中の候補駅"}
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
            <span className="metric__label">平均所要時間(分)</span>
          </div>
          <div className="metric">
            <span className="metric__value">±{station.fairness}</span>
            <span className="metric__label">時間のばらつき</span>
          </div>
          <div className="metric">
            <span className="metric__value">
              {formatYen(station.averageFareYen)}
            </span>
            <span className="metric__label">平均運賃(概算)</span>
          </div>
          <div className="metric">
            <span className="metric__value">
              {station.distanceToCentroidKm}
            </span>
            <span className="metric__label">重心までの距離(km)</span>
          </div>
        </div>

        <p className="result-card__range">
          {`各メンバー ${station.minMinutes}〜${station.maxMinutes}分${transfers} ${routingSourceLabel(result, station)}`}
        </p>

        <ResultActions station={station} />
      </div>
    </div>
  );
}
