"use client";

import { useMemo } from "react";

import { StationInputRow } from "@/components/StationInputRow";
import { StepGuide } from "@/components/StepGuide";
import {
  MIN_INPUT_ROWS,
  selectFilledOrigins,
  useEkiHubStore,
} from "@/stores/useEkiHubStore";
import { useTranslation } from "@/i18n/LocaleProvider";
import type { MessageKey } from "@/i18n";
import type { Mode, Station } from "@/types/ekihub";

interface Props {
  stations: readonly Station[];
  isComputing: boolean;
  errorMessage: string | null;
  /** 手順ガイドがいま案内している段階（0始まり） */
  currentStep: number;
  onSubmit: () => void;
}

/** 重視ポイントのスライダー位置に対応する文言のキー */
function weightLabelKey(percent: number): MessageKey {
  if (percent <= 20) return "form.weightLabels.nearest";
  if (percent <= 40) return "form.weightLabels.nearer";
  if (percent <= 60) return "form.weightLabels.balanced";
  if (percent <= 80) return "form.weightLabels.fairer";
  return "form.weightLabels.fairest";
}

/** 運賃をどれだけ効かせるか */
function fareLabelKey(percent: number): MessageKey {
  if (percent <= 33) return "form.fareLabels.low";
  if (percent <= 66) return "form.fareLabels.mid";
  return "form.fareLabels.high";
}

const MODE_OPTIONS: { value: Mode; mainKey: MessageKey; subKey: MessageKey }[] = [
  { value: "A", mainKey: "form.modeAMain", subKey: "form.modeASub" },
  { value: "B", mainKey: "form.modeBMain", subKey: "form.modeBSub" },
];

/** 入力パネル。駅の入力から算出の実行までを受け持つ */
export function StationForm({
  stations,
  isComputing,
  errorMessage,
  currentStep,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const rows = useEkiHubStore((state) => state.rows);
  const mode = useEkiHubStore((state) => state.mode);
  const fairnessWeight = useEkiHubStore((state) => state.fairnessWeight);
  const fareWeight = useEkiHubStore((state) => state.fareWeight);
  const addRow = useEkiHubStore((state) => state.addRow);
  const setMode = useEkiHubStore((state) => state.setMode);
  const setFairnessWeight = useEkiHubStore((state) => state.setFairnessWeight);
  const setFareWeight = useEkiHubStore((state) => state.setFareWeight);

  const weightPercent = Math.round(fairnessWeight * 100);
  const farePercent = Math.round(fareWeight * 100);
  const filledCount = useMemo(
    () => selectFilledOrigins(rows).origins.length,
    [rows]
  );
  const canSubmit = filledCount >= MIN_INPUT_ROWS && !isComputing;

  return (
    <section className="panel" aria-label={t("form.panelTitle")}>
      <h2 className="panel__title">{t("form.panelTitle")}</h2>

      <StepGuide currentIndex={currentStep} />

      <form
        className="form"
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) onSubmit();
        }}
      >
        <div className="inputs">
          {rows.map((row, index) => (
            <StationInputRow
              key={row.id}
              row={row}
              index={index + 1}
              stations={stations}
            />
          ))}
        </div>

        <button type="button" className="btn btn--ghost" onClick={addRow}>
          {t("form.addStation")}
        </button>

        <div className="mode">
          <div className="mode__head">
            <span className="mode__label">{t("form.modeTitle")}</span>
          </div>
          <div className="toggle" role="tablist" aria-label={t("form.modeTitle")}>
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={mode === option.value}
                className={`toggle__btn ${mode === option.value ? "is-active" : ""}`}
                onClick={() => setMode(option.value)}
              >
                <span className="toggle__main">{t(option.mainKey)}</span>
                <span className="toggle__sub">{t(option.subKey)}</span>
              </button>
            ))}
            <span
              className={`toggle__slider ${mode === "B" ? "is-right" : ""}`}
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="weight">
          <div className="weight__head">
            <span className="mode__label">{t("form.weightTitle")}</span>
            <span className="weight__hint">{t(weightLabelKey(weightPercent))}</span>
          </div>
          <input
            type="range"
            className="slider"
            min={0}
            max={100}
            step={5}
            value={weightPercent}
            aria-label={t("form.weightAriaLabel")}
            onChange={(event) =>
              setFairnessWeight(Number(event.target.value) / 100)
            }
          />
          <div className="weight__labels">
            <span>{t("form.weightNear")}</span>
            <span>{t("form.weightFair")}</span>
          </div>
        </div>

        <div className="weight">
          <div className="weight__head">
            <span className="mode__label">{t("form.fareTitle")}</span>
            <span className="weight__hint">{t(fareLabelKey(farePercent))}</span>
          </div>
          <input
            type="range"
            className="slider"
            min={0}
            max={100}
            step={10}
            value={farePercent}
            aria-label={t("form.fareTitle")}
            onChange={(event) => setFareWeight(Number(event.target.value) / 100)}
          />
        </div>

        <button
          type="submit"
          className={`btn btn--primary ${isComputing ? "is-loading" : ""}`}
          disabled={!canSubmit}
        >
          <span className="btn__label">
            {isComputing ? t("form.computing") : t("form.submit")}
          </span>
          <span className="btn__spinner" aria-hidden="true" />
        </button>

        <p className="form__error" role="alert">
          {errorMessage ?? ""}
        </p>
      </form>
    </section>
  );
}
