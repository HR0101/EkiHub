/**
 * テーマ（明暗モード＋カラー）の定義と保存。
 *
 * 実際の見た目は CSS 側の [data-mode] / [data-color] で切り替わる。
 * light は :root の既定値なので data-mode を付けない——
 * この対応は app/globals.css の [data-mode="dark"] と対になっているので、
 * どちらかを変えるときは必ず両方を揃えること。
 */

export const MODE_STORAGE_KEY = "ekihub-mode";
export const COLOR_STORAGE_KEY = "ekihub-color";

export const THEME_MODES = ["light", "dark", "auto"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const THEME_COLORS = [
  "default",
  "sakura",
  "forest",
  "ocean",
  "sunset",
  "autumn",
  "high-contrast",
] as const;
export type ThemeColor = (typeof THEME_COLORS)[number];

export const DEFAULT_MODE: ThemeMode = "light";
export const DEFAULT_COLOR: ThemeColor = "default";

/** 設定画面に出す表示名 */
export const MODE_LABELS: Record<ThemeMode, string> = {
  light: "ライト",
  dark: "ダーク",
  auto: "端末に合わせる",
};

export const COLOR_LABELS: Record<ThemeColor, string> = {
  default: "みどり",
  sakura: "さくら",
  forest: "もり",
  ocean: "うみ",
  sunset: "ゆうやけ",
  autumn: "こうよう",
  "high-contrast": "高コントラスト",
};

/** ブラウザUI（モバイルのアドレスバー等）の色。globals.css の --bg-base と揃える */
const THEME_COLOR_LIGHT = "#f4f8f5";
const THEME_COLOR_DARK = "#10151a";
const THEME_COLOR_HIGH_CONTRAST = "#000000";

/** auto を実際の配色へ解決する */
export function resolveMode(mode: ThemeMode): "light" | "dark" {
  if (mode !== "auto") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** モードとカラーを <html> の data 属性へ反映する（適用の唯一の入口） */
export function applyTheme(mode: ThemeMode, color: ThemeColor): void {
  const root = document.documentElement;
  const effective = resolveMode(mode);

  // light は :root の既定値なので属性を付けない
  if (effective === "light") root.removeAttribute("data-mode");
  else root.setAttribute("data-mode", effective);

  if (color === DEFAULT_COLOR) root.removeAttribute("data-color");
  else root.setAttribute("data-color", color);

  // 高コントラストは data-mode に関わらず黒背景なので、常に暗い扱いにする
  const isDarkSurface = color === "high-contrast" || effective === "dark";
  root.style.colorScheme = isDarkSurface ? "dark" : "light";

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute(
      "content",
      color === "high-contrast"
        ? THEME_COLOR_HIGH_CONTRAST
        : effective === "dark"
          ? THEME_COLOR_DARK
          : THEME_COLOR_LIGHT
    );
  }
}

/** localStorage から許可値だけを読む（使えない環境では既定値） */
export function readStoredTheme(): { mode: ThemeMode; color: ThemeColor } {
  try {
    const mode = localStorage.getItem(MODE_STORAGE_KEY);
    const color = localStorage.getItem(COLOR_STORAGE_KEY);
    return {
      mode: THEME_MODES.includes(mode as ThemeMode)
        ? (mode as ThemeMode)
        : DEFAULT_MODE,
      color: THEME_COLORS.includes(color as ThemeColor)
        ? (color as ThemeColor)
        : DEFAULT_COLOR,
    };
  } catch {
    // プライベートモード等で localStorage が使えない場合
    return { mode: DEFAULT_MODE, color: DEFAULT_COLOR };
  }
}

/** 選択を保存する（失敗しても表示は続ける） */
export function storeTheme(mode: ThemeMode, color: ThemeColor): void {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
    localStorage.setItem(COLOR_STORAGE_KEY, color);
  } catch {
    // 保存できなくてもテーマ自体は当たっているので、何もしない
  }
}

/**
 * 本文の描画前に走らせる復元スクリプト。
 *
 * React のマウントを待つとテーマが一瞬ちらつくので、
 * <head> に同期スクリプトとして差し込んでいる（layout.tsx）。
 * applyTheme と同じ判定をしているため、変更時は両方を合わせること。
 */
export const THEME_BOOT_SCRIPT = `
(function () {
  try {
    var modes = ${JSON.stringify(THEME_MODES)};
    var colors = ${JSON.stringify(THEME_COLORS)};
    var mode = localStorage.getItem(${JSON.stringify(MODE_STORAGE_KEY)});
    var color = localStorage.getItem(${JSON.stringify(COLOR_STORAGE_KEY)});
    if (modes.indexOf(mode) === -1) mode = ${JSON.stringify(DEFAULT_MODE)};
    if (colors.indexOf(color) === -1) color = ${JSON.stringify(DEFAULT_COLOR)};

    var effective = mode === "auto"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : mode;

    var root = document.documentElement;
    if (effective === "light") root.removeAttribute("data-mode");
    else root.setAttribute("data-mode", effective);
    if (color === ${JSON.stringify(DEFAULT_COLOR)}) root.removeAttribute("data-color");
    else root.setAttribute("data-color", color);
    root.style.colorScheme = (color === "high-contrast" || effective === "dark") ? "dark" : "light";
  } catch (e) {
    // 失敗しても既定のライトテーマで表示できるので握りつぶす
  }
})();
`.trim();
