import { cssVar } from "@/lib/cssVar";

/** No default: each document load chooses from these eight designs. */
export const DESIGN_THEMES = [
  { id: "y2k", name: "Y2K / CHROME", dark: false },
  { id: "terminal", name: "TERMINAL / MONO", dark: true },
  { id: "mobile", name: "MOBILE / FRIENDLY", dark: false },
  { id: "retro", name: "RETRO / DESKTOP", dark: false },
  { id: "clay", name: "CLAY / TOY", dark: false },
  { id: "neumo", name: "SOFT / NEUMORPHIC", dark: false },
  { id: "glass", name: "GLASS / AURORA", dark: false },
  { id: "violet", name: "VIOLET / SOFT POP", dark: false },
] as const;
export type DesignTheme = (typeof DESIGN_THEMES)[number]["id"];

export function isDesignTheme(value: unknown): value is DesignTheme {
  return DESIGN_THEMES.some((theme) => theme.id === value);
}

export function randomDesignTheme(): DesignTheme {
  return DESIGN_THEMES[Math.floor(Math.random() * DESIGN_THEMES.length)]!.id;
}

export function applyDesignTheme(id: DesignTheme) {
  const root = document.documentElement;
  const theme = DESIGN_THEMES.find((item) => item.id === id)!;
  // Legacy color settings must not alter a design's intentional palette.
  root.removeAttribute("data-color");
  if (theme.dark) root.setAttribute("data-mode", "dark");
  else root.removeAttribute("data-mode");
  root.dataset.design = id;
  root.style.colorScheme = theme.dark ? "dark" : "light";
  window.dispatchEvent(new Event("ekihub-design-change"));
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content", cssVar("--bg-base", "#f3f7fa"),
  );
}

/** Reuse the boot choice across client-side route changes; never persist it. */
export function readDesignTheme(): DesignTheme {
  const current = document.documentElement.dataset.design;
  if (isDesignTheme(current)) return current;
  const id = randomDesignTheme();
  applyDesignTheme(id);
  return id;
}

/** Runs before paint, independently of localStorage availability. */
export const DESIGN_BOOT_SCRIPT = `
(function () {
  var themes = ${JSON.stringify(DESIGN_THEMES)};
  var theme = themes[Math.floor(Math.random() * themes.length)];
  var root = document.documentElement;
  root.removeAttribute("data-color");
  if (theme.dark) root.setAttribute("data-mode", "dark");
  else root.removeAttribute("data-mode");
  root.setAttribute("data-design", theme.id);
  root.style.colorScheme = theme.dark ? "dark" : "light";
})();
`.trim();
