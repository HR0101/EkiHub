import { expect, it, vi } from "vitest";
import { GET } from "../app/api/center/route";
import { loadStations } from "@/server/stationRepository";
import { getOrBuildGraph } from "../lib/stationGraph.js";
import { computeCenterStation } from "../lib/centerLogic.js";
vi.mock("@/server/stationRepository", () => ({ loadStations: vi.fn() }));
vi.mock("../lib/stationGraph.js", () => ({ getOrBuildGraph: vi.fn() }));
vi.mock("../lib/centerLogic.js", () => ({ computeCenterStation: vi.fn() }));
it("warms the graph with the shared station array without running a search", async () => {
  const stations: Awaited<ReturnType<typeof loadStations>> = [];
  vi.mocked(loadStations).mockResolvedValue(stations);
  const response = await GET();
  expect(response.status).toBe(204);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(getOrBuildGraph).toHaveBeenCalledWith(stations);
  expect(computeCenterStation).not.toHaveBeenCalled();
});
