// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { DESIGN_BOOT_SCRIPT, DESIGN_THEMES, PUBLIC_DESIGN_THEMES, applyDesignTheme, readDesignTheme } from "@/lib/designTheme";

function boot() { new Function(DESIGN_BOOT_SCRIPT)(); }
function picker() { return render(<LocaleProvider><ThemeToggle /></LocaleProvider>); }

beforeEach(() => {
  document.documentElement.removeAttribute("data-design");
  document.documentElement.removeAttribute("data-color");
  document.documentElement.removeAttribute("data-mode");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("public document theme", () => {
  it("always boots into Soft Pop, including both random boundaries", () => {
    for (const value of [0, 0.5, 0.999999]) {
      vi.spyOn(Math, "random").mockReturnValue(value);
      boot();
      expect(document.documentElement.dataset.design).toBe("violet");
      expect(document.documentElement.style.colorScheme).toBe("light");
    }
  });

  it("ignores stored selections and runs even when storage is inaccessible", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0.5);
    document.documentElement.dataset.color = "forest";
    boot();
    expect(document.documentElement.dataset.design).toBe("violet");
    expect(document.documentElement.hasAttribute("data-color")).toBe(false);
    boot();
    expect(document.documentElement.dataset.design).toBe("violet");
  });

  it("retains the theme when read on client-side route remounts", () => {
    applyDesignTheme("violet");
    const random = vi.spyOn(Math, "random");
    expect(readDesignTheme()).toBe("violet");
    expect(readDesignTheme()).toBe("violet");
    expect(random).not.toHaveBeenCalled();
  });

  it("replaces a withheld theme with Soft Pop on remount", () => {
    applyDesignTheme("terminal");
    expect(readDesignTheme()).toBe("violet");
    expect(document.documentElement.dataset.design).toBe("violet");
    expect(document.documentElement.hasAttribute("data-mode")).toBe(false);
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
  it("keeps the eight designs available internally, but only publishes Soft Pop", () => {
    expect(DESIGN_THEMES).toHaveLength(8);
    expect(PUBLIC_DESIGN_THEMES.map((theme) => theme.id)).toEqual(["violet"]);
  });

  it("hides the picker while one theme is public and never stores a selection", () => {
    applyDesignTheme("glass");
    const write = vi.spyOn(Storage.prototype, "setItem");
    const view = picker();
    expect(screen.queryByRole("button", { name: "テーマ" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.documentElement.dataset.design).toBe("violet");
    expect(write).not.toHaveBeenCalled();
    view.unmount();
    picker();
    expect(screen.queryByRole("button", { name: "テーマ" })).toBeNull();
    expect(document.documentElement.dataset.design).toBe("violet");
  });
});
