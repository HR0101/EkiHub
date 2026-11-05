// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HowToContent } from "@/components/HowToContent";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { useEkiHubStore } from "@/stores/useEkiHubStore";

let reducedMotion = false;
let hidden = false;
function mount() { return render(<LocaleProvider><HowToContent /></LocaleProvider>); }
function tick(ms: number) { act(() => vi.advanceTimersByTime(ms)); }

beforeEach(() => {
  vi.useFakeTimers();
  reducedMotion = false;
  hidden = false;
  localStorage.clear();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: reducedMotion, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("plays all five scenes once, stops at sharing, and can replay", () => {
  mount();
  expect(screen.getByRole("heading", { level: 2, name: "最寄駅を入力" })).toBeDefined();
  tick(7000);
  expect(screen.getByRole("heading", { level: 2, name: "候補にする駅を選ぶ" })).toBeDefined();
  tick(28000);
  expect(screen.getByRole("heading", { level: 2, name: "リンクで共有" })).toBeDefined();
  expect(screen.getByRole("button", { name: "もう一度見る" })).toBeDefined();
  tick(14000);
  expect(screen.getByRole("heading", { level: 2, name: "リンクで共有" })).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "もう一度見る" }));
  expect(screen.getByRole("heading", { level: 2, name: "最寄駅を入力" })).toBeDefined();
});

it("pauses, resumes the remaining time, and stops autoplay on manual navigation", () => {
  mount();
  tick(3000);
  fireEvent.click(screen.getByRole("button", { name: "一時停止" }));
  tick(10000);
  expect(screen.getByRole("heading", { level: 2, name: "最寄駅を入力" })).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "再生する" }));
  tick(4000);
  expect(screen.getByRole("heading", { level: 2, name: "候補にする駅を選ぶ" })).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "4. 集合駅の候補を比べる" }));
  tick(14000);
  expect(screen.getByRole("heading", { level: 2, name: "集合駅の候補を比べる" })).toBeDefined();
  expect(screen.getByRole("button", { name: "4. 集合駅の候補を比べる" }).getAttribute("aria-current")).toBe("step");
});

it("uses static, manually navigable scenes when reduced motion is requested", () => {
  reducedMotion = true;
  mount();
  tick(14000);
  expect(screen.queryByRole("button", { name: "一時停止" })).toBeNull();
  expect(screen.getByRole("heading", { level: 2, name: "最寄駅を入力" })).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
  expect(screen.getByRole("heading", { level: 2, name: "候補にする駅を選ぶ" })).toBeDefined();
  expect(screen.getByText(/動きを抑えて表示/)).toBeDefined();
});

it("pauses on backgrounding without restarting automatically", () => {
  mount();
  tick(2000);
  hidden = true;
  fireEvent(document, new Event("visibilitychange"));
  tick(14000);
  hidden = false;
  fireEvent(document, new Event("visibilitychange"));
  tick(7000);
  expect(screen.getByRole("heading", { level: 2, name: "最寄駅を入力" })).toBeDefined();
  expect(screen.getByRole("button", { name: "再生する" })).toBeDefined();
});

it("waits while the demonstration is off screen and resumes when it enters view", () => {
  let updateVisibility: IntersectionObserverCallback;
  const disconnect = vi.fn();
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { updateVisibility = callback; }
    observe = vi.fn();
    disconnect = disconnect;
  });
  const { unmount } = mount();
  act(() => updateVisibility([{ isIntersecting: true, intersectionRatio: 0.05 } as IntersectionObserverEntry], {} as IntersectionObserver));
  tick(14000);
  expect(screen.getByRole("heading", { level: 2, name: "最寄駅を入力" })).toBeDefined();
  act(() => updateVisibility([{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry], {} as IntersectionObserver));
  tick(7000);
  expect(screen.getByRole("heading", { level: 2, name: "候補にする駅を選ぶ" })).toBeDefined();
  unmount();
  expect(disconnect).toHaveBeenCalledTimes(2);
});

it("translates the tour and leaves actual search conditions untouched", () => {
  useEkiHubStore.getState().setRows([{ name: "東京", people: 3 }, { name: "大宮", people: 2 }]);
  const rows = useEkiHubStore.getState().rows;
  mount();
  fireEvent.click(screen.getByRole("button", { name: "English" }));
  expect(screen.getByRole("heading", { level: 1, name: "From stations to a meeting place" })).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "5. Share a link" }));
  expect(screen.getByRole("heading", { level: 2, name: "Share a link" })).toBeDefined();
  expect(screen.getByRole("link", { name: /Find your meeting station/ }).getAttribute("href")).toBe("/");
  expect(useEkiHubStore.getState().rows).toEqual(rows);
});
