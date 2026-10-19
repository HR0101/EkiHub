// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import sampleData from "./fixtures/sampleMeetingPoints.json";
import { MeetingPoints } from "@/components/MeetingPoints";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import type { RankingEntry, StationMeetingPoints } from "@/types/ekihub";

const typedSampleData = sampleData as StationMeetingPoints[];

function createDummyStation(overrides: Partial<RankingEntry> = {}): RankingEntry {
  return {
    name: "渋谷",
    kana: "しぶや",
    lat: 35.658034,
    lng: 139.701636,
    lines: ["JR山手線"],
    isMajor: true,
    averageMinutes: 20,
    totalMinutes: 40,
    minMinutes: 15,
    maxMinutes: 25,
    fairness: 5,
    averageFareYen: 200,
    totalFareYen: 400,
    averageTransfers: 0,
    directCount: 2,
    routed: false,
    distanceToCentroidKm: 3.5,
    score: 85,
    travelTimes: [],
    ...overrides,
  };
}

describe("MeetingPoints コンポーネント", () => {
  it("データがある駅の場合、スポット一覧とメタ情報が表示される", () => {
    const station = createDummyStation({ name: "渋谷", lines: ["JR山手線"] });

    const { container } = render(
      <LocaleProvider initialLocale="ja">
        <MeetingPoints station={station} dataset={typedSampleData} />
      </LocaleProvider>,
    );

    // セクション見出しが表示される
    expect(screen.getByRole("heading", { name: "待ち合わせスポット" })).toBeInTheDocument();
    expect(screen.getByText("忠犬ハチ公像")).toBeInTheDocument();
    expect(screen.getByText("モヤイ像")).toBeInTheDocument();

    // 出口とバッジの表示
    expect(screen.getByText("最寄り: ハチ公口")).toBeInTheDocument();
    expect(screen.getAllByText("像・モニュメント").length).toBeGreaterThan(0);

    // 距離と徒歩目安の表示
    expect(screen.getAllByText(/徒歩約\d+分/).length).toBe(2);

    // 出典リンクの属性検証
    const links = container.querySelectorAll<HTMLAnchorElement>("a.meeting-point-card__source");
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]?.getAttribute("target")).toBe("_blank");
    expect(links[0]?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("新宿駅の場合、新宿駅東口広場が表示される", () => {
    const station = createDummyStation({
      name: "新宿",
      lines: ["JR山手線"],
      lat: 35.690921,
      lng: 139.700258,
    });

    render(
      <LocaleProvider initialLocale="ja">
        <MeetingPoints station={station} dataset={typedSampleData} />
      </LocaleProvider>,
    );

    expect(screen.getByText("新宿駅東口広場（ライオン口）")).toBeInTheDocument();
    expect(screen.getByText("広場")).toBeInTheDocument();
    expect(screen.getByText("最寄り: 東口")).toBeInTheDocument();
  });

  it("東京駅の場合、銀の鈴が表示される", () => {
    const station = createDummyStation({
      name: "東京",
      lines: ["JR東海道本線"],
      lat: 35.681382,
      lng: 139.766084,
    });

    render(
      <LocaleProvider initialLocale="ja">
        <MeetingPoints station={station} dataset={typedSampleData} />
      </LocaleProvider>,
    );

    expect(screen.getByText("銀の鈴")).toBeInTheDocument();
    expect(screen.getByText("ランドマーク")).toBeInTheDocument();
    expect(screen.getByText("最寄り: 八重洲地下中央口")).toBeInTheDocument();
  });

  it("データが無い駅の場合、セクションごと完全に非表示（null）になる", () => {
    const station = createDummyStation({ name: "存在しない駅", lines: ["JR山手線"] });

    const { container } = render(
      <LocaleProvider initialLocale="ja">
        <MeetingPoints station={station} dataset={typedSampleData} />
      </LocaleProvider>,
    );

    // 何も描画されない（空のコンテナ）
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("待ち合わせスポット")).not.toBeInTheDocument();
  });
});
