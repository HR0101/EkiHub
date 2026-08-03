"use client";

import { useMemo } from "react";

import {
  MIN_INPUT_ROWS,
  selectFilledOrigins,
  type StationInputRow,
} from "@/stores/useEkiHubStore";
import type { MessageKey } from "@/i18n";
import type { CenterResult } from "@/types/ekihub";

/** 手順の識別子。配列の並びがそのまま表示順になる */
export const STEP_IDS = ["origins", "compute", "tune"] as const;
export type StepId = (typeof STEP_IDS)[number];

/** 文言は辞書から引くので、ここではキーだけを持つ */
export interface StepDefinition {
  id: StepId;
  labelKey: MessageKey;
  hintKey: MessageKey;
}

export const STEPS: StepDefinition[] = [
  { id: "origins", labelKey: "steps.origins", hintKey: "steps.originsHint" },
  { id: "compute", labelKey: "steps.compute", hintKey: "steps.computeHint" },
  { id: "tune", labelKey: "steps.tune", hintKey: "steps.tuneHint" },
];

/** 入力内容を1つの文字列にまとめる（結果の新旧を比べるための指紋） */
function signature(origins: { name: string; people: number }[]): string {
  return origins.map((origin) => `${origin.name}*${origin.people}`).join("|");
}

/**
 * いま案内すべき手順を返す。
 *
 * 旧実装は DOM を監視して判定していたが、
 * React では入力と結果から導けるので状態を持たない。
 */
export function useStepGuide(
  rows: StationInputRow[],
  result: CenterResult | null
): number {
  return useMemo(() => {
    const { origins, peopleCounts } = selectFilledOrigins(rows);
    if (origins.length < MIN_INPUT_ROWS) return 0;

    if (!result) return 1;

    // 算出後に入力を変えていたら「算出し直す」段階へ戻す
    const current = signature(
      origins.map((name, index) => ({
        name,
        people: peopleCounts[index] ?? 1,
      }))
    );
    const computed = signature(
      result.origins.map((origin) => ({
        name: origin.name,
        people: origin.people,
      }))
    );
    return current === computed ? 2 : 1;
  }, [rows, result]);
}
