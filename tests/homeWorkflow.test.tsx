// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HomeView } from "@/components/HomeView";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { useEkiHubStore } from "@/stores/useEkiHubStore";
import type { CenterRequest, CenterResult, RankingEntry } from "@/types/ekihub";

let onSuccess:
  ((result: CenterResult, request: CenterRequest) => void) | undefined;
const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/hooks/useSearchDraft", () => ({ useSearchDraft: vi.fn() }));
let isMobile = true;
const submit = vi.fn();
const scroll = vi.fn();

vi.mock("next/dynamic", () => ({
  default: () =>
    function MapPreview({ station }: { station: RankingEntry | null }) {
      return <div data-testid="map-selection">{station?.name ?? "未検索"}</div>;
    },
}));
vi.mock("@/hooks/useShareParams", () => ({ useShareParams: vi.fn() }));
vi.mock("@/hooks/useStations", () => ({
  useStations: () => ({ data: [], isError: false }),
  useCenterStation: (options: {
    onSuccess: (result: CenterResult, request: CenterRequest) => void;
  }) => {
    onSuccess = options.onSuccess;
    return {
      mutate: (request: CenterRequest) => submit(request),
      isPending: false,
      isError: false,
    };
  },
}));
vi.mock("@/components/TrainInformation", () => ({
  TrainInformation: () => <div>運行情報</div>,
}));

const best: RankingEntry = {
  name: "品川",
  kana: "しながわ",
  lat: 35.6,
  lng: 139.7,
  lines: ["山手線"],
  isMajor: true,
  averageMinutes: 25,
  totalMinutes: 50,
  minMinutes: 20,
  maxMinutes: 30,
  fairness: 5,
  averageFareYen: 300,
  totalFareYen: 600,
  averageTransfers: 0,
  directCount: 2,
  routed: false,
  distanceToCentroidKm: 1,
  score: 0.2,
  travelTimes: [
    {
      from: "新宿",
      minutes: 20,
      fareYen: 250,
      transfers: 0,
      people: 1,
      directPossible: true,
      routed: false,
    },
    {
      from: "横浜",
      minutes: 30,
      fareYen: 350,
      transfers: 0,
      people: 1,
      directPossible: true,
      routed: false,
    },
  ],
};
const alternate: RankingEntry = {
  ...best,
  name: "東京",
  kana: "とうきょう",
  averageMinutes: 35,
};
const result: CenterResult = {
  best,
  ranking: [best, alternate],
  centroid: { lat: 35.6, lng: 139.7 },
  mode: "A",
  candidateCount: 2,
  candidateRadiusKm: 20,
  routingMethod: "graph",
  routingRefined: false,
  weights: { fairness: 0.6, proximity: 0.4, fare: 0 },
  routingUsed: false,
  origins: [
    { name: "新宿", kana: "しんじゅく", lat: 35.7, lng: 139.7, people: 2 },
    { name: "横浜", kana: "よこはま", lat: 35.4, lng: 139.6, people: 1 },
  ],
};

const request: CenterRequest = {
  origins: ["新宿", "横浜"],
  peopleCounts: [2, 1],
  mode: "A",
  weight: 0.6,
  fareWeight: 0,
};

function mount(page: "input" | "results" = "input") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <LocaleProvider>
        <HomeView page={page} />
      </LocaleProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  isMobile = true;
  localStorage.clear();
  submit.mockClear();
  navigation.push.mockClear();
  navigation.replace.mockClear();
  window.history.replaceState({}, "", "/");
  scroll.mockClear();
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(max-width: 899px)" && isMobile,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  HTMLElement.prototype.scrollIntoView = scroll;
  useEkiHubStore.getState().setResult(null);
  useEkiHubStore.getState().setRows([
    { name: "新宿", people: 2 },
    { name: "横浜", people: 1 },
  ]);
  useEkiHubStore.getState().setMode("A");
  useEkiHubStore.getState().setFairnessWeight(0.6);
  useEkiHubStore.getState().setFareWeight(0);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("responsive search workflow", () => {
  it("preserves station, people and preference values in searches", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "中心駅を検索する" }));
    expect(submit).toHaveBeenCalledWith({
      origins: ["新宿", "横浜"],
      peopleCounts: [2, 1],
      mode: "A",
      weight: 0.6,
      fareWeight: 0,
    });
  });

  it("navigates mobile users to results and preserves conditions when returning", () => {
    const view = mount();
    act(() => onSuccess?.(result, request));
    expect(navigation.push).toHaveBeenCalledWith(
      expect.stringMatching(/^\/results\?o=/),
    );
    view.unmount();
    const resultsPage = mount("results");
    fireEvent.click(screen.getByRole("button", { name: "← 条件を変更" }));
    expect(navigation.push).toHaveBeenLastCalledWith("/");
    resultsPage.unmount();
    mount();
    expect(
      screen.getByRole("combobox", { name: "最寄駅 1" }).getAttribute("value"),
    ).toBe("新宿");
    expect(
      screen
        .getByRole("spinbutton", { name: "最寄駅 1 — 人数" })
        .getAttribute("value"),
    ).toBe("2");
  });

  it("replaces incoming mobile share links so Back does not trigger a search loop", () => {
    window.history.replaceState({}, "", "/?o=新宿,横浜");
    mount();
    act(() => onSuccess?.(result, request));
    expect(navigation.replace).toHaveBeenCalledWith(
      expect.stringMatching(/^\/results\?o=/),
    );
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("returns mobile users to their last result without searching again", () => {
    mount();
    act(() => onSuccess?.(result, request));
    submit.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "結果に戻る" }));
    expect(navigation.push).toHaveBeenLastCalledWith(
      expect.stringContaining(`&station=${encodeURIComponent("品川")}`),
    );
    expect(submit).not.toHaveBeenCalled();
  });

  it("does not add mobile section jumps to browser history", () => {
    mount("results");
    act(() => onSuccess?.(result, request));
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    fireEvent(screen.getByRole("link", { name: "平均所要時間" }), event);
    expect(event.defaultPrevented).toBe(true);
    expect(window.location.hash).toBe("");
    expect(scroll).toHaveBeenCalled();
  });

  it("does not move the desktop viewport after searching", () => {
    isMobile = false;
    mount();
    act(() => onSuccess?.(result, request));
    expect(scroll).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("updates both station details and the map from mobile comparison rows", () => {
    const { container } = mount("results");
    act(() => onSuccess?.(result, request));
    const rows = container.querySelector(".ranking-mobile") as HTMLElement;
    fireEvent.click(within(rows).getByRole("button", { name: /東京/ }));
    expect(container.querySelector(".result-card__name")?.textContent).toBe(
      "東京",
    );
    expect(screen.getByTestId("map-selection").textContent).toBe("東京");
    expect(
      within(rows)
        .getByRole("button", { name: /東京/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("keeps desktop table selection available through a native button", () => {
    isMobile = false;
    const { container } = mount();
    act(() => onSuccess?.(result, request));
    const table = screen.getByRole("table");
    fireEvent.click(within(table).getByRole("button", { name: "東京" }));
    expect(container.querySelector(".result-card__name")?.textContent).toBe(
      "東京",
    );
    expect(
      within(table)
        .getByRole("button", { name: "東京" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("keeps nearby-place filters accessible within a closed disclosure", () => {
    const { container } = mount("results");
    act(() => onSuccess?.(result, request));
    const spots = container.querySelector(
      ".nearby-spots",
    ) as HTMLDetailsElement;
    expect(spots.open).toBe(false);
    act(() => {
      spots.open = true;
    });
    expect(within(spots).getAllByRole("button").length).toBe(10);
  });
});
