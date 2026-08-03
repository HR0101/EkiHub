"use client";

import { useCallback, useEffect, useState } from "react";

import type { Mode } from "@/types/ekihub";

const STORAGE_KEY = "ekihub-history";

/** 保存する上限。古いものから捨てる */
const MAX_ENTRIES = 20;

export interface HistoryEntry {
  /** 駅の組み合わせから作る識別子。同じ条件を重複させないために使う */
  id: string;
  origins: { name: string; people: number }[];
  mode: Mode;
  /** 算出された中心駅 */
  bestName: string;
  /** 保存時刻（ISO文字列） */
  savedAt: string;
  isFavorite: boolean;
}

/** 駅の並びとモードから識別子を作る */
function makeId(origins: { name: string }[], mode: Mode): string {
  return `${mode}:${origins.map((o) => o.name).join(",")}`;
}

/**
 * 保存済みの1件が今の形かどうか。
 *
 * 旧実装（legacy/js/features/historyFavorites.js）が同じキーへ
 * 別の形で書いていたため、読み込み時に必ず検証して捨てる。
 */
function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.bestName === "string" &&
    typeof entry.savedAt === "string" &&
    (entry.mode === "A" || entry.mode === "B") &&
    Array.isArray(entry.origins) &&
    entry.origins.every(
      (origin) =>
        typeof origin === "object" &&
        origin !== null &&
        typeof (origin as Record<string, unknown>).name === "string"
    )
  );
}

function readStored(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHistoryEntry).map((entry) => ({
      ...entry,
      // 旧データには無いので既定値で補う
      isFavorite: entry.isFavorite === true,
      origins: entry.origins.map((origin) => ({
        name: origin.name,
        people: typeof origin.people === "number" ? origin.people : 1,
      })),
    }));
  } catch {
    // 壊れた値が入っていても履歴なしとして続ける
    return [];
  }
}

function writeStored(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // 保存できなくても操作は続けられるので握りつぶす
  }
}

/**
 * 算出履歴とお気に入り。
 * localStorage はサーバーで読めないため、マウント後に読み込む。
 */
export function useSearchHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setEntries(readStored());
  }, []);

  const update = useCallback((next: HistoryEntry[]) => {
    setEntries(next);
    writeStored(next);
  }, []);

  /** 算出が成功したときに呼ぶ。同じ条件があれば先頭へ引き上げる */
  const record = useCallback(
    (input: {
      origins: { name: string; people: number }[];
      mode: Mode;
      bestName: string;
    }) => {
      setEntries((current) => {
        const id = makeId(input.origins, input.mode);
        const existing = current.find((entry) => entry.id === id);
        const entry: HistoryEntry = {
          id,
          origins: input.origins,
          mode: input.mode,
          bestName: input.bestName,
          savedAt: new Date().toISOString(),
          // お気に入りの印は引き継ぐ
          isFavorite: existing?.isFavorite ?? false,
        };
        const next = [
          entry,
          ...current.filter((item) => item.id !== id),
        ].slice(0, MAX_ENTRIES);
        writeStored(next);
        return next;
      });
    },
    []
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      update(
        entries.map((entry) =>
          entry.id === id ? { ...entry, isFavorite: !entry.isFavorite } : entry
        )
      );
    },
    [entries, update]
  );

  const remove = useCallback(
    (id: string) => {
      update(entries.filter((entry) => entry.id !== id));
    },
    [entries, update]
  );

  // お気に入りを先に、その中では新しい順に並べる
  const sorted = [...entries].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    return b.savedAt.localeCompare(a.savedAt);
  });

  return { entries: sorted, record, toggleFavorite, remove };
}
