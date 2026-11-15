import { describe, expect, it } from "vitest";

import { buildStationGraph, getOrBuildGraph, shortestFrom } from "../lib/stationGraph.js";
import type { RailLine, Station } from "@/types/ekihub";

/**
 * 新快速の区間に足す「快速の辺」（lib/stationGraph.js）の単体テスト。
 * 実データではなく、直線上に並べた架空の駅で辺の張り方だけを確かめる。
 */

/** 新快速が走る区間として登録されている路線名 */
const RAPID_LINE = "JR東海道本線(京都線)(京都～大阪)";
/** 登録されていない路線名（関東の路線） */
const OTHER_LINE = "JR東海道本線(東京～熱海)";
/** 緯度 0.01 度 ≒ 1.1km */
const LAT_STEP = 0.01;

/** 南北一直線に駅を並べる。停車駅は乗換駅（2路線）にする */
function makeStations(stopIndexes: number[], count: number): Station[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `駅${i}`,
    kana: "",
    lat: 35 + i * LAT_STEP,
    lng: 135,
    lines: stopIndexes.includes(i) ? ["路線A", "路線B"] : ["路線A"],
    isMajor: false,
  }));
}

function line(name: string, stations: Station[]): RailLine {
  return { name, stations: stations.map((station) => station.name) };
}

/** 隣接駅 index から快速の辺の一覧を作る */
function rapidNeighbors(graph: ReturnType<typeof buildStationGraph>, index: number): number[] {
  return graph.rapidAdjacency[index]!.map(([j]) => j).sort((a, b) => a - b);
}

describe("快速の辺", () => {
  // 駅0・駅10・駅20・駅25 が停車駅。駅0-駅10 は約11km、駅20-駅25 は約5.6km
  const stations = makeStations([0, 10, 20, 25], 26);

  it("新快速の区間で、10km 以上離れた停車駅どうしをすべて結ぶ", () => {
    const graph = buildStationGraph(stations, { railLines: [line(RAPID_LINE, stations)] });
    expect(rapidNeighbors(graph, 0)).toEqual([10, 20, 25]);
    // 駅20-駅25 は近いので結ばない（近接グラフで足りる）
    expect(rapidNeighbors(graph, 20)).toEqual([0, 10]);
    // 停車駅でない駅には辺を張らない
    expect(rapidNeighbors(graph, 5)).toEqual([]);
  });

  it("登録されていない路線や、路線データが無いときは辺を張らない", () => {
    const other = buildStationGraph(stations, { railLines: [line(OTHER_LINE, stations)] });
    const none = buildStationGraph(stations);
    expect(other.rapidAdjacency.every((neighbors) => neighbors.length === 0)).toBe(true);
    expect(none.rapidAdjacency.every((neighbors) => neighbors.length === 0)).toBe(true);
  });

  it("快速の辺を使うと、各停を辿るより早く着く", () => {
    const withRapid = buildStationGraph(stations, { railLines: [line(RAPID_LINE, stations)] });
    const withoutRapid = buildStationGraph(stations);
    const fast = shortestFrom(withRapid, 0).minutes[25]!;
    const slow = shortestFrom(withoutRapid, 0).minutes[25]!;
    expect(fast).toBeLessThan(slow);
  });

  it("路線データの有無で別のグラフとしてキャッシュする", () => {
    const railLines = [line(RAPID_LINE, stations)];
    const plain = getOrBuildGraph(stations);
    const rapid = getOrBuildGraph(stations, { railLines });
    expect(rapid).not.toBe(plain);
    expect(getOrBuildGraph(stations, { railLines })).toBe(rapid);
    expect(getOrBuildGraph(stations)).toBe(plain);
  });
});
