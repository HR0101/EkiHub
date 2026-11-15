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

// ── 駅名の予測変換（Enter で先頭候補を確定・一字一句同じなら自動で選択済み） ──

const SUGGEST_STATIONS = [
  { name: "新宿", kana: "しんじゅく", lat: 35.69, lng: 139.7, lines: ["JR山手線"], isMajor: true, ridership: 650000 },
  { name: "新宿三丁目", kana: "しんじゅくさんちょうめ", lat: 35.69, lng: 139.705, lines: ["丸ノ内線"], isMajor: false, ridership: 100000 },
  { name: "渋谷", kana: "しぶや", lat: 35.658, lng: 139.701, lines: ["JR山手線"], isMajor: true, ridership: 600000 },
];

/** 入力行つきのフォームを描画し、1行目の駅名欄と送信のモックを返す */
function renderSuggestForm() {
  useEkiHubStore.getState().setRows([{ name: "", people: 1 }, { name: "", people: 1 }]);
  const onSubmit = vi.fn();
  render(<LocaleProvider><StationForm stations={SUGGEST_STATIONS} isComputing={false} errorMessage={null} currentStep={0} onSubmit={onSubmit} /></LocaleProvider>);
  const input = screen.getByRole("combobox", { name: "最寄駅 1" }) as HTMLInputElement;
  return { input, onSubmit };
}

it("Enter で先頭の候補を確定し、フォームは送信しない", () => {
  const { input, onSubmit } = renderSuggestForm();
  fireEvent.change(input, { target: { value: "しんじゅく" } });
  expect(input.getAttribute("aria-expanded")).toBe("true");
  // 先頭の候補が選択中として強調される
  const options = screen.getAllByRole("option");
  expect(options[0]?.getAttribute("aria-selected")).toBe("true");
  expect(input.getAttribute("aria-activedescendant")).toBe(options[0]?.id);

  fireEvent.keyDown(input, { key: "Enter" });
  expect(useEkiHubStore.getState().rows[0]?.name).toBe("新宿");
  expect(input.getAttribute("aria-expanded")).toBe("false");
  expect(onSubmit).not.toHaveBeenCalled();
});

it("↓で選び直した候補を Enter で確定する", () => {
  const { input } = renderSuggestForm();
  fireEvent.change(input, { target: { value: "しんじゅく" } });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(useEkiHubStore.getState().rows[0]?.name).toBe("新宿三丁目");
});

it("駅名と一字一句同じになったら、クリックしなくても選択済みになる", () => {
  const { input } = renderSuggestForm();
  fireEvent.change(input, { target: { value: "新" } });
  expect(input.getAttribute("aria-expanded")).toBe("true");
  fireEvent.change(input, { target: { value: "新宿" } });
  expect(input.getAttribute("aria-expanded")).toBe("false");
  expect(input.classList.contains("is-valid")).toBe(true);
  // 続けて打てば、また候補が開く
  fireEvent.change(input, { target: { value: "新宿三" } });
  expect(input.getAttribute("aria-expanded")).toBe("true");
});

it("IME の変換中は確定せず、変換を確定した時点で一致を判定する", () => {
  const { input } = renderSuggestForm();
  fireEvent.change(input, { target: { value: "しぶや" } });
  // 変換確定の Enter（keyCode 229 / isComposing）では候補を選ばない
  fireEvent.keyDown(input, { key: "Enter", keyCode: 229, isComposing: true });
  expect(useEkiHubStore.getState().rows[0]?.name).toBe("しぶや");
  expect(input.getAttribute("aria-expanded")).toBe("true");

  // 変換候補として「渋谷」が出ている途中は、まだ選択済みにしない
  fireEvent.input(input, { target: { value: "渋谷" }, isComposing: true });
  expect(useEkiHubStore.getState().rows[0]?.name).toBe("渋谷");
  expect(input.getAttribute("aria-expanded")).toBe("true");
  fireEvent.compositionEnd(input);
  expect(useEkiHubStore.getState().rows[0]?.name).toBe("渋谷");
  expect(input.getAttribute("aria-expanded")).toBe("false");
});

it("選択済みの欄にフォーカスを戻しても候補は開かない", () => {
  const { input } = renderSuggestForm();
  fireEvent.change(input, { target: { value: "渋谷" } });
  fireEvent.blur(input);
  fireEvent.focus(input);
  expect(input.getAttribute("aria-expanded")).toBe("false");
});
