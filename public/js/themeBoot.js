// テーマ初期適用スクリプト（全ページ共通）
//
// 【重要】CSP の script-src に 'unsafe-inline' を含めていないため、
// HTML の <head> に直接書いたテーマ復元処理はブラウザにブロックされる。
// テーマの復元は必ずこの外部ファイル経由で行うこと。
//
// <head> 内で（defer を付けずに）同期読み込みし、本文の描画前に
// data-mode / data-color を確定させることでテーマのちらつきを防ぐ。
(() => {
  "use strict";

  // localStorage キー（js/features/themeToggle.js と共有。変更時は両方を揃える）
  const MODE_STORAGE_KEY = "ekihub-mode";
  const COLOR_STORAGE_KEY = "ekihub-color";

  const AUTO_MODE = "auto";
  const DARK_MODE = "dark";
  const LIGHT_MODE = "light";
  const HIGH_CONTRAST_COLOR = "high-contrast";

  const VALID_MODES = [DARK_MODE, LIGHT_MODE, AUTO_MODE];
  const VALID_COLORS = [
    "default",
    "sakura",
    "forest",
    "ocean",
    "sunset",
    "autumn",
    HIGH_CONTRAST_COLOR,
  ];
  const DEFAULT_MODE = AUTO_MODE;
  const DEFAULT_COLOR = "default";

  const LIGHT_QUERY = "(prefers-color-scheme: light)";

  // ブラウザUI（モバイルのアドレスバー等）の色。style.css の --bg-base と揃える。
  const THEME_COLOR_DARK = "#0a0e1a";
  const THEME_COLOR_LIGHT = "#eef1f8";
  const THEME_COLOR_HIGH_CONTRAST = "#000000";

  let lightMediaQuery = null;
  let mediaQueryResolved = false;

  // システムの配色を判定する MediaQueryList を取得する（取得結果はキャッシュする）
  function getLightMediaQuery() {
    if (mediaQueryResolved) return lightMediaQuery;
    mediaQueryResolved = true;
    try {
      if (typeof window.matchMedia !== "function") return null;
      lightMediaQuery = window.matchMedia(LIGHT_QUERY);
    } catch (error) {
      lightMediaQuery = null;
    }
    return lightMediaQuery;
  }

  // localStorage から許可値のみを読み出す（不正値・アクセス不可時は既定値へ）
  function readStored(key, allowedValues, fallback) {
    try {
      const value = window.localStorage.getItem(key);
      return allowedValues.indexOf(value) !== -1 ? value : fallback;
    } catch (error) {
      // プライベートモード等で localStorage が使えない場合は既定値で動かす
      return fallback;
    }
  }

  // "auto" を実際の配色（dark / light）へ解決する
  function resolveEffectiveMode(mode) {
    if (mode !== AUTO_MODE) return mode;
    const query = getLightMediaQuery();
    return query && query.matches ? LIGHT_MODE : DARK_MODE;
  }

  // 実際の背景が暗い面かどうか。
  // ハイコントラストは data-mode に関わらず黒背景（style.css）なので常に暗い扱い。
  function isDarkSurface(effectiveMode, color) {
    if (color === HIGH_CONTRAST_COLOR) return true;
    return effectiveMode !== LIGHT_MODE;
  }

  // ブラウザUIの色を現在のテーマに合わせる。
  // <meta name="theme-color"> はこのスクリプトより前に置くこと（無ければ何もしない）。
  function updateThemeColorMeta(effectiveMode, color) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    let themeColor = THEME_COLOR_DARK;
    if (color === HIGH_CONTRAST_COLOR) {
      themeColor = THEME_COLOR_HIGH_CONTRAST;
    } else if (effectiveMode === LIGHT_MODE) {
      themeColor = THEME_COLOR_LIGHT;
    }
    meta.setAttribute("content", themeColor);
  }

  // モードとカラーを <html> の data 属性へ反映する（テーマ適用の唯一の入口）
  function applyTheme(mode, color) {
    const root = document.documentElement;
    if (!root) return;

    const effectiveMode = resolveEffectiveMode(mode);

    // dark は :root の既定値なので属性を付けない（CSS の上書きを最小限に保つ）
    if (effectiveMode === DARK_MODE) {
      root.removeAttribute("data-mode");
    } else {
      root.setAttribute("data-mode", effectiveMode);
    }

    if (color === DEFAULT_COLOR) {
      root.removeAttribute("data-color");
    } else {
      root.setAttribute("data-color", color);
    }

    // スクロールバーやフォーム部品の配色もテーマへ追従させる
    root.style.colorScheme = isDarkSurface(effectiveMode, color) ? "dark" : "light";
    updateThemeColorMeta(effectiveMode, color);
  }

  // 保存済みの設定を読み出して適用する
  function applyStoredTheme() {
    applyTheme(
      readStored(MODE_STORAGE_KEY, VALID_MODES, DEFAULT_MODE),
      readStored(COLOR_STORAGE_KEY, VALID_COLORS, DEFAULT_COLOR)
    );
  }

  // モードが "auto" のとき、OS の配色切替へ追従する
  function watchSystemMode() {
    const query = getLightMediaQuery();
    if (!query) return;
    const handler = () => {
      if (readStored(MODE_STORAGE_KEY, VALID_MODES, DEFAULT_MODE) === AUTO_MODE) {
        applyStoredTheme();
      }
    };
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", handler);
    } else if (typeof query.addListener === "function") {
      // 旧 Safari 向けフォールバック
      query.addListener(handler);
    }
  }

  // 他タブでテーマが変更された場合に追従する（トップと使い方ページの併用時など）
  function watchStorageChange() {
    window.addEventListener("storage", (event) => {
      if (event.key === MODE_STORAGE_KEY || event.key === COLOR_STORAGE_KEY) {
        applyStoredTheme();
      }
    });
  }

  // 他モジュール（themeToggle.js）から再利用するための最小 API
  window.EkiHubTheme = {
    apply: applyTheme,
    applyStored: applyStoredTheme,
    MODE_STORAGE_KEY,
    COLOR_STORAGE_KEY,
    VALID_MODES,
    VALID_COLORS,
  };

  try {
    applyStoredTheme();
    watchSystemMode();
    watchStorageChange();
  } catch (error) {
    // テーマ適用の失敗でページ表示を止めない（既定のダークテーマのまま表示される）
    if (window.console) console.error("themeBoot: テーマの適用に失敗しました", error);
  }
})();
