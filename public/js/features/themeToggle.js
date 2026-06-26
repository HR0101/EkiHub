// テーマ切替モジュール（ピッカー形式）
// ツールバーの「テーマ」ボタンを押すとパネルが開き、
// モード（dark/light/auto）とカラーテーマを個別に選択できる。
(() => {
  "use strict";

  if (!window.EkiHub) return;
  const E = window.EkiHub;

  // ===== モード =====
  const MODE_ORDER = ["dark", "light", "auto"];
  const DEFAULT_MODE = "auto";
  const MODE_STORAGE_KEY = "ekihub-mode";
  const MODE_LABELS = { dark: "ダーク", light: "ライト", auto: "自動" };

  // ===== カラーテーマ =====
  const COLOR_ORDER = ["default", "sakura", "forest", "ocean", "sunset", "autumn", "high-contrast"];
  const DEFAULT_COLOR = "default";
  const COLOR_STORAGE_KEY = "ekihub-color";
  const COLOR_LABELS = {
    default:         "デフォルト",
    sakura:          "サクラ",
    forest:          "森",
    ocean:           "海",
    sunset:          "夕焼け",
    autumn:          "紅葉",
    "high-contrast": "高コントラスト",
  };

  // スウォッチ用グラデーション（accent → accent-3 の代表色）
  const COLOR_GRADIENTS = {
    default:         "linear-gradient(135deg, #5e7bff, #46e0c8)",
    sakura:          "linear-gradient(135deg, #ff6eb4, #ffd166)",
    forest:          "linear-gradient(135deg, #2dd67a, #a8e64a)",
    ocean:           "linear-gradient(135deg, #22d3ee, #a5f3fc)",
    sunset:          "linear-gradient(135deg, #fb923c, #fde68a)",
    autumn:          "linear-gradient(135deg, #f87171, #fbbf24)",
    "high-contrast": "linear-gradient(135deg, #ffdd00, #00ff9d)",
  };

  const LIGHT_QUERY = "(prefers-color-scheme: light)";
  const TRIGGER_ID = "themeToggle-trigger";
  const PANEL_ID   = "themeToggle-panel";

  let currentMode  = DEFAULT_MODE;
  let currentColor = DEFAULT_COLOR;
  let triggerEl    = null;
  let panelEl      = null;
  let isOpen       = false;
  let lightMediaQuery = null;

  // ===== スタイル注入 =====
  E.injectStyle("themeToggle-style", `
    .tt-trigger { white-space: nowrap; position: relative; }

    /* トリガーボタン内の現在テーマを示すドット */
    .tt-dot {
      display: inline-block;
      width: 9px;
      height: 9px;
      border-radius: 50%;
      margin-left: 5px;
      vertical-align: middle;
      border: 1.5px solid rgba(255,255,255,0.25);
      flex-shrink: 0;
    }

    /* ===== フローティングパネル ===== */
    .tt-panel {
      position: fixed;
      z-index: 2000;
      background: var(--bg-panel-solid);
      border: 1px solid var(--border-soft);
      border-radius: 16px;
      padding: 16px 18px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.55);
      width: 264px;
    }

    .tt-panel[hidden] { display: none; }

    .tt-section { margin-bottom: 14px; }
    .tt-section:last-child { margin-bottom: 0; }

    .tt-section__label {
      font-size: 0.68rem;
      font-weight: 700;
      color: var(--text-faint);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 8px;
    }

    /* モードボタン行 */
    .tt-mode-row { display: flex; gap: 6px; }

    .tt-mode-btn {
      flex: 1;
      padding: 8px 4px;
      border-radius: 8px;
      border: 1.5px solid var(--border-soft);
      background: var(--bg-input);
      color: var(--text-sub);
      font-size: 0.8rem;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      transition: border-color 0.18s, color 0.18s;
    }

    .tt-mode-btn.is-active {
      border-color: var(--accent);
      color: var(--accent);
    }

    /* カラースウォッチ行 */
    .tt-swatch-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 8px;
    }

    .tt-swatch {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 3px;
      -webkit-tap-highlight-color: transparent;
    }

    .tt-swatch__circle {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      /* box-shadowでリングを表現：layoutに影響しないため名前テキストに被らない */
      box-shadow: none;
      transition: box-shadow 0.18s, opacity 0.18s;
    }

    .tt-swatch.is-active .tt-swatch__circle {
      /* パネル背景色のギャップ + テキスト色のリング */
      box-shadow:
        0 0 0 3px var(--bg-panel-solid, #141a2c),
        0 0 0 5.5px var(--text-main, #eef2ff);
    }

    .tt-swatch:hover .tt-swatch__circle,
    .tt-swatch:focus-visible .tt-swatch__circle {
      opacity: 0.85;
    }

    .tt-swatch__name {
      font-size: 0.62rem;
      color: var(--text-faint);
      white-space: nowrap;
      font-family: inherit;
      line-height: 1;
    }

    .tt-swatch.is-active .tt-swatch__name {
      color: var(--text-main);
      font-weight: 700;
    }

    /* ===== 区切り線 ===== */
    .tt-divider {
      border: none;
      border-top: 1px solid var(--border-soft);
      margin: 12px 0;
    }
  `);

  // ===== テーマ適用 =====
  function applyTheme() {
    const root = document.documentElement;
    if (!root) return;
    const effectiveMode = currentMode === "auto" ? resolveAutoMode() : currentMode;
    effectiveMode === "dark"
      ? root.removeAttribute("data-mode")
      : root.setAttribute("data-mode", effectiveMode);
    currentColor === "default"
      ? root.removeAttribute("data-color")
      : root.setAttribute("data-color", currentColor);
  }

  function resolveAutoMode() {
    return lightMediaQuery && lightMediaQuery.matches ? "light" : "dark";
  }

  // ===== localStorage =====
  function loadStored() {
    try {
      const m = window.localStorage.getItem(MODE_STORAGE_KEY);
      if (m && MODE_ORDER.indexOf(m) !== -1) currentMode = m;
      const c = window.localStorage.getItem(COLOR_STORAGE_KEY);
      if (c && COLOR_ORDER.indexOf(c) !== -1) currentColor = c;
    } catch (e) { /* ignore */ }
  }

  function saveStored() {
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, currentMode);
      window.localStorage.setItem(COLOR_STORAGE_KEY, currentColor);
    } catch (e) { /* ignore */ }
  }

  // ===== パネル =====
  function buildPanel() {
    if (document.getElementById(PANEL_ID)) return;

    panelEl = document.createElement("div");
    panelEl.id = PANEL_ID;
    panelEl.className = "tt-panel";
    panelEl.setAttribute("hidden", "");
    panelEl.setAttribute("role", "dialog");
    panelEl.setAttribute("aria-label", "テーマ設定");

    // ── モードセクション ──
    const modeSection = document.createElement("div");
    modeSection.className = "tt-section";
    const modeLabel = document.createElement("div");
    modeLabel.className = "tt-section__label";
    modeLabel.textContent = "モード";
    const modeRow = document.createElement("div");
    modeRow.className = "tt-mode-row";
    MODE_ORDER.forEach((mode) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tt-mode-btn" + (mode === currentMode ? " is-active" : "");
      btn.textContent = MODE_LABELS[mode];
      btn.dataset.mode = mode;
      btn.addEventListener("click", () => selectMode(mode));
      modeRow.appendChild(btn);
    });
    modeSection.appendChild(modeLabel);
    modeSection.appendChild(modeRow);

    const divider = document.createElement("hr");
    divider.className = "tt-divider";

    // ── カラーセクション ──
    const colorSection = document.createElement("div");
    colorSection.className = "tt-section";
    const colorLabel = document.createElement("div");
    colorLabel.className = "tt-section__label";
    colorLabel.textContent = "カラー";
    const swatchRow = document.createElement("div");
    swatchRow.className = "tt-swatch-row";
    COLOR_ORDER.forEach((color) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tt-swatch" + (color === currentColor ? " is-active" : "");
      btn.dataset.color = color;
      btn.addEventListener("click", () => selectColor(color));

      const circle = document.createElement("span");
      circle.className = "tt-swatch__circle";
      circle.style.background = COLOR_GRADIENTS[color] || "#888";

      const name = document.createElement("span");
      name.className = "tt-swatch__name";
      name.textContent = COLOR_LABELS[color];

      btn.appendChild(circle);
      btn.appendChild(name);
      swatchRow.appendChild(btn);
    });
    colorSection.appendChild(colorLabel);
    colorSection.appendChild(swatchRow);

    panelEl.appendChild(modeSection);
    panelEl.appendChild(divider);
    panelEl.appendChild(colorSection);
    document.body.appendChild(panelEl);
  }

  // パネルをトリガーボタンの下に配置する
  function positionPanel() {
    if (!triggerEl || !panelEl) return;
    const rect = triggerEl.getBoundingClientRect();
    const panelW = 264;
    const gap = 6;

    let top  = rect.bottom + gap;
    let left = rect.left;

    // 右端から見切れる場合は右寄せ
    if (left + panelW > window.innerWidth - 12) {
      left = window.innerWidth - panelW - 12;
    }
    left = Math.max(12, left);

    // 画面下端から見切れる場合は上に出す
    const panelH = panelEl.offsetHeight || 200;
    if (top + panelH > window.innerHeight - 12) {
      top = rect.top - panelH - gap;
    }

    panelEl.style.top  = `${Math.max(8, top)}px`;
    panelEl.style.left = `${left}px`;
  }

  function openPanel() {
    if (!panelEl) buildPanel();
    panelEl.removeAttribute("hidden");
    positionPanel();
    isOpen = true;
    // 外側クリックで閉じる（次の tick に登録して即発火を防ぐ）
    window.setTimeout(() => {
      document.addEventListener("pointerdown", onOutsideClick, { once: true });
    }, 0);
  }

  function closePanel() {
    if (panelEl) panelEl.setAttribute("hidden", "");
    isOpen = false;
  }

  function togglePanel() {
    isOpen ? closePanel() : openPanel();
  }

  function onOutsideClick(e) {
    if (panelEl && !panelEl.contains(e.target) && e.target !== triggerEl) {
      closePanel();
    } else if (!panelEl || !panelEl.contains(e.target)) {
      // パネル外なのでそのまま閉じる
    } else {
      // パネル内クリックは閉じない。再度外側クリック待ち
      document.addEventListener("pointerdown", onOutsideClick, { once: true });
    }
  }

  // ===== 選択処理 =====
  function selectMode(mode) {
    currentMode = mode;
    applyTheme();
    saveStored();
    updateTriggerDot();
    // パネル内のアクティブ状態を更新
    if (panelEl) {
      panelEl.querySelectorAll(".tt-mode-btn").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.mode === currentMode);
      });
    }
  }

  function selectColor(color) {
    currentColor = color;
    applyTheme();
    saveStored();
    updateTriggerDot();
    if (panelEl) {
      panelEl.querySelectorAll(".tt-swatch").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.color === currentColor);
      });
    }
    closePanel();
  }

  // トリガーボタンのドットを現在テーマのグラデーションに更新する
  function updateTriggerDot() {
    if (!triggerEl) return;
    const dot = triggerEl.querySelector(".tt-dot");
    if (dot) dot.style.background = COLOR_GRADIENTS[currentColor] || COLOR_GRADIENTS.default;
  }

  // ===== ツールバーへボタン設置 =====
  function mountTrigger() {
    const toolbar = document.getElementById("toolbar");
    if (!toolbar) return;
    if (document.getElementById(TRIGGER_ID)) {
      triggerEl = document.getElementById(TRIGGER_ID);
      updateTriggerDot();
      return;
    }

    triggerEl = document.createElement("button");
    triggerEl.type = "button";
    triggerEl.id = TRIGGER_ID;
    triggerEl.className = "tool-btn tt-trigger";
    triggerEl.setAttribute("aria-haspopup", "dialog");
    triggerEl.setAttribute("aria-expanded", "false");

    const label = document.createElement("span");
    label.textContent = "テーマ";

    const dot = document.createElement("span");
    dot.className = "tt-dot";
    dot.setAttribute("aria-hidden", "true");

    triggerEl.appendChild(label);
    triggerEl.appendChild(dot);
    triggerEl.addEventListener("click", togglePanel);
    toolbar.appendChild(triggerEl);
    updateTriggerDot();
  }

  // ===== システムテーマ追従 =====
  function initMediaQuery() {
    try {
      if (typeof window.matchMedia !== "function") return;
      lightMediaQuery = window.matchMedia(LIGHT_QUERY);
      const handler = () => { if (currentMode === "auto") applyTheme(); };
      if (typeof lightMediaQuery.addEventListener === "function") {
        lightMediaQuery.addEventListener("change", handler);
      } else if (typeof lightMediaQuery.addListener === "function") {
        lightMediaQuery.addListener(handler);
      }
    } catch (e) { lightMediaQuery = null; }
  }

  // Escape で閉じる
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) closePanel();
  });

  // ===== 初期化 =====
  function init() {
    try {
      initMediaQuery();
      loadStored();
      applyTheme();
      mountTrigger();
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
