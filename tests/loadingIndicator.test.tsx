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
it("shares animation across themes and respects reduced motion", () => {
  const css = readFileSync("app/themes/shared.css", "utf8");
  expect(css).toMatch(/\.loading-indicator__motion i\s*\{[^}]*animation: spot-loading-bounce/);
  expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.loading-indicator__motion i\s*\{\s*animation: none/);
});
