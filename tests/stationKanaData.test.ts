import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import master from "../data/stations-master.json";
import overrides from "../data/station-kana-overrides.json";
import { stations as curated } from "../data/stations.js";
import { findStationKanaOverride, normalizeStationKana } from "../lib/stationKana.js";
import { searchStations } from "@/lib/stationSearch";
import type { Station } from "@/types/ekihub";

const stations = master as Station[];

/** 補正はあるが、station_database に独立した駅として無いもの（理由つき） */
const OVERRIDES_WITHOUT_STATION: Record<string, string> = {
  "美女平": "立山ケーブルカーの駅は station_database に含まれない",
  "新線新宿": "京王新線の駅は「新宿」にまとめられている（旧駅名は新宿へ読み替える）",
  "西鉄福岡（天神）": "副駅名を省いて「西鉄福岡」になり、読みも「にしてつふくおか」になった",
};

describe("reviewed station readings", () => {
  const applicable = overrides.filter((entry) => !(entry.name in OVERRIDES_WITHOUT_STATION));

  // 補正は区別前の駅名（例: 春日）で書かれているので、座標で駅マスタの駅（春日(福岡)）を引く
  it.each(applicable)("keeps $name readable and searchable as $kana", (entry) => {
    const station = stations.find((s) => findStationKanaOverride(s, [entry]));
    expect(station?.kana).toBe(entry.kana);
    expect(entry.kana).toMatch(/^[ぁ-ゔー]+$/);
    expect(entry.kana).not.toMatch(/[ゕゖ]/);
    expect(searchStations(stations, entry.kana).some((s) => s.name === station?.name)).toBe(true);
  });

  it.each(Object.keys(OVERRIDES_WITHOUT_STATION))("has no separate station for %s", (name) => {
    const entry = overrides.find((override) => override.name === name);
    expect(entry).toBeDefined();
    expect(stations.find((s) => entry && findStationKanaOverride(s, [entry]))).toBeUndefined();
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
