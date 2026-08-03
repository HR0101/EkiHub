"use client";

import { useEffect, useState } from "react";

/**
 * 表示を最低でも指定時間は続ける。
 *
 * 算出が一瞬で終わるとローディングが点滅して見えるため、
 * 出したあとは minMs を満たすまで消さない。
 */
export function useMinimumVisible(isActive: boolean, minMs: number): boolean {
  const [isVisible, setIsVisible] = useState(isActive);

  useEffect(() => {
    if (isActive) {
      setIsVisible(true);
      return;
    }
    // 消す側だけ遅らせる（出す側は即座に反映する）
    const timer = setTimeout(() => setIsVisible(false), minMs);
    return () => clearTimeout(timer);
  }, [isActive, minMs]);

  return isVisible;
}
