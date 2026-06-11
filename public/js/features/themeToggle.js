// テーマ切替モジュール（ダーク / ライト / 自動）
// window.EkiHub を介してコアと連携する。グローバル汚染は行わない。
(() => {
  "use strict";

  // EkiHub コアが未読込なら何もしない
  if (!window.EkiHub) return;
  const E = window.EkiHub;

  // ===== 定数定義 =====
  // 永続化キー
  const STORAGE_KEY = "ekihub-theme";
  // テーマの循環順
  const THEME_ORDER = ["dark", "light", "sakura", "forest", "high-contrast", "auto"];
  // 既定テーマ（:root がダークのため dark を既定とする）
  const DEFAULT_THEME = "dark";
  // 自動判定用メディアクエリ（ライト指定を検出）
  const LIGHT_QUERY = "(prefers-color-scheme: light)";
  // ボタン要素の固有 id
  const BUTTON_ID = "themeToggle-btn";
  // ボタンラベル（各テーマの表示名）
  const THEME_LABELS = {
    dark: "ダーク",
    light: "ライト",
    sakura: "サクラ",
    forest: "森",
    "high-contrast": "高コントラスト",
    auto: "自動",
  };

  // ===== モジュール内状態 =====
  // 現在選択中のテーマ（"dark" | "light" | "auto"）
  let currentTheme = DEFAULT_THEME;
  // ボタン要素への参照
  let buttonEl = null;
  // matchMedia の監視対象（auto 追従用）
  let lightMediaQuery = null;

  // ===== スタイル注入 =====
  // 機能固有接頭辞 themeToggle-- を用いる
  E.injectStyle(
    "themeToggle-style",
    `
    .themeToggle--btn {
      min-width: 9em;
      text-align: center;
      white-space: nowrap;
    }
    `
  );

  // 文字列が有効なテーマ値かを判定する
  function isValidTheme(value) {
    return THEME_ORDER.indexOf(value) !== -1;
  }

  // localStorage から保存済みテーマを安全に読み込む
  function loadStoredTheme() {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && isValidTheme(stored)) return stored;
    } catch (err) {
      // ストレージ無効環境（プライベートモード等）では既定値にフォールバック
      console.warn("themeToggle: テーマの読込に失敗しました", err);
    }
    return DEFAULT_THEME;
  }

  // localStorage へテーマを安全に保存する
  function saveTheme(theme) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (err) {
      // 保存失敗時も動作は継続する
      console.warn("themeToggle: テーマの保存に失敗しました", err);
    }
  }

  // auto 選択時に実際に適用すべきテーマ（dark/light）を解決する
  function resolveAutoTheme() {
    // メディアクエリが light に一致すればライト、そうでなければダーク
    if (lightMediaQuery && lightMediaQuery.matches) return "light";
    return "dark";
  }

  // 現在のテーマを document.documentElement の data-theme へ反映する
  function applyTheme() {
    const root = document.documentElement;
    if (!root) return;
    // 実効テーマを算出（auto はメディアクエリで解決）
    const effective =
      currentTheme === "auto" ? resolveAutoTheme() : currentTheme;
    // dark は :root の既定なので属性を外す。それ以外はテーマ名をそのまま付与する
    if (effective === "dark") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", effective);
    }
  }

  // ボタンの表示ラベルを現在状態に合わせて更新する
  function updateButtonLabel() {
    if (!buttonEl) return;
    const label = THEME_LABELS[currentTheme] || THEME_LABELS[DEFAULT_THEME];
    const text = `テーマ: ${label}`;
    // 文字列描画は escapeHtml を通す
    buttonEl.textContent = text;
    // 補助情報（読み上げ・ツールチップ）
    buttonEl.setAttribute(
      "aria-label",
      E.escapeHtml(`現在のテーマは${label}です。クリックで切替`)
    );
    buttonEl.setAttribute("title", E.escapeHtml(text));
  }

  // テーマを設定し、反映・保存・表示更新をまとめて行う
  function setTheme(theme, persist) {
    currentTheme = isValidTheme(theme) ? theme : DEFAULT_THEME;
    applyTheme();
    updateButtonLabel();
    if (persist) saveTheme(currentTheme);
  }

  // ボタン押下で次のテーマへ循環させる
  function cycleTheme() {
    const idx = THEME_ORDER.indexOf(currentTheme);
    const nextIdx = (idx + 1 + THEME_ORDER.length) % THEME_ORDER.length;
    setTheme(THEME_ORDER[nextIdx], true);
  }

  // システムのカラースキーム変化を購読し auto 時に追従する
  function handleSystemSchemeChange() {
    // auto のときのみ実効テーマが変わるため再適用する
    if (currentTheme === "auto") applyTheme();
  }

  // matchMedia の監視を初期化する
  function initMediaQuery() {
    try {
      if (typeof window.matchMedia !== "function") return;
      lightMediaQuery = window.matchMedia(LIGHT_QUERY);
      // 変化を購読（addEventListener 優先、未対応環境は addListener）
      if (typeof lightMediaQuery.addEventListener === "function") {
        lightMediaQuery.addEventListener("change", handleSystemSchemeChange);
      } else if (typeof lightMediaQuery.addListener === "function") {
        lightMediaQuery.addListener(handleSystemSchemeChange);
      }
    } catch (err) {
      // 監視が使えなくても auto は解決時に dark へフォールバックする
      console.warn("themeToggle: メディアクエリ監視の初期化に失敗しました", err);
      lightMediaQuery = null;
    }
  }

  // ツールバーへ切替ボタンを生成・追加する
  function mountButton() {
    const toolbar = document.getElementById("toolbar");
    // 拡張枠が存在しない場合は何もしない（nullガード）
    if (!toolbar) {
      console.warn("themeToggle: #toolbar が見つかりません");
      return;
    }
    buttonEl = document.createElement("button");
    buttonEl.type = "button";
    buttonEl.id = BUTTON_ID;
    // 既存の小さめセカンダリボタン流用 + 機能固有クラス
    buttonEl.className = "tool-btn themeToggle--btn";
    buttonEl.addEventListener("click", cycleTheme);
    toolbar.appendChild(buttonEl);
    updateButtonLabel();
  }

  // ===== 初期化 =====
  function init() {
    try {
      // メディアクエリ監視を先に用意（auto 解決に必要）
      initMediaQuery();
      // 保存済みテーマを読み込み、起動時に即反映する（永続化はしない）
      const stored = loadStoredTheme();
      setTheme(stored, false);
      // ツールバーへボタンを追加
      mountButton();
    } catch (err) {
      // 初期化に失敗しても既定のダーク表示で継続する
      console.error("themeToggle: 初期化に失敗しました", err);
    }
  }

  // DOM 準備状況に応じて初期化を行う
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
