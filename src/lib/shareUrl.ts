/**
 * 入力条件を URL に載せて共有する。
 *
 * パラメータは旧実装と互換にしてある（既に配られたリンクを壊さないため）。
 *   o      … 駅名をカンマ区切り
 *   people … o と同じ並びの人数
 *   mode   … A | B
 *   w      … 公平さの重み 0〜100
 *   fw     … 運賃の重み 0〜100
 */

import type { Mode } from "@/types/ekihub";

/** 共有リンクから復元できる条件 */
export interface ShareParams {
  origins: { name: string; people: number }[];
  mode: Mode | null;
  /** 0〜1 に直した値。指定が無ければ null */
  fairnessWeight: number | null;
  fareWeight: number | null;
}

/** 0〜100 の整数へ丸める */
function toPercent(weight: number): string {
  return String(Math.round(Math.min(1, Math.max(0, weight)) * 100));
}

/** 現在の条件から共有用のクエリ文字列を作る */
export function buildShareQuery(input: {
  origins: { name: string; people: number }[];
  mode: Mode;
  fairnessWeight: number;
  fareWeight: number;
}): string {
  const params = new URLSearchParams();
  params.set("o", input.origins.map((origin) => origin.name).join(","));
  params.set("people", input.origins.map((origin) => origin.people).join(","));
  params.set("mode", input.mode);
  params.set("w", toPercent(input.fairnessWeight));
  params.set("fw", toPercent(input.fareWeight));
  return params.toString();
}

/** 共有リンクの絶対URLを作る（ブラウザでのみ呼ぶ） */
export function buildShareUrl(input: {
  origins: { name: string; people: number }[];
  mode: Mode;
  fairnessWeight: number;
  fareWeight: number;
}): string {
  return `${window.location.origin}${window.location.pathname}?${buildShareQuery(input)}`;
}

/** URL のクエリから条件を読み取る。駅が2つ未満なら復元しない */
export function parseShareParams(search: string): ShareParams | null {
  const params = new URLSearchParams(search);
  const origins = (params.get("o") ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  if (origins.length < 2) return null;

  const peoples = (params.get("people") ?? "").split(",");
  const mode = params.get("mode");
  const weight = Number.parseInt(params.get("w") ?? "", 10);
  const fareWeight = Number.parseInt(params.get("fw") ?? "", 10);

  return {
    origins: origins.map((name, index) => {
      const parsed = Number.parseInt(peoples[index] ?? "", 10);
      return {
        name,
        people: Number.isFinite(parsed) && parsed > 0 ? parsed : 1,
      };
    }),
    mode: mode === "A" || mode === "B" ? mode : null,
    fairnessWeight: Number.isFinite(weight)
      ? Math.min(100, Math.max(0, weight)) / 100
      : null,
    fareWeight: Number.isFinite(fareWeight)
      ? Math.min(100, Math.max(0, fareWeight)) / 100
      : null,
  };
}
