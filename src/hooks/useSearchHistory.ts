"use client";

import { useCallback, useEffect, useState, useRef } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemberAccount } from "@/hooks/useMemberGroups";
import { workspaceRequest } from "@/lib/workspaceRequest";

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
  fairnessWeight?: number;
  fareWeight?: number;
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
        typeof (origin as Record<string, unknown>).name === "string",
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
function useLocalSearchHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    // localStorage はサーバーで読めないため、マウント後に読み込む
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      fairnessWeight?: number;
      fareWeight?: number;
    }) => {
      setEntries((current) => {
        const id = JSON.stringify([
          input.mode,
          input.origins,
          input.fairnessWeight ?? 0.6,
          input.fareWeight ?? 0,
        ]);
        const existing = current.find((entry) => entry.id === id);
        const entry: HistoryEntry = {
          id,
          origins: input.origins,
          mode: input.mode,
          bestName: input.bestName,
          fairnessWeight: input.fairnessWeight ?? 0.6,
          fareWeight: input.fareWeight ?? 0,
          savedAt: new Date().toISOString(),
          // お気に入りの印は引き継ぐ
          isFavorite: existing?.isFavorite ?? false,
        };
        const next = [entry, ...current.filter((item) => item.id !== id)].slice(
          0,
          MAX_ENTRIES,
        );
        writeStored(next);
        return next;
      });
    },
    [],
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      update(
        entries.map((entry) =>
          entry.id === id ? { ...entry, isFavorite: !entry.isFavorite } : entry,
        ),
      );
    },
    [entries, update],
  );

  const remove = useCallback(
    (id: string) => {
      update(entries.filter((entry) => entry.id !== id));
    },
    [entries, update],
  );

  // お気に入りを先に、その中では新しい順に並べる
  const sorted = [...entries].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    return b.savedAt.localeCompare(a.savedAt);
  });

  return { entries: sorted, record, toggleFavorite, remove };
}

/** Logged-in history uses account-scoped server records; guest data stays local. */
export function useSearchHistory() {
  const local = useLocalSearchHistory();
  const account = useMemberAccount();
  const client = useQueryClient();
  const userId = account.data?.user?.id;
  const key = ["member-history", userId];
  const [syncError, setSyncError] = useState("");
  const remote = useQuery({
    queryKey: key,
    enabled: !!userId,
    retry: false,
    refetchOnWindowFocus: "always",
    queryFn: () =>
      workspaceRequest<{ entries: HistoryEntry[] }>("/api/member-history", {
        headers: { "X-EkiHub-Account": userId! },
      }),
  });
  // Preserve request order within this mounted history panel, including favorite/delete.
  const queue = useRef(Promise.resolve());
  function send(method: "PUT" | "DELETE", value: unknown) {
    const currentUser = userId;
    queue.current = queue.current.then(async () => {
      try {
        const response = await fetch("/api/member-history", {
          method,
          headers: {
            "Content-Type": "application/json",
            "X-EkiHub-Account": currentUser!,
          },
          body: JSON.stringify(value),
          cache: "no-store",
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "履歴の同期に失敗しました。");
        }
        setSyncError("");
        await client.invalidateQueries({
          queryKey: ["member-history", currentUser],
        });
      } catch (e) {
        setSyncError((e as Error).message);
      }
    });
  }
  const entries = [
    ...(userId ? (remote.data?.entries ?? []) : local.entries),
  ].sort(
    (a, b) =>
      Number(b.isFavorite) - Number(a.isFavorite) ||
      b.savedAt.localeCompare(a.savedAt),
  );
  return {
    entries,
    synced: !!userId,
    syncError:
      syncError ||
      (remote.isError
        ? "履歴を同期できませんでした。再読み込みしてください。"
        : ""),
    retry: () => remote.refetch(),
    importLocal: () => {
      for (const entry of [...local.entries].reverse()) send("PUT", entry);
    },
    localCount: local.entries.length,
    record(input: {
      origins: HistoryEntry["origins"];
      mode: Mode;
      bestName: string;
      fairnessWeight?: number;
      fareWeight?: number;
    }) {
      if (!userId) {
        local.record(input);
        return;
      }
      const id = JSON.stringify([
        input.mode,
        input.origins,
        input.fairnessWeight ?? 0.6,
        input.fareWeight ?? 0,
      ]);
      // A search may finish while initial account history is still loading.
      queue.current = queue.current.then(async () => {
        try {
          const latest = await workspaceRequest<{ entries: HistoryEntry[] }>(
            "/api/member-history",
            { headers: { "X-EkiHub-Account": userId } },
          );
          const existing = latest.entries.find((e) => e.id === id);
          const response = await fetch("/api/member-history", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "X-EkiHub-Account": userId,
            },
            body: JSON.stringify({
              ...input,
              id,
              isFavorite: existing?.isFavorite ?? false,
            }),
          });
          if (!response.ok) throw new Error("履歴の保存に失敗しました。");
          await client.invalidateQueries({
            queryKey: ["member-history", userId],
          });
          setSyncError("");
        } catch (e) {
          setSyncError((e as Error).message);
        }
      });
    },
    toggleFavorite(id: string) {
      if (!userId) {
        local.toggleFavorite(id);
        return;
      }
      const entry = entries.find((e) => e.id === id);
      if (entry) send("PUT", { ...entry, isFavorite: !entry.isFavorite });
    },
    remove(id: string) {
      if (!userId) local.remove(id);
      else send("DELETE", { id });
    },
  };
}
