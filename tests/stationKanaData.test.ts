import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import osm from "../data/stations-osm.json";
import overrides from "../data/station-kana-overrides.json";
import { stations as curated } from "../data/stations.js";
import { findStationKanaOverride, normalizeStationKana } from "../lib/stationKana.js";
import { searchStations } from "@/lib/stationSearch";
import type { Station } from "@/types/ekihub";

describe("reviewed station readings", () => {
  it.each(overrides)("keeps $name readable and searchable as $kana", (entry) => {
    const station = osm.find(s => s.name === entry.name && Math.abs(s.lat-entry.lat)<0.005 && Math.abs(s.lng-entry.lng)<0.005);
    expect(station?.kana).toBe(entry.kana);
    expect(entry.kana).toMatch(/^[ぁ-ゔー]+$/);
    expect(entry.kana).not.toMatch(/[ゕゖ]/);
    expect(searchStations(osm as Station[], entry.kana).some(s => s.name === entry.name)).toBe(true);
  });
  it("corrects the curated values that override OSM during merging", () => {
    expect(curated.find(s => s.name === "馬込沢")?.kana).toBe("まごめざわ");
    expect(curated.find(s => s.name === "多摩センター")?.kana).toBe("たませんたー");
  });
  it("does not apply an override to a distant station of the same name", () => {
    expect(findStationKanaOverride({name: "春日", lat:35.71, lng:139.75}, overrides)).toBeUndefined();
  });
  it("normalizes notation without inventing a reading for ヶ or unknown kanji", () => {
    expect(normalizeStationKana("JRナンバ")).toBe("じぇいあーるなんば");
    expect(normalizeStationKana("ヴイ")).toBe("ゔい");
    expect(normalizeStationKana("安子ヶ島")).toBe("安子ヶ島");
    expect(normalizeStationKana("あしゖくぼ")).toBe("あしゖくぼ");
    expect(readFileSync("scripts/generateKana.js", "utf8")).not.toContain("import kuromoji");
  });
});
