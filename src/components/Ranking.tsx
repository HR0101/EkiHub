"use client";

import type { RankingEntry } from "@/types/ekihub";

interface Props {
  ranking: readonly RankingEntry[];
  selectedName: string | null;
  onSelect: (name: string) => void;
}

/** 候補駅ランキング。1件しかないときは比較の意味がないので出さない */
export function Ranking({ ranking, selectedName, onSelect }: Props) {
  if (ranking.length <= 1) return null;

  return (
    <div className="ranking">
      <h4 className="ranking__title">候補駅ランキング（クリックで詳細を表示）</h4>
      <ul>
        {ranking.map((entry, index) => {
          const fare =
            entry.averageFareYen > 0
              ? ` / ¥${entry.averageFareYen.toLocaleString("ja-JP")}`
              : "";
          return (
            <li
              key={entry.name}
              className={`ranking-item ${entry.name === selectedName ? "is-selected" : ""}`}
            >
              <button
                type="button"
                className="ranking-item__button"
                aria-current={entry.name === selectedName}
                onClick={() => onSelect(entry.name)}
              >
                <span className="ranking-item__rank">{index + 1}</span>
                <span className="ranking-item__name">{entry.name}</span>
                <span className="ranking-item__meta">
                  {`平均${entry.averageMinutes}分 / ±${entry.fairness}${fare}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
