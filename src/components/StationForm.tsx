"use client";

import { useMemo } from "react";

import { StationInputRow } from "@/components/StationInputRow";
import { StepGuide } from "@/components/StepGuide";
import {
  MIN_INPUT_ROWS,
  selectFilledOrigins,
  useEkiHubStore,
} from "@/stores/useEkiHubStore";
import type { Mode, Station } from "@/types/ekihub";

interface Props {
  stations: readonly Station[];
  isComputing: boolean;
  errorMessage: string | null;
  /** 手順ガイドがいま案内している段階（0始まり） */
  currentStep: number;
  onSubmit: () => void;
}

/** 重視ポイントのスライダー位置を言葉にする */
function weightLabel(percent: number): string {
  if (percent <= 20) return "近さ最優先";
  if (percent <= 40) return "やや近さ重視";
  if (percent <= 60) return "バランス";
  if (percent <= 80) return "やや公平さ重視";
  return "公平さ最優先";
}

/** 運賃をどれだけ効かせるか */
function fareLabel(percent: number): string {
  if (percent <= 33) return "重視しない";
  if (percent <= 66) return "やや重視";
  return "重視";
}

const MODE_OPTIONS: { value: Mode; main: string; sub: string }[] = [
  { value: "A", main: "主要駅限定", sub: "新宿・渋谷など大規模駅" },
  { value: "B", main: "規模不問", sub: "純粋に地理・時間の中心" },
];

/** 入力パネル。駅の入力から算出の実行までを受け持つ */
export function StationForm({
  stations,
  isComputing,
  errorMessage,
  currentStep,
  onSubmit,
}: Props) {
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
    <section className="panel" aria-label="入力フォーム">
      <h2 className="panel__title">最寄駅を入力</h2>

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
          ＋ 駅を追加
        </button>

        <div className="mode">
          <div className="mode__head">
            <span className="mode__label">候補の絞り込み</span>
          </div>
          <div className="toggle" role="tablist" aria-label="候補の絞り込み">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={mode === option.value}
                className={`toggle__btn ${mode === option.value ? "is-active" : ""}`}
                onClick={() => setMode(option.value)}
              >
                <span className="toggle__main">{option.main}</span>
                <span className="toggle__sub">{option.sub}</span>
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
            <span className="mode__label">重視ポイント</span>
            <span className="weight__hint">{weightLabel(weightPercent)}</span>
          </div>
          <input
            type="range"
            className="slider"
            min={0}
            max={100}
            step={5}
            value={weightPercent}
            aria-label="重視ポイント（全員の公平さと近さのバランス）"
            onChange={(event) =>
              setFairnessWeight(Number(event.target.value) / 100)
            }
          />
          <div className="weight__labels">
            <span>近さ重視</span>
            <span>公平さ重視</span>
          </div>
        </div>

        <div className="weight">
          <div className="weight__head">
            <span className="mode__label">運賃の重視度</span>
            <span className="weight__hint">{fareLabel(farePercent)}</span>
          </div>
          <input
            type="range"
            className="slider"
            min={0}
            max={100}
            step={10}
            value={farePercent}
            aria-label="運賃の重視度"
            onChange={(event) => setFareWeight(Number(event.target.value) / 100)}
          />
        </div>

        <button
          type="submit"
          className={`btn btn--primary ${isComputing ? "is-loading" : ""}`}
          disabled={!canSubmit}
        >
          <span className="btn__label">
            {isComputing ? "算出中…" : "中心駅を算出する"}
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
