// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SiteMotion } from "@/components/SiteMotion";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
let enter: IntersectionObserverCallback;
let motionChange: () => void;
let preference: { matches: boolean; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
const cancel = vi.fn();
const animate = vi.fn(() => ({ cancel, onfinish: null }));
const observe = vi.fn();
const unobserve = vi.fn();
const disconnect = vi.fn();
const originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, "animate");

beforeEach(() => {
  pathname = "/";
  vi.clearAllMocks();
  preference = { matches: false, addEventListener: vi.fn((_event, listener) => { motionChange = listener; }), removeEventListener: vi.fn() };
  vi.stubGlobal("matchMedia", vi.fn(() => preference));
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { enter = callback; }
    observe = observe;
    unobserve = unobserve;
    disconnect = disconnect;
  });
  Object.defineProperty(Element.prototype, "animate", { configurable: true, value: animate });
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({ length: 1 } as DOMRectList);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalAnimate) Object.defineProperty(Element.prototype, "animate", originalAnimate);
  else Reflect.deleteProperty(Element.prototype, "animate");
});

function visible(target: Element) {
  act(() => enter([{ target, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
}

it("keeps content visible before observation and reveals each group only once", () => {
  const { container } = render(<><SiteMotion /><h1 className="hero__title">駅を探す</h1></>);
  const heading = container.querySelector("h1")!;
  expect(heading.style.opacity).toBe("");
  expect(heading.hidden).toBe(false);
  expect(animate).not.toHaveBeenCalled();
  visible(heading);
  visible(heading);
  expect(animate).toHaveBeenCalledOnce();
  expect(unobserve).toHaveBeenCalledWith(heading);
});

it("respects reduced motion and cancels running entrances when it is enabled", () => {
  const { container } = render(<><SiteMotion /><div className="input-workspace" /></>);
  visible(container.querySelector(".input-workspace")!);
  preference.matches = true;
  act(() => motionChange());
  expect(cancel).toHaveBeenCalledOnce();
  expect(disconnect).toHaveBeenCalled();
  cleanup();
  animate.mockClear();
  render(<><SiteMotion /><div className="member-login" /></>);
  expect(animate).not.toHaveBeenCalled();
});

it("observes late results and releases animations and observers when navigating", async () => {
  const { container, rerender } = render(<><SiteMotion /><div /></>);
  await act(async () => {
    const result = document.createElement("div");
    result.className = "result-overview";
    container.appendChild(result);
  });
  const result = container.querySelector(".result-overview")!;
  expect(observe).toHaveBeenCalledWith(result);
  visible(result);
  pathname = "/account";
  rerender(<><SiteMotion /><div /></>);
  expect(cancel).toHaveBeenCalledOnce();
  expect(disconnect).toHaveBeenCalledOnce();
  expect((result as HTMLElement).dataset.motion).toBeUndefined();
});
