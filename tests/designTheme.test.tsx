// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { DESIGN_BOOT_SCRIPT, DESIGN_THEMES, applyDesignTheme, readDesignTheme } from "@/lib/designTheme";

function boot() { new Function(DESIGN_BOOT_SCRIPT)(); }
function picker() { return render(<LocaleProvider><ThemeToggle /></LocaleProvider>); }

beforeEach(() => {
  document.documentElement.removeAttribute("data-design");
  document.documentElement.removeAttribute("data-color");
  document.documentElement.removeAttribute("data-mode");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("random document theme", () => {
  it("can boot into every one of the eight designs, including both random boundaries", () => {
    DESIGN_THEMES.forEach((theme, index) => {
      vi.spyOn(Math, "random").mockReturnValue(index / DESIGN_THEMES.length);
      boot();
      expect(document.documentElement.dataset.design).toBe(theme.id);
      expect(document.documentElement.style.colorScheme).toBe(theme.dark ? "dark" : "light");
    });
    vi.spyOn(Math, "random").mockReturnValue(0.999999);
    boot();
    expect(document.documentElement.dataset.design).toBe("violet");
  });

  it("ignores stored selections and runs even when storage is inaccessible", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0.5);
    document.documentElement.dataset.color = "forest";
    boot();
    expect(document.documentElement.dataset.design).toBe("y2k");
    expect(document.documentElement.hasAttribute("data-color")).toBe(false);
    boot(); // A new document boot draws again rather than restoring the old choice.
    expect(document.documentElement.dataset.design).toBe("clay");
  });

  it("retains the theme when read on client-side route remounts", () => {
    applyDesignTheme("terminal");
    const random = vi.spyOn(Math, "random");
    expect(readDesignTheme()).toBe("terminal");
    expect(readDesignTheme()).toBe("terminal");
    expect(random).not.toHaveBeenCalled();
  });

  it("updates browser chrome and notifies the map on switches", () => {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
    const update = vi.fn();
    window.addEventListener("ekihub-design-change", update);
    applyDesignTheme("terminal");
    expect(document.documentElement.dataset.mode).toBe("dark");
    applyDesignTheme("glass");
    expect(document.documentElement.hasAttribute("data-mode")).toBe(false);
    expect(meta.content).toBeTruthy();
    expect(update).toHaveBeenCalledTimes(2);
    window.removeEventListener("ekihub-design-change", update);
    meta.remove();
  });
});

describe("design picker", () => {
  it("switches all eight themes, keeps selection across remounts, and never stores it", () => {
    applyDesignTheme("glass");
    const write = vi.spyOn(Storage.prototype, "setItem");
    const view = picker();
    fireEvent.click(screen.getByRole("button", { name: "テーマ" }));
    for (const theme of DESIGN_THEMES) {
      const button = screen.getByRole("button", { name: theme.name });
      fireEvent.click(button);
      expect(button.getAttribute("aria-pressed")).toBe("true");
      expect(document.documentElement.dataset.design).toBe(theme.id);
    }
    expect(write).not.toHaveBeenCalled();
    view.unmount();
    picker();
    fireEvent.click(screen.getByRole("button", { name: "テーマ" }));
    expect(screen.getByRole("button", { name: "VIOLET / SOFT POP" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(1);
  });

  it("closes on Escape with focus restored and on an outside pointer press", () => {
    picker();
    const trigger = screen.getByRole("button", { name: "テーマ" });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
