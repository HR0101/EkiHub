"use client";

import { LoadingIndicator } from "@/components/LoadingIndicator";
import { useMinimumVisible } from "@/hooks/useMinimumVisible";
import { useTranslation } from "@/i18n/LocaleProvider";

/** 一瞬で終わっても点滅して見えないよう、最低これだけは出しておく */
const MINIMUM_VISIBLE_MS = 550;

/** 算出中に結果エリアへ重ねる表示 */
export function LoadingOverlay({ isComputing }: { isComputing: boolean }) {
  const { t } = useTranslation();
  const isVisible = useMinimumVisible(isComputing, MINIMUM_VISIBLE_MS);
  if (!isVisible) return null;

  return (
    <div className="loading">
      <div className="loading__box">
        <LoadingIndicator label={t("loading.text")} />
      </div>
    </div>
  );
}
