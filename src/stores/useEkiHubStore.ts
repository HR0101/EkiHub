/**
 * 画面全体で共有する入力条件と算出結果。
 *
 * 旧実装ではイベントバス（window.EkiHub）で各機能へ配っていたものを、
 * ひとつのストアにまとめている。購読側は必要な値だけをセレクタで取るので、
 * 無関係な更新では再描画されない。
 */

import { create } from "zustand";

import type { CenterResult, Mode, RankingEntry } from "@/types/ekihub";

/** 算出に必要な最低駅数（サーバー側のバリデーションと揃えること） */
export const MIN_INPUT_ROWS = 2;

/** 入力欄1行ぶん。id は React の key を安定させるためだけに持つ */
export interface StationInputRow {
  id: string;
  name: string;
  /** この駅から来る人数。重心と平均の重みになる */
  people: number;
}

interface EkiHubState {
  rows: StationInputRow[];
  mode: Mode;
  /** 公平さの重み 0〜1（残りが「近さ」の重み） */
  fairnessWeight: number;
  /** 運賃の重み 0〜1 */
  fareWeight: number;
  result: CenterResult | null;
  /** ランキングから選んでいる駅名。null なら best を見る */
  selectedName: string | null;

  addRow: () => void;
  removeRow: (id: string) => void;
  updateRow: (id: string, patch: Partial<Omit<StationInputRow, "id">>) => void;
  setRows: (rows: Pick<StationInputRow, "name" | "people">[]) => void;

  setMode: (mode: Mode) => void;
  setFairnessWeight: (weight: number) => void;
  setFareWeight: (weight: number) => void;

  setResult: (result: CenterResult | null) => void;
  selectStation: (name: string) => void;
}

/**
 * 行の id を採番する。
 * crypto.randomUUID() だとサーバーとクライアントで値がずれて
 * ハイドレーションが壊れるため、単純な連番にしている。
 */
let rowSequence = 0;
function createRow(name = "", people = 1): StationInputRow {
  rowSequence += 1;
  return { id: `row-${rowSequence}`, name, people };
}

export const useEkiHubStore = create<EkiHubState>((set, get) => ({
  rows: [createRow(), createRow()],
  mode: "A",
  fairnessWeight: 0.6,
  fareWeight: 0,
  result: null,
  selectedName: null,

  addRow: () => set((state) => ({ rows: [...state.rows, createRow()] })),

  removeRow: (id) =>
    set((state) => {
      // 最低行数は保つ（削除ボタン側でも抑止しているが、ここでも守る）
      if (state.rows.length <= MIN_INPUT_ROWS) return state;
      return { rows: state.rows.filter((row) => row.id !== id) };
    }),

  updateRow: (id, patch) =>
    set((state) => ({
      rows: state.rows.map((row) =>
        row.id === id ? { ...row, ...patch } : row
      ),
    })),

  setRows: (rows) => {
    const next = rows.map((row) => createRow(row.name, row.people));
    while (next.length < MIN_INPUT_ROWS) next.push(createRow());
    set({ rows: next });
  },

  setMode: (mode) => set({ mode }),
  setFairnessWeight: (fairnessWeight) => set({ fairnessWeight }),
  setFareWeight: (fareWeight) => set({ fareWeight }),

  setResult: (result) =>
    set({ result, selectedName: result ? result.best.name : null }),

  selectStation: (name) => {
    const { result } = get();
    if (!result) return;
    if (result.ranking.some((entry) => entry.name === name)) {
      set({ selectedName: name });
    }
  },
}));

/** いま詳細を表示すべき駅（選択がなければ提案された中心駅） */
export function selectCurrentStation(state: {
  result: CenterResult | null;
  selectedName: string | null;
}): RankingEntry | null {
  if (!state.result) return null;
  const selected = state.result.ranking.find(
    (entry) => entry.name === state.selectedName
  );
  return selected ?? state.result.best;
}

/** 駅名が入っている行だけを算出リクエストの形へ整える */
export function selectFilledOrigins(rows: StationInputRow[]): {
  origins: string[];
  peopleCounts: number[];
} {
  const filled = rows.filter((row) => row.name.trim().length > 0);
  return {
    origins: filled.map((row) => row.name.trim()),
    peopleCounts: filled.map((row) => row.people),
  };
}
