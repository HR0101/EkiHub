import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => { vi.useFakeTimers(); vi.resetModules(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const query = { lat: 35.66, lng: 139.7, category: "cafe" as const, radius: 800 };
const response = () => new Response(JSON.stringify({ elements: [{ lat: 35.66, lon: 139.7, tags: { name: "Cafe", amenity: "cafe" } }] }));

it("uses a healthy mirror after 1.2s without waiting for the stalled primary, and caches results", async () => {
  const signals: AbortSignal[] = [];
  const fetch = vi.fn((_url: string, init: RequestInit) => {
    signals.push(init.signal as AbortSignal);
    return signals.length === 1 ? new Promise<Response>(() => {}) : Promise.resolve(response());
  });
  vi.stubGlobal("fetch", fetch);
  const { fetchNearbySpots } = await import("../lib/poiService.js");
  const result = fetchNearbySpots(query);
  await vi.advanceTimersByTimeAsync(1200);
  expect(await result).toHaveLength(1);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(signals.every(signal => signal.aborted)).toBe(true);
  expect(await fetchNearbySpots(query)).toHaveLength(1);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("cancels active requests and never starts remaining mirrors after cancellation", async () => {
  const fetch = vi.fn(() => new Promise<Response>(() => {}));
  vi.stubGlobal("fetch", fetch);
  const { fetchNearbySpots } = await import("../lib/poiService.js");
  const controller = new AbortController();
  const pending = fetchNearbySpots(query, controller.signal);
  const rejected = expect(pending).rejects.toBeDefined();
  await vi.advanceTimersByTimeAsync(1);
  controller.abort();
  await rejected;
  await vi.advanceTimersByTimeAsync(5000);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("does not mistake Overpass timeout remarks for an empty successful result", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ remark: "timeout", elements: [] }))));
  const { fetchNearbySpots } = await import("../lib/poiService.js");
  const pending = fetchNearbySpots(query);
  const rejected = expect(pending).rejects.toBeDefined();
  await vi.advanceTimersByTimeAsync(2500);
  await rejected;
});
