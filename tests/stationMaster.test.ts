import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import master from "../data/stations-master.json";
import aliases from "../data/station-aliases.json";
import { loadStationIndex } from "@/server/stationRepository";
import type { Station } from "@/types/ekihub";

/**
 * 駅マスタ（data/stations-master.json）と旧駅名の読み替え表（data/station-aliases.json）の検証。
 * どちらも scripts/buildStationMaster.js の生成物。
 */

const stations = master as Station[];
const aliasMap = aliases as Record<string, string>;
const stationByName = new Map(stations.map((station) => [station.name, station]));

/** 座標の許容誤差（メートル）。代表点の取り方の差を吸収する */
const LOCATION_TOLERANCE_M = 1500;

/** 地球半径（メートル） */
const EARTH_RADIUS_M = 6371000;

/** 2地点間の距離（メートル） */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRadians = (degree: number) => (degree * Math.PI) / 180;
  const h =
    Math.sin(toRadians(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(toRadians(lng2 - lng1) / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** 以前は全国で1駅にまとめられ、別の地方の座標になっていた駅 */
const KNOWN_LOCATIONS = [
  { name: "日吉(神奈川)", lat: 35.5539, lng: 139.6469 },
  { name: "日吉(京都)", lat: 35.1622, lng: 135.5034 },
  { name: "白山(東京)", lat: 35.7214, lng: 139.7521 },
  { name: "府中(東京)", lat: 35.6722, lng: 139.4799 },
  { name: "大和(神奈川)", lat: 35.4697, lng: 139.4616 },
  { name: "三田(東京)", lat: 35.6481, lng: 139.7487 },
  { name: "住吉(東京)", lat: 35.6894, lng: 139.8156 },
];

/** 旧駅名と、読み替え先として期待する駅 */
const EXPECTED_ALIASES = [
  // 同名駅の元の名前は、乗降客数が最も多い（または主要駅の）駅へ
  { from: "日吉", to: "日吉(神奈川)" },
  { from: "府中", to: "府中(東京)" },
  { from: "大宮", to: "大宮(埼玉)" },
  { from: "神戸", to: "神戸(兵庫)" },
  // 表記揺れ・副駅名
  { from: "市ヶ谷", to: "市ケ谷" },
  { from: "押上（スカイツリー前）", to: "押上" },
  // station_database で別の駅にまとめられている旧駅名
  { from: "モノレール浜松町", to: "浜松町" },
];

describe("駅マスタ", () => {
  it("駅名が重複しない", () => {
    expect(new Set(stations.map((station) => station.name)).size).toBe(stations.length);
  });

  it.each(KNOWN_LOCATIONS)("$name が正しい地域の座標を持つ", ({ name, lat, lng }) => {
    const station = stationByName.get(name);
    expect(station, name).toBeDefined();
    if (!station) return;
    expect(haversineDistance(station.lat, station.lng, lat, lng)).toBeLessThan(LOCATION_TOLERANCE_M);
    expect(station.originalName).toBe(name.replace(/\(.+\)$/, ""));
  });

  it("同名駅を区別した名前は「元の駅名(区別)」の形になる", () => {
    for (const station of stations.filter((s) => s.originalName)) {
      expect(station.name.startsWith(`${station.originalName}(`), station.name).toBe(true);
      expect(station.name.endsWith(")"), station.name).toBe(true);
    }
  });

  it("全角数字を使わない（半角で打った駅名と一致させるため）", () => {
    expect(stations.filter((station) => /[０-９]/.test(station.name)).map((s) => s.name)).toEqual([]);
  });
});

describe("旧駅名の読み替え表", () => {
  it("読み替え先はすべて駅マスタにある", () => {
    const missing = Object.entries(aliasMap).filter(([, to]) => !stationByName.has(to));
    expect(missing).toEqual([]);
  });

  it("実在する駅名を読み替えない", () => {
    expect(Object.keys(aliasMap).filter((from) => stationByName.has(from))).toEqual([]);
  });

  it.each(EXPECTED_ALIASES)("$from を $to へ読み替える", ({ from, to }) => {
    expect(aliasMap[from]).toBe(to);
  });
});

describe("loadStationIndex", () => {
  beforeAll(() => {
    // リポジトリに同梱した駅データだけで確かめる
    vi.stubEnv("ODPT_TOKEN", "");
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("旧駅名でも新しい駅名の駅を返す", async () => {
    const index = await loadStationIndex();
    expect(index.get("日吉")?.name).toBe("日吉(神奈川)");
    expect(index.get("日吉(京都)")?.name).toBe("日吉(京都)");
    expect(index.get("新宿")?.name).toBe("新宿");
  });
});
