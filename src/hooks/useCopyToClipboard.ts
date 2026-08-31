"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** コピー完了の表示を残す時間 */
const FEEDBACK_MS = 1800;

/**
 * クリップボードへコピーし、成否を一定時間だけ保持する。
 * ボタンのラベルを「コピーしました」に差し替える用途を想定している。
 */
export function useCopyToClipboard() {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      // 権限が無い・非セキュアな接続などで失敗する
      setStatus("failed");
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setStatus("idle"), FEEDBACK_MS);
  }, []);

  return { status, copy };
}
