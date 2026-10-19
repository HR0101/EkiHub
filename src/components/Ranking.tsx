"use client";

import { useTranslation } from "@/i18n/LocaleProvider";
import type { RankingEntry } from "@/types/ekihub";

interface Props {
  ranking: readonly RankingEntry[];
  selectedName: string | null;
  onSelect: (name: string) => void;
}

/** Compare candidates in rows; selecting a station updates its details and map. */
export function Ranking({ ranking, selectedName, onSelect }: Props) {
  const { t } = useTranslation();
  if (ranking.length <= 1) return null;

  return (
    <section
      id="station-comparison"
      className="ranking"
      aria-labelledby="ranking-title"
    >
      <h3 id="ranking-title" className="ranking__title">
        {t("ranking.comparisonTitle")}
      </h3>
      <div className="ranking-table-wrap">
        <table className="ranking-table">
          <caption className="ranking-table__hint">
            {t("ranking.title")}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t("ranking.rank")}</th>
              <th scope="col">{t("ranking.station")}</th>
              <th scope="col">{t("ranking.minutes")}</th>
              <th scope="col">{t("ranking.fairness")}</th>
              <th scope="col">{t("ranking.fare")}</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((entry, index) => (
              <tr
                key={entry.name}
                className={entry.name === selectedName ? "is-selected" : ""}
                onClick={() => onSelect(entry.name)}
              >
                <td className="ranking-table__rank">{index + 1}</td>
                <th scope="row">
                  <button
                    type="button"
                    className="ranking-table__station"
                    aria-pressed={entry.name === selectedName}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(entry.name);
                    }}
                  >
                    {entry.name}
                  </button>
                </th>
                <td>{t("travel.minutes", { count: entry.averageMinutes })}</td>
                <td>±{entry.fairness}</td>
                <td>
                  {entry.averageFareYen > 0
                    ? `¥${entry.averageFareYen.toLocaleString("ja-JP")}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="ranking-mobile">
        {ranking.map((entry, index) => (
          <li key={entry.name}>
            <button
              type="button"
              className={`ranking-mobile__row ${entry.name === selectedName ? "is-selected" : ""}`}
              aria-pressed={entry.name === selectedName}
              onClick={() => onSelect(entry.name)}
            >
              <span className="ranking-mobile__rank">{index + 1}</span>
              <strong className="ranking-mobile__name">{entry.name}</strong>
              <span className="ranking-mobile__time">
                {t("travel.minutes", { count: entry.averageMinutes })}
              </span>
              <span className="ranking-mobile__meta">
                <span>
                  {t("ranking.fairness")} ±{entry.fairness}
                </span>
                <span>
                  {t("ranking.fare")}{" "}
                  {entry.averageFareYen > 0
                    ? `¥${entry.averageFareYen.toLocaleString("ja-JP")}`
                    : "—"}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
