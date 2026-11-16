import { describe, expect, it } from "vitest";
import { buildStationGraph } from "../lib/stationGraph.js";
import { haversineDistance } from "../lib/centerLogic.js";

// Independent exhaustive reference: no latitude filtering.
function exhaustiveNeighbors(stations: { name: string; lat: number; lng: number }[], edgeCapM: number, neighborCount: number) {
  const edges = stations.map(() => new Set<number>());
  stations.forEach((a, i) => {
    stations.map((b, j) => ({ j, distance: haversineDistance(a.lat, a.lng, b.lat, b.lng) }))
      .filter(({ j, distance }) => j !== i && distance <= edgeCapM)
      .sort((a, b) => a.distance - b.distance || a.j - b.j)
      .slice(0, neighborCount)
      .forEach(({ j }) => { edges[i]!.add(j); edges[j]!.add(i); });
  });
  return edges.map((neighbors) => [...neighbors].sort((a, b) => a - b));
}

describe("station graph latitude index", () => {
  const stations = Array.from({ length: 200 }, (_, i) => ({
    name: String(i), lat: 30 + (i % 20) * 0.03, lng: 130 + Math.floor(i / 20) * 0.03,
  }));
  stations.push(
    { name: "date-line-west", lat: 40, lng: 179.99 },
    { name: "date-line-east", lat: 40, lng: -179.99 },
    { name: "pole-a", lat: 89.99, lng: 0 },
    { name: "pole-b", lat: 89.99, lng: 180 },
    { name: "duplicate", lat: stations[0]!.lat, lng: stations[0]!.lng },
  );
  it.each([0, 12000, Infinity])("preserves exhaustive connections with cap %s", (edgeCapM) => {
    const graph = buildStationGraph(stations, { edgeCapM, neighborCount: 6 });
    expect(graph.adjacency.map((neighbors) => neighbors.map(([j]) => j).sort((a, b) => a - b)))
      .toEqual(exhaustiveNeighbors(stations, edgeCapM, 6));
  });
  it("keeps edges at the north/south distance boundary", () => {
    const pair = [{ name: "a", lat: 35, lng: 139 }, { name: "b", lat: 35.1, lng: 139 }];
    const edgeCapM = haversineDistance(35, 139, 35.1, 139);
    expect(buildStationGraph(pair, { edgeCapM }).adjacency[0]!.map(([j]) => j)).toEqual([1]);
  });
});
