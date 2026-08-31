"use client";

import { useQuery } from "@tanstack/react-query";

import { useTranslation } from "@/i18n/LocaleProvider";
import { ApiRequestError, fetchTrainInformation } from "@/lib/api";

/** 既定の再取得間隔（サーバーが返す refreshAfterSeconds で上書きする） */
const FALLBACK_REFRESH_MS = 120_000;

/** 鉄道の運行情報。ODPT のトークンが無い環境では準備中の案内を出す */
export function TrainInformation() {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["train-information"],
    queryFn: ({ signal }) => fetchTrainInformation(signal),
    // サーバーが指定した間隔で取り直す
    refetchInterval: (q) =>
      q.state.data ? q.state.data.refreshAfterSeconds * 1000 : FALLBACK_REFRESH_MS,
    retry: false,
  });

  const notConfigured =
    query.error instanceof ApiRequestError &&
    query.error.code === "ODPT_NOT_CONFIGURED";

  return (
    <section className="train-info-card fpanel" aria-labelledby="trainInfoTitle">
      <div className="train-info-card__head">
        <div>
          <span className="train-info-card__eyebrow">
            <span className="train-info-card__live" aria-hidden="true" />
            LIVE
          </span>
          <h2 id="trainInfoTitle" className="train-info-card__title">
            {t("trainInfo.title")}
          </h2>
          <p className="train-info-card__coverage">
            {t("trainInfo.coverage")}
          </p>
        </div>
        <div className="train-info-card__actions">
          <button
            type="button"
            className="train-info-card__icon-btn"
            aria-label={t("trainInfo.refresh")}
            title={t("trainInfo.refresh")}
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            ↻
          </button>
        </div>
      </div>

      <div className="train-info-card__content" aria-live="polite">
        {query.isPending && (
          <div className="train-info-card__loading">
            <span className="train-info-card__spinner" aria-hidden="true" />
            {t("trainInfo.loading")}
          </div>
        )}

        {notConfigured && <p>{t("trainInfo.preparing")}</p>}

        {query.isError && !notConfigured && (
          <p>{t("trainInfo.failed")}</p>
        )}

        {query.isSuccess && query.data.items.length === 0 && (
          <p>{t("trainInfo.none")}</p>
        )}

        {query.isSuccess && query.data.items.length > 0 && (
          <ul className="train-info-list">
            {query.data.items.map((item) => (
              <li
                key={item.id}
                className={`train-info-item ${item.isNormal ? "is-normal" : ""} ${
                  item.isServiceEnded ? "is-ended" : ""
                }`}
              >
                <span className="train-info-item__railway">{item.railway}</span>
                <span className="train-info-item__status">{item.status}</span>
                {!item.isNormal && (
                  <span className="train-info-item__text">{item.text}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="train-info-card__foot">
        {query.isSuccess && (
          <p>
            {t("trainInfo.updated", {
              time: new Date(query.data.updatedAt).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              }),
            })}
          </p>
        )}
        <p>
          {t("trainInfo.creditBefore")}
          <a
            href="https://www.odpt.org/"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("trainInfo.creditProvider")}
          </a>
          {t("trainInfo.creditAfter")}
        </p>
        <p>
          {t("trainInfo.contactBefore")}
          <a
            href="https://github.com/HR0101/EkiHub/issues"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("trainInfo.contactLink")}
          </a>
          {t("trainInfo.contactAfter")}
        </p>
      </div>
    </section>
  );
}
