/**
 * CSS 変数を JavaScript から読む。
 *
 * 配色の実体は app/globals.css の :root（--brand-*）だけに置いてある。
 * 地図のピンやブラウザUIの色のように JS 側で色が要る場面でも、
 * ここを通して読むことで定義が二重にならず、
 * テーマを切り替えたときも自動で追従する。
 */

/** 変数が読めなかったときに使う色（SSR や取得失敗時） */
const FALLBACK = "#0284c7";

/**
 * 指定した CSS 変数の現在値を返す。
 * サーバー側では document が無いため、フォールバックを返す。
 */
export function cssVar(name: string, fallback: string = FALLBACK): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

/** 画面で使う色をまとめて読む（地図など、複数まとめて要る場面向け） */
export function readThemeColors() {
  return {
    accent: cssVar("--accent"),
    accentSupport: cssVar("--accent-3"),
    surface: cssVar("--bg-base", "#f3f7fa"),
  };
}
