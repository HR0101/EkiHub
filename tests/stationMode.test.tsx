// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { StationForm } from "@/components/StationForm";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { useEkiHubStore } from "@/stores/useEkiHubStore";

afterEach(cleanup);
it("selects candidate scope from either the title or its explanatory label", () => {
  useEkiHubStore.setState({ mode: "A" });
  render(<LocaleProvider><StationForm stations={[]} isComputing={false} errorMessage={null} currentStep={0} onSubmit={vi.fn()} /></LocaleProvider>);
  const group = screen.getByRole("radiogroup", { name: "候補にする駅" });
  const major = within(group).getByRole("radio", { name: /主要駅だけ/ }) as HTMLInputElement;
  const all = within(group).getByRole("radio", { name: /すべての駅/ }) as HTMLInputElement;
  expect(major.checked).toBe(true);
  expect(all.checked).toBe(false);
  fireEvent.click(screen.getByText("駅の規模を問わず、集まりやすい駅を探す"));
  expect(useEkiHubStore.getState().mode).toBe("B");
  expect(all.checked).toBe(true);
  expect(major.checked).toBe(false);
  fireEvent.click(screen.getByText("主要駅だけ"));
  expect(useEkiHubStore.getState().mode).toBe("A");
  expect(major.checked).toBe(true);
});

it("offers 1–10 people and keeps restored counts within that range", () => {
  useEkiHubStore.getState().setRows([{name: "新宿", people: 99}]);
  render(<LocaleProvider><StationForm stations={[]} isComputing={false} errorMessage={null} currentStep={0} onSubmit={vi.fn()} /></LocaleProvider>);
  const picker = screen.getByRole("combobox", {name: "最寄駅 1 — 人数"}) as HTMLSelectElement;
  expect(Array.from(picker.options).map(option => option.value)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
  expect(picker.value).toBe("10");
  fireEvent.change(picker, {target: {value: "3"}});
  expect(useEkiHubStore.getState().rows[0]?.people).toBe(3);
});
