import { describe, expect, it } from "vitest";

import sampleData from "./fixtures/sampleMeetingPoints.json";
import {
  calculateDistanceMeters,
  estimateWalkingMinutes,
  getMeetingPoints,
  normalizeStationName,
} from "@/lib/meetingPoints";
import type { StationMeetingPoints } from "@/types/ekihub";

describe("normalizeStationName", () => {
  it("末尾の「駅」を除去する", () => {
    expect(normalizeStationName("渋谷駅")).toBe("渋谷");
    expect(normalizeStationName("渋谷")).toBe("渋谷");
    expect(normalizeStationName(" 新宿駅 ")).toBe("新宿");
  });

  it("空文字や不正な値に対して安全に空文字を返す", () => {
    expect(normalizeStationName("")).toBe("");
    // @ts-expect-error 不正値テスト
    expect(normalizeStationName(null)).toBe("");
    // @ts-expect-error 不正値テスト
    expect(normalizeStationName(undefined)).toBe("");
  });
});

describe("calculateDistanceMeters & estimateWalkingMinutes", () => {
  it("2点間の距離をメートル単位で計算する", () => {
    // 渋谷駅中心 (35.658034, 139.701636) とハチ公像 (35.659082, 139.700464)
    const dist = calculateDistanceMeters(
      35.658034,
      139.701636,
      35.659082,
      139.700464,
    );
    expect(dist).toBeGreaterThan(100);
    expect(dist).toBeLessThan(200);
  });

  it("同一座標なら0メートル", () => {
    expect(calculateDistanceMeters(35.658, 139.701, 35.658, 139.701)).toBe(0);
  });

  it("不正な座標に対して0を返す", () => {
    expect(calculateDistanceMeters(NaN, 139.7, 35.6, 139.7)).toBe(0);
  });

  it("80m = 1分基準で徒歩目安分数を算出する（切り上げ、最低1分）", () => {
    expect(estimateWalkingMinutes(0)).toBe(1);
    expect(estimateWalkingMinutes(50)).toBe(1);
    expect(estimateWalkingMinutes(80)).toBe(1);
    expect(estimateWalkingMinutes(81)).toBe(2);
    expect(estimateWalkingMinutes(160)).toBe(2);
    expect(estimateWalkingMinutes(161)).toBe(3);
  });
});

describe("getMeetingPoints", () => {
  const typedSampleData = sampleData as StationMeetingPoints[];

  describe("正常系", () => {
    it("登録されている駅の待ち合わせスポットを返す", () => {
      const shibuya = getMeetingPoints("渋谷", ["JR山手線"], typedSampleData);
      expect(shibuya).toHaveLength(2);
      expect(shibuya[0]?.name).toBe("忠犬ハチ公像");
      expect(shibuya[0]?.type).toBe("statue");
      expect(shibuya[0]?.exit).toBe("ハチ公口");
      expect(shibuya[0]?.sourceUrl).toContain("https://");
      expect(shibuya[1]?.name).toBe("モヤイ像");
    });

    it("「駅」サフィックスが付いていても正しく検索できる", () => {
      const shinjukuWithEki = getMeetingPoints("新宿駅", [], typedSampleData);
      const shinjuku = getMeetingPoints("新宿", [], typedSampleData);
      expect(shinjukuWithEki).toEqual(shinjuku);
      expect(shinjuku).toHaveLength(1);
      expect(shinjuku[0]?.name).toBe("新宿駅東口広場（ライオン口）");
    });

    it("駅座標を渡すと distanceMeters と walkingMinutes が付与される", () => {
      const stationCoord = { lat: 35.658034, lng: 139.701636 };
      const points = getMeetingPoints(
        "渋谷",
        ["JR山手線"],
        typedSampleData,
        stationCoord,
      );
      expect(points[0]?.distanceMeters).toBeGreaterThan(0);
      expect(points[0]?.walkingMinutes).toBeGreaterThanOrEqual(1);
    });
  });

  describe("同名駅の照合", () => {
    const multiStationData: StationMeetingPoints[] = [
      {
        station: "府中",
        stationHint: "京王線",
        meetingPoints: [
          {
            name: "府中駅南口ペデストリアンデッキ",
            lat: 35.6714,
            lng: 139.4803,
            type: "plaza",
            description: "京王線府中駅直結のデッキ",
            confidence: "high",
          },
        ],
      },
      {
        station: "府中",
        stationHint: "JR福塩線",
        meetingPoints: [
          {
            name: "JR府中駅前広場",
            lat: 34.5714,
            lng: 133.2355,
            type: "plaza",
            description: "広島県府中市のJR福塩線府中駅前",
            confidence: "medium",
          },
        ],
      },
    ];

    it("路線（lines）と stationHint の照合で目的の駅が選ばれる", () => {
      const keioPoints = getMeetingPoints(
        "府中",
        ["京王線", "京王競馬場線"],
        multiStationData,
      );
      expect(keioPoints).toHaveLength(1);
      expect(keioPoints[0]?.name).toBe("府中駅南口ペデストリアンデッキ");

      const jrPoints = getMeetingPoints(
        "府中",
        ["JR福塩線"],
        multiStationData,
      );
      expect(jrPoints).toHaveLength(1);
      expect(jrPoints[0]?.name).toBe("JR府中駅前広場");
    });

    it("路線が指定されない・一致しない場合でも落ちずに最初の候補を返す", () => {
      const fallback = getMeetingPoints("府中", [], multiStationData);
      expect(fallback).toHaveLength(1);
      expect(fallback[0]?.name).toBe("府中駅南口ペデストリアンデッキ");

      const unknownLine = getMeetingPoints(
        "府中",
        ["未知の路線"],
        multiStationData,
      );
      expect(unknownLine).toHaveLength(1);
    });
  });

  describe("データ欠落の扱い", () => {
    it("マスタに無い駅名では空配列を返す（落ちない）", () => {
      const result = getMeetingPoints("存在しない駅", [], typedSampleData);
      expect(result).toEqual([]);
    });

    it("データセットが空配列の場合は空配列を返す", () => {
      const result = getMeetingPoints("渋谷", ["JR山手線"], []);
      expect(result).toEqual([]);
    });

    it("meetingPoints が空配列のエントリでも空配列を返す", () => {
      const emptyEntryData: StationMeetingPoints[] = [
        {
          station: "品川",
          meetingPoints: [],
        },
      ];
      const result = getMeetingPoints("品川", [], emptyEntryData);
      expect(result).toEqual([]);
    });
  });

  describe("不正値・壊れたデータの扱い", () => {
    it("駅名が空文字・null・undefinedでも落ちずに空配列を返す", () => {
      expect(getMeetingPoints("", [], typedSampleData)).toEqual([]);
      // @ts-expect-error 不正値テスト
      expect(getMeetingPoints(null, [], typedSampleData)).toEqual([]);
      // @ts-expect-error 不正値テスト
      expect(getMeetingPoints(undefined, [], typedSampleData)).toEqual([]);
    });

    it("データセット内に null や壊れたエントリが含まれていても落ちない", () => {
      const corruptedData = [
        null,
        undefined,
        {},
        { station: "渋谷", meetingPoints: null },
        { station: "渋谷", meetingPoints: "not-an-array" },
        {
          station: "渋谷",
          meetingPoints: [
            null,
            undefined,
            { name: "" }, // 空の名前
            { name: "不正なタイプ", type: "invalid_type", lat: 35.6, lng: 139.7, description: "説明" },
            { name: "不正な緯度", type: "statue", lat: NaN, lng: 139.7, description: "説明" },
            {
              name: "正常なスポット",
              type: "statue",
              lat: 35.659,
              lng: 139.700,
              description: "ハチ公像",
              confidence: "high",
            },
          ],
        },
      ] as unknown as StationMeetingPoints[];

      const points = getMeetingPoints("渋谷", [], corruptedData);
      expect(points).toHaveLength(1);
      expect(points[0]?.name).toBe("正常なスポット");
    });
  });

  describe("デフォルトデータセットの動作", () => {
    it("dataset 引数を省略しても例外を投げずに配列を返す", () => {
      expect(() => getMeetingPoints("渋谷")).not.toThrow();
      const points = getMeetingPoints("渋谷");
      expect(Array.isArray(points)).toBe(true);
    });
  });
});
