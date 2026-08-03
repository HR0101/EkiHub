"use client";

import { useMinimumVisible } from "@/hooks/useMinimumVisible";

/** 一瞬で終わっても点滅して見えないよう、最低これだけは出しておく */
const MINIMUM_VISIBLE_MS = 550;

/** 算出中に結果エリアへ重ねる表示 */
export function LoadingOverlay({ isComputing }: { isComputing: boolean }) {
  const isVisible = useMinimumVisible(isComputing, MINIMUM_VISIBLE_MS);
  if (!isVisible) return null;

  return (
    <div className="loading" aria-live="polite" role="status">
      <div className="loading__box">
        <div className="loading__scene">
          <div className="loading__train" aria-hidden="true">
            <span className="train__smoke" />
            <span className="train__body" />
            <span className="train__window" />
            <span className="train__light" />
            <span className="train__wheel train__wheel--a" />
            <span className="train__wheel train__wheel--b" />
          </div>
          <div className="loading__rail" aria-hidden="true" />
        </div>
        <p className="loading__text">
          ちょうどいい駅をさがしています
          <span className="loading__dots">
            <i>.</i>
            <i>.</i>
            <i>.</i>
          </span>
        </p>
      </div>
    </div>
  );
}
