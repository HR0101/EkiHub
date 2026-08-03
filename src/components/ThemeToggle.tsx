"use client";

import { useEffect, useRef, useState } from "react";

import {
  COLOR_LABELS,
  MODE_LABELS,
  THEME_COLORS,
  THEME_MODES,
  applyTheme,
  readStoredTheme,
  storeTheme,
  type ThemeColor,
  type ThemeMode,
} from "@/lib/theme";

/**
 * テーマの切替。
 *
 * 初期表示は <head> の同期スクリプトが済ませているので、
 * ここは「いま何が選ばれているか」を読み直して操作を受け付けるだけ。
 */
export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("light");
  const [color, setColor] = useState<ThemeColor>("default");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 保存済みの選択を読み直す（localStorage はサーバーで読めないのでマウント後）
  useEffect(() => {
    const stored = readStoredTheme();
    setMode(stored.mode);
    setColor(stored.color);
  }, []);

  // 「端末に合わせる」を選んでいる間は OS の切替に追従する
  useEffect(() => {
    if (mode !== "auto") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme("auto", color);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, [mode, color]);

  // パネルの外を押したら閉じる
  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  function update(nextMode: ThemeMode, nextColor: ThemeColor) {
    setMode(nextMode);
    setColor(nextColor);
    applyTheme(nextMode, nextColor);
    storeTheme(nextMode, nextColor);
  }

  return (
    <div className="theme-toggle" ref={wrapperRef}>
      <button
        type="button"
        className="tool-btn"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen((current) => !current)}
      >
        テーマ
        <span className="theme-toggle__dot" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="theme-toggle__panel" role="dialog" aria-label="テーマ設定">
          <fieldset className="theme-toggle__group">
            <legend className="theme-toggle__legend">明るさ</legend>
            <div className="theme-toggle__options">
              {THEME_MODES.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`theme-toggle__option ${mode === option ? "is-active" : ""}`}
                  aria-pressed={mode === option}
                  onClick={() => update(option, color)}
                >
                  {MODE_LABELS[option]}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="theme-toggle__group">
            <legend className="theme-toggle__legend">色</legend>
            <div className="theme-toggle__options">
              {THEME_COLORS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`theme-toggle__option ${color === option ? "is-active" : ""}`}
                  aria-pressed={color === option}
                  onClick={() => update(mode, option)}
                >
                  {COLOR_LABELS[option]}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}
