import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { getOrBuildGraph, shortestFrom } from "../lib/stationGraph.js";
import { loadStations } from "@/server/stationRepository";

/**
 * 鉄道網ルート概算（lib/stationGraph.js）の所要時間を、乗換案内の値と突き合わせる。
 *
 * 正解は Yahoo!乗換案内で 2026-10-27（火）14:50 ごろ出発として検索した最速経路の
 * 所要時間（乗換・待ち時間を含む）。ダイヤ改正で数分ずれても許容幅に収まる。
 *
 * 距離から時間を出すモデルなので、乗換の多い区間（千葉→豊洲：1kmあたり約1.7分）と
 * 快速で直通する区間（立川→新宿：同約1.0分）を同時に ±20% へは収められない
 * （どの係数でも片方が25%前後ずれる）。そこで各区間は ±30%、
 * 全区間の誤差の平均（長め・短めへの偏り）は ±10% に収まることを確かめる。
 */

interface ReferenceRoute {
  from: string;
  to: string;
  /** 乗換案内の所要時間（分） */
  minutes: number;
}

/** 1区間あたりの許容誤差（相対） */
const MAX_ROUTE_ERROR = 0.3;
/** 全区間の誤差の平均の許容幅（相対） */
const MAX_MEAN_BIAS = 0.1;
/** 全国約8,200駅のグラフ構築に数秒かかるため、準備だけ長めに待つ */
const GRAPH_BUILD_TIMEOUT_MS = 60_000;

const REFERENCE_ROUTES: ReferenceRoute[] = [
  // Issue #93 で報告された区間（湾岸部へ乗り換えて向かう）
  { from: "横浜", to: "豊洲", minutes: 48 },
  { from: "千葉", to: "豊洲", minutes: 60 },
  { from: "東京", to: "新木場", minutes: 9 },
  { from: "川崎", to: "新木場", minutes: 37 },
  { from: "船橋", to: "新木場", minutes: 28 },
  // 快速・直通の1本で行ける区間（係数を湾岸部だけに合わせないための対照）
  { from: "池袋", to: "横浜", minutes: 36 },
  { from: "大宮", to: "新宿", minutes: 33 },
  { from: "立川", to: "新宿", minutes: 27 },
  { from: "柏", to: "上野", minutes: 28 },
  { from: "町田", to: "新宿", minutes: 32 },
  // 短い区間
  { from: "渋谷", to: "新宿", minutes: 7 },
];

let estimateMinutes: (from: string, to: string) => number;

beforeAll(async () => {
  // ODPT の駅で拡張せず、リポジトリに同梱した駅データだけで計算する
  vi.stubEnv("ODPT_TOKEN", "");
  const graph = getOrBuildGraph(await loadStations());
  estimateMinutes = (from, to) => {
    const fromIndex = graph.indexByName.get(from);
    const toIndex = graph.indexByName.get(to);
    if (fromIndex === undefined || toIndex === undefined) {
      throw new Error(`駅が見つかりません: ${from} → ${to}`);
    }
    return shortestFrom(graph, fromIndex).minutes[toIndex];
  };
}, GRAPH_BUILD_TIMEOUT_MS);

afterAll(() => {
  vi.unstubAllEnvs();
});

/** 推定が乗換案内よりどれだけ長い（正）／短い（負）か */
function relativeError(route: ReferenceRoute): number {
  return estimateMinutes(route.from, route.to) / route.minutes - 1;
}

describe("鉄道網ルート概算の所要時間", () => {
  it.each(REFERENCE_ROUTES)(
    "$from → $to が乗換案内（$minutes 分）の ±30% に収まる",
    (route) => {
      const estimated = estimateMinutes(route.from, route.to);
      expect(
        Math.abs(relativeError(route)),
        `推定 ${estimated.toFixed(1)} 分`,
      ).toBeLessThanOrEqual(MAX_ROUTE_ERROR);
    },
  );

  it("全体として長め・短めに偏らない", () => {
    const errors = REFERENCE_ROUTES.map(relativeError);
    const meanBias = errors.reduce((sum, error) => sum + error, 0) / errors.length;
    expect(Math.abs(meanBias)).toBeLessThanOrEqual(MAX_MEAN_BIAS);
  });
});
