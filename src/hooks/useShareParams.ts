"use client";

import { useEffect, useRef } from "react";

import { parseShareParams } from "@/lib/shareUrl";
import { useEkiHubStore } from "@/stores/useEkiHubStore";

/**
 * 共有リンクで開かれたとき、URL の条件をフォームへ流し込む。
 *
 * 反映は初回の1度きり。以降に利用者が条件を変えても URL へは戻さない
 * （共有は「URLをコピー」を押した時点の条件を配る、という考え方）。
 */
export function useShareParams(onReady: () => void): void {
  const setRows = useEkiHubStore((state) => state.setRows);
  const setMode = useEkiHubStore((state) => state.setMode);
  const setFairnessWeight = useEkiHubStore((state) => state.setFairnessWeight);
  const setFareWeight = useEkiHubStore((state) => state.setFareWeight);
  const hasApplied = useRef(false);

  useEffect(() => {
    if (hasApplied.current) return;
    hasApplied.current = true;

    const params = parseShareParams(window.location.search);
    if (!params) return;

    setRows(params.origins);
    if (params.mode) setMode(params.mode);
    if (params.fairnessWeight !== null) setFairnessWeight(params.fairnessWeight);
    if (params.fareWeight !== null) setFareWeight(params.fareWeight);

    // ストアへ反映されたあとに算出させる
    onReady();
  }, [onReady, setRows, setMode, setFairnessWeight, setFareWeight]);
}
