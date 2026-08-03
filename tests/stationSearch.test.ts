import { describe, expect, it } from "vitest";

import {
  romajiToHiragana,
  scoreStation,
  searchStations,
  splitByMatch,
} from "@/lib/stationSearch";
import type { Station } from "@/types/ekihub";

/** テスト用の駅を組み立てる */
function station(partial: Partial<Station> & Pick<Station, "name" | "kana">): Station {
  return {
    lat: 35.7,
    lng: 139.7,
    lines: [],
    isMajor: false,
    ...partial,
  };
}

const STATIONS: Station[] = [
  station({ name: "新宿", kana: "しんじゅく", isMajor: true, ridership: 1_500_000 }),
  station({ name: "新宿三丁目", kana: "しんじゅくさんちょうめ" }),
  station({ name: "横浜", kana: "よこはま", isMajor: true, ridership: 420_000 }),
  station({ name: "中津", kana: "なかつ" }),
  station({ name: "銚子", kana: "ちょうし" }),
];

describe("romajiToHiragana", () => {
  it("基本のローマ字をひらがなにする", () => {
    expect(romajiToHiragana("shinjuku")).toBe("しんじゅく");
    expect(romajiToHiragana("yokohama")).toBe("よこはま");
  });

  it("拗音は3文字のまとまりを優先して変換する", () => {
    expect(romajiToHiragana("choushi")).toBe("ちょうし");
  });

  it("重子音は促音になる", () => {
    expect(romajiToHiragana("kitte")).toBe("きって");
  });

  it("変換できない文字はそのまま残す", () => {
    expect(romajiToHiragana("x1")).toBe("x1");
  });
});

describe("scoreStation", () => {
  it("完全一致が前方一致より高い", () => {
    const exact = scoreStation(STATIONS[0]!, "新宿");
    const prefix = scoreStation(STATIONS[1]!, "新宿");
    expect(exact).toBeGreaterThan(prefix);
  });

  it("かなでもローマ字でも当たる", () => {
    expect(scoreStation(STATIONS[0]!, "しんじゅく")).toBeGreaterThan(0);
    expect(scoreStation(STATIONS[0]!, "shinjuku")).toBeGreaterThan(0);
  });

  it("関係ない語では0になる", () => {
    expect(scoreStation(STATIONS[0]!, "大阪")).toBe(0);
  });
});

describe("searchStations", () => {
  it("完全一致を先頭に返す", () => {
    const result = searchStations(STATIONS, "新宿");
    expect(result[0]?.name).toBe("新宿");
    expect(result.map((s) => s.name)).toContain("新宿三丁目");
  });

  it("ローマ字入力でも駅を引ける", () => {
    expect(searchStations(STATIONS, "yokohama")[0]?.name).toBe("横浜");
  });

  it("空文字では何も返さない", () => {
    expect(searchStations(STATIONS, "   ")).toEqual([]);
  });

  it("件数の上限を守る", () => {
    expect(searchStations(STATIONS, "し", 1)).toHaveLength(1);
  });
});

describe("splitByMatch", () => {
  it("一致した位置で3つに割る", () => {
    expect(splitByMatch("新宿三丁目", "新宿")).toEqual({
      before: "",
      match: "新宿",
      after: "三丁目",
    });
  });

  it("一致しなければ全体を before に入れる", () => {
    expect(splitByMatch("横浜", "新宿")).toEqual({
      before: "横浜",
      match: "",
      after: "",
    });
  });
});
