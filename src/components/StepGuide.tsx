"use client";

import { STEPS } from "@/hooks/useStepGuide";
import { useTranslation } from "@/i18n/LocaleProvider";

interface Props {
  /** いま案内している手順（0始まり） */
  currentIndex: number;
}

/** 入力パネル上部の手順ガイド。いまどこにいるかを 1→2→3 で示す */
export function StepGuide({ currentIndex }: Props) {
  const { t } = useTranslation();
  const current = STEPS[currentIndex];

  return (
    <div className="sg">
      <ol className="sg-bar" aria-label={t("steps.ariaLabel")}>
        {STEPS.map((step, index) => (
          <li
            key={step.id}
            className={`sg-step ${index < currentIndex ? "is-done" : ""} ${
              index === currentIndex ? "is-current" : ""
            }`}
          >
            <span
              className="sg-step__btn"
              aria-current={index === currentIndex ? "step" : undefined}
            >
              <span className="sg-step__num">{index + 1}</span>
              <span className="sg-step__label">{t(step.labelKey)}</span>
            </span>
          </li>
        ))}
      </ol>

      {/* 手順が切り替わったことを支援技術へ穏やかに伝える */}
      <p className="sg-now" role="status">
        {current ? t(current.hintKey) : ""}
      </p>
    </div>
  );
}
