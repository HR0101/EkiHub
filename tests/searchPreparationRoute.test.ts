import { expect, it, vi } from "vitest";
import { GET } from "../app/api/center/route";
import { loadRailLines, loadStations } from "@/server/stationRepository";
import { getOrBuildGraph } from "../lib/stationGraph.js";
import { computeCenterStation } from "../lib/centerLogic.js";
vi.mock("@/server/stationRepository", () => ({ loadStations: vi.fn(), loadRailLines: vi.fn() }));
vi.mock("../lib/stationGraph.js", () => ({ getOrBuildGraph: vi.fn() }));
vi.mock("../lib/centerLogic.js", () => ({ computeCenterStation: vi.fn() }));
it("warms the graph with the shared station array without running a search", async () => {
  const stations: Awaited<ReturnType<typeof loadStations>> = [];
  const railLines: Awaited<ReturnType<typeof loadRailLines>> = [{ name: "路線", stations: [] }];
  vi.mocked(loadStations).mockResolvedValue(stations);
  vi.mocked(loadRailLines).mockResolvedValue(railLines);
  const response = await GET();
  expect(response.status).toBe(204);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  // POST（computeCenterStation）と同じ路線データで作り、同じキャッシュを温める
  expect(getOrBuildGraph).toHaveBeenCalledWith(stations, { railLines });
  expect(computeCenterStation).not.toHaveBeenCalled();
});
