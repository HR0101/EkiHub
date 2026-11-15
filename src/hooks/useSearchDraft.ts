"use client";

import { useEffect } from "react";
import { useEkiHubStore } from "@/stores/useEkiHubStore";

const KEY = "ekihub-search-draft-v1";
let restored = false;

/** Keep the editable draft within this tab, including after a reload. */
export function useSearchDraft() {
  useEffect(() => {
    if (!restored) {
      restored = true;
      try {
        const draft = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
        if (
          draft &&
          Array.isArray(draft.rows) &&
          draft.rows.length >= 2 &&
          draft.rows.every(
            (row: { name?: unknown; people?: unknown }) =>
              typeof row.name === "string" &&
              typeof row.people === "number" &&
              Number.isInteger(row.people) &&
              row.people >= 1 &&
              row.people <= 99,
          ) &&
          (draft.mode === "A" || draft.mode === "B") &&
          typeof draft.fairnessWeight === "number" &&
          draft.fairnessWeight >= 0 &&
          draft.fairnessWeight <= 1 &&
          typeof draft.fareWeight === "number" &&
          draft.fareWeight >= 0 &&
          draft.fareWeight <= 1
        ) {
          const state = useEkiHubStore.getState();
          state.setRows(draft.rows);
          state.setMode(draft.mode);
          state.setFairnessWeight(draft.fairnessWeight);
          state.setFareWeight(draft.fareWeight);
        }
      } catch {
        /* Storage may be unavailable or contain an outdated draft. */
      }
    }
    return useEkiHubStore.subscribe(
      ({ rows, mode, fairnessWeight, fareWeight }) => {
        try {
          sessionStorage.setItem(
            KEY,
            JSON.stringify({
              rows: rows.map(({ name, people }) => ({ name, people })),
              mode,
              fairnessWeight,
              fareWeight,
            }),
          );
        } catch {
          /* Navigation still preserves the in-memory store. */
        }
      },
    );
  }, []);
}
