// テーマ切替モジュール
// モード（dark/light/auto）とカラーテーマ（default/sakura/forest/high-contrast）を
// 独立した2ボタンで切り替える。組み合わせは自由（例: ライト+サクラ）。
// window.EkiHub を介してコアと連携する。グローバル汚染は行わない。
(() => {
  "use strict";

  if (!window.EkiHub) return;
  const E = window.EkiHub;

  // ===== モード（背景・文字色） =====
  const MODE_ORDER = ["dark", "light", "auto"];
  const DEFAULT_MODE = "dark";
  const MODE_STORAGE_KEY = "ekihub-mode";
  const MODE_BTN_ID = "themeToggle-mode-btn";
  const MODE_LABELS = { dark: "ダーク", light: "ライト", auto: "自動" };

  // ===== カラーテーマ（アクセント色） =====
  const COLOR_ORDER = ["default", "sakura", "forest", "high-contrast"];
  const DEFAULT_COLOR = "default";
  const COLOR_STORAGE_KEY = "ekihub-color";
  const COLOR_BTN_ID = "themeToggle-color-btn";
  const COLOR_LABELS = {
    default: "デフォルト",
    sakura: "サクラ",
    forest: "森",
    "high-contrast": "高コントラスト",
  };

  const LIGHT_QUERY = "(prefers-color-scheme: light)";

  let currentMode = DEFAULT_MODE;
  let currentColor = DEFAULT_COLOR;
  let modeBtnEl = null;
  let colorBtnEl = null;
  let lightMediaQuery = null;

  E.injectStyle(
    "themeToggle-style",
    `
    .themeToggle--btn {
      min-width: 7.5em;
      text-align: center;
      white-space: nowrap;
    }
    `
  );

  // バリデーション
  const isValidMode = (v) => MODE_ORDER.indexOf(v) !== -1;
  const isValidColor = (v) => COLOR_ORDER.indexOf(v) !== -1;

  // localStorage から読み込む
  function loadStored() {
    try {
      const m = window.localStorage.getItem(MODE_STORAGE_KEY);
      if (m && isValidMode(m)) currentMode = m;
      const c = window.localStorage.getItem(COLOR_STORAGE_KEY);
      if (c && isValidColor(c)) currentColor = c;
    } catch (err) {
      console.warn("themeToggle: 設定の読込に失敗しました", err);
    }
  }

  // localStorage に保存する
  function saveStored() {
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, currentMode);
      window.localStorage.setItem(COLOR_STORAGE_KEY, currentColor);
    } catch (err) {
      console.warn("themeToggle: 設定の保存に失敗しました", err);
    }
  }

  // auto のときの実効モードを解決する
  function resolveAutoMode() {
    return lightMediaQuery && lightMediaQuery.matches ? "light" : "dark";
  }

  // data-mode / data-color を DOM へ反映する
  function applyTheme() {
    const root = document.documentElement;
    if (!root) return;

    const effectiveMode = currentMode === "auto" ? resolveAutoMode() : currentMode;

    // モード: dark はデフォルト（:root）なので属性不要
    if (effectiveMode === "dark") {
      root.removeAttribute("data-mode");
    } else {
      root.setAttribute("data-mode", effectiveMode);
    }

    // カラー: default は属性不要
    if (currentColor === "default") {
      root.removeAttribute("data-color");
    } else {
      root.setAttribute("data-color", currentColor);
    }
  }

  // ボタンラベルを現在の状態に合わせて更新する
  function updateLabels() {
    if (modeBtnEl) {
      const label = MODE_LABELS[currentMode] || MODE_LABELS[DEFAULT_MODE];
      modeBtnEl.textContent = `モード: ${label}`;
      modeBtnEl.setAttribute("title", `モード: ${label}`);
      modeBtnEl.setAttribute("aria-label", `現在のモードは${label}。クリックで切替`);
    }
    if (colorBtnEl) {
      const label = COLOR_LABELS[currentColor] || COLOR_LABELS[DEFAULT_COLOR];
      colorBtnEl.textContent = `カラー: ${label}`;
      colorBtnEl.setAttribute("title", `カラー: ${label}`);
      colorBtnEl.setAttribute("aria-label", `現在のカラーは${label}。クリックで切替`);
    }
  }

  // モードを次へ循環させる
  function cycleMode() {
    const idx = MODE_ORDER.indexOf(currentMode);
    currentMode = MODE_ORDER[(idx + 1) % MODE_ORDER.length];
    applyTheme();
    updateLabels();
    saveStored();
  }

  // カラーテーマを次へ循環させる
  function cycleColor() {
    const idx = COLOR_ORDER.indexOf(currentColor);
    currentColor = COLOR_ORDER[(idx + 1) % COLOR_ORDER.length];
    applyTheme();
    updateLabels();
    saveStored();
  }

  // システムのカラースキーム変化に追従する（auto 時のみ有効）
  function handleSystemSchemeChange() {
    if (currentMode === "auto") applyTheme();
  }

  function initMediaQuery() {
    try {
      if (typeof window.matchMedia !== "function") return;
      lightMediaQuery = window.matchMedia(LIGHT_QUERY);
      if (typeof lightMediaQuery.addEventListener === "function") {
        lightMediaQuery.addEventListener("change", handleSystemSchemeChange);
      } else if (typeof lightMediaQuery.addListener === "function") {
        lightMediaQuery.addListener(handleSystemSchemeChange);
      }
    } catch (err) {
      console.warn("themeToggle: メディアクエリ監視の初期化に失敗しました", err);
      lightMediaQuery = null;
    }
  }

  // ツールバーへ2つのボタンを生成・追加する
  function mountButtons() {
    const toolbar = document.getElementById("toolbar");
    if (!toolbar) {
      console.warn("themeToggle: #toolbar が見つかりません");
      return;
    }

    // モードボタン（二重生成防止）
    if (!document.getElementById(MODE_BTN_ID)) {
      modeBtnEl = document.createElement("button");
      modeBtnEl.type = "button";
      modeBtnEl.id = MODE_BTN_ID;
      modeBtnEl.className = "tool-btn themeToggle--btn";
      modeBtnEl.addEventListener("click", cycleMode);
      toolbar.appendChild(modeBtnEl);
    } else {
      modeBtnEl = document.getElementById(MODE_BTN_ID);
    }

    // カラーボタン（二重生成防止）
    if (!document.getElementById(COLOR_BTN_ID)) {
      colorBtnEl = document.createElement("button");
      colorBtnEl.type = "button";
      colorBtnEl.id = COLOR_BTN_ID;
      colorBtnEl.className = "tool-btn themeToggle--btn";
      colorBtnEl.addEventListener("click", cycleColor);
      toolbar.appendChild(colorBtnEl);
    } else {
      colorBtnEl = document.getElementById(COLOR_BTN_ID);
    }

    updateLabels();
  }

  // ===== 初期化 =====
  function init() {
    try {
      initMediaQuery();
      loadStored();
      applyTheme();
      mountButtons();
    } catch (err) {
      console.error("themeToggle: 初期化に失敗しました", err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
