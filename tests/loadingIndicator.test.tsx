// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { DESIGN_THEMES } from "@/lib/designTheme";

afterEach(cleanup);
it.each(DESIGN_THEMES)("renders accessible animated status in $id", ({ id }) => {
  document.documentElement.dataset.design = id;
  const { container } = render(<LoadingIndicator label="周辺スポットを探しています" />);
  expect(screen.getByRole("status").textContent).toContain("周辺スポットを探しています");
  expect(container.querySelectorAll('.loading-indicator__motion[aria-hidden="true"] i')).toHaveLength(3);
});

it("selects a different animation for every design when the theme changes", () => {
  const style = document.createElement("style");
  const css = readFileSync("app/themes/shared.css", "utf8");
  style.textContent = css.slice(css.indexOf("/* One accessible status"), css.indexOf("/* Candidate scope:"));
  document.head.append(style);
  try {
    const { container } = render(<LoadingIndicator label="検索中" />);
    const dot = container.querySelector("i")!;
    const animations = new Set<string>();
    for (const { id } of DESIGN_THEMES) {
      document.documentElement.dataset.design = id;
      const computed = getComputedStyle(dot);
      const name = computed.animationName || (computed.animation.split(" ")[0] ?? "");
      expect(name).toMatch(/^loading-/);
      animations.add(name);
    }
    expect(animations.size).toBe(DESIGN_THEMES.length);
    // Reduced-motion declarations must override theme-specific animations.
    const sheet = style.sheet!;
    const media = Array.from(sheet.cssRules).find(
      (rule) => rule instanceof CSSMediaRule && rule.conditionText === "(prefers-reduced-motion: reduce)",
    ) as CSSMediaRule;
    expect(media).toBeDefined();
    const reduced = document.createElement("style");
    reduced.textContent = Array.from(media.cssRules).map((rule) => rule.cssText).join("\n");
    document.head.append(reduced);
    try {
      for (const { id } of DESIGN_THEMES) {
        document.documentElement.dataset.design = id;
        expect(getComputedStyle(dot).animation).toBe("none");
      }
    } finally { reduced.remove(); }
  } finally { style.remove(); }
});
