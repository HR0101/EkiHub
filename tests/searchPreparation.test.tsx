// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useStations, useCenterStation } from "@/hooks/useStations";
import { fetchStations, prepareCenterSearch, fetchCenterStation } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  fetchStations: vi.fn(), prepareCenterSearch: vi.fn(), fetchCenterStation: vi.fn(),
}));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}
it("prepares once after autocomplete data arrives, without waiting for preparation", async () => {
  let finishStations!: (stations: []) => void;
  vi.mocked(fetchStations).mockImplementation(() => new Promise((resolve) => { finishStations = resolve; }));
  vi.mocked(prepareCenterSearch).mockImplementation(() => new Promise(() => {}));
  const { client, wrapper } = setup();
  const hook = renderHook(() => useStations(), { wrapper });
  expect(prepareCenterSearch).not.toHaveBeenCalled();
  finishStations([]);
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  await waitFor(() => expect(prepareCenterSearch).toHaveBeenCalledTimes(1));
  hook.rerender();
  const second = renderHook(() => useStations(), { wrapper });
  await waitFor(() => expect(second.result.current.isSuccess).toBe(true));
  expect(prepareCenterSearch).toHaveBeenCalledTimes(1);
  cleanup(); client.clear();
});
it("a failed preparation never blocks normal searches or retries on remount", async () => {
  vi.mocked(fetchStations).mockResolvedValue([]);
  vi.mocked(prepareCenterSearch).mockRejectedValue(new Error("offline"));
  const { client, wrapper } = setup();
  const hook = renderHook(() => ({ stations: useStations(), center: useCenterStation() }), { wrapper });
  await waitFor(() => expect(client.getQueryState(["center-search-preparation"])?.status).toBe("error"));
  expect(hook.result.current.stations.isSuccess).toBe(true);
  hook.unmount();
  const again = renderHook(() => ({ stations: useStations(), center: useCenterStation() }), { wrapper });
  vi.mocked(fetchCenterStation).mockResolvedValue({} as Awaited<ReturnType<typeof fetchCenterStation>>);
  const request = { origins: ["新宿", "横浜"], mode: "A" as const };
  await again.result.current.center.mutateAsync(request);
  expect(fetchCenterStation).toHaveBeenCalledWith(request);
  expect(prepareCenterSearch).toHaveBeenCalledTimes(1);
  cleanup(); client.clear();
});
