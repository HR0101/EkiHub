// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NearbySpots } from "@/components/NearbySpots";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import type { RankingEntry } from "@/types/ekihub";
afterEach(() => {cleanup(); vi.unstubAllGlobals();});
it("opens Maps immediately and changes the search without making API requests", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const station = {name:"渋谷", lat:35.658, lng:139.701} as RankingEntry;
  const {container, rerender} = render(<LocaleProvider><NearbySpots station={station}/></LocaleProvider>);
  fireEvent.click(screen.getByText("周辺スポット"));
  const link = screen.getByRole("link", {name:"Googleマップで探す"});
  const query = () => new URL(link.getAttribute("href")!).searchParams.get("query");
  expect(query()).toBe("渋谷駅 周辺");
  fireEvent.click(screen.getByRole("button", {name:"カフェ"}));
  expect(query()).toBe("渋谷駅 周辺 カフェ");
  rerender(<LocaleProvider><NearbySpots station={{...station,name:"新宿"}}/></LocaleProvider>);
  expect(query()).toBe("新宿駅 周辺 カフェ");
  expect(fetch).not.toHaveBeenCalled();
  expect(container.querySelector('[role="status"], [role="alert"], .spot-controls--radius')).toBeNull();
});
