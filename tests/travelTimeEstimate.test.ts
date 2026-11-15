import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { getOrBuildGraph, shortestFrom } from "../lib/stationGraph.js";
import { loadRailLines, loadStations } from "@/server/stationRepository";

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
  { from: "大宮(埼玉)", to: "新宿", minutes: 33 },
  { from: "立川", to: "新宿", minutes: 27 },
  { from: "柏", to: "上野", minutes: 28 },
  { from: "町田", to: "新宿", minutes: 32 },
  // 短い区間
  { from: "渋谷", to: "新宿", minutes: 7 },
];

/**
 * 関西・名古屋の代表区間。新快速・快速・特急など、特急料金の要らない最速の列車の
 * 時刻表上の乗車時間の目安（乗換案内での検索値ではない）。
 * 新快速が走る区間は以前は実際の約1.9倍に出ていたため、関東と同じ基準で確かめる。
 * 大阪→天王寺（環状線で約17分）は近接グラフが短く出す別の問題があるため含めない。
 */
const KANSAI_CHUBU_ROUTES: ReferenceRoute[] = [
  // 新快速が走る区間
  { from: "大阪", to: "京都", minutes: 29 },
  { from: "大阪", to: "三ノ宮", minutes: 21 },
  { from: "大阪", to: "姫路", minutes: 62 },
  { from: "京都", to: "新大阪", minutes: 24 },
  { from: "京都", to: "草津(滋賀)", minutes: 20 },
  { from: "三ノ宮", to: "姫路", minutes: 40 },
  { from: "名古屋", to: "岐阜", minutes: 20 },
  { from: "名古屋", to: "豊橋", minutes: 50 },
  { from: "名古屋", to: "刈谷", minutes: 18 },
  // 新快速の区間以外（近接グラフのままの区間が悪くならないことの対照）
  { from: "名古屋", to: "金山(愛知)", minutes: 5 },
  { from: "大阪難波", to: "近鉄奈良", minutes: 38 },
  { from: "淀屋橋", to: "祇園四条", minutes: 48 },
  { from: "京都", to: "奈良", minutes: 45 },
];

let estimateMinutes: (from: string, to: string) => number;

beforeAll(async () => {
  // ODPT の駅で拡張せず、リポジトリに同梱した駅データだけで計算する
  vi.stubEnv("ODPT_TOKEN", "");
  // 本番と同じく路線データを渡し、新快速の区間の快速の辺も含めて計算する
  const graph = getOrBuildGraph(await loadStations(), { railLines: await loadRailLines() });
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

describe.each([
  { region: "関東（乗換案内）", routes: REFERENCE_ROUTES },
  { region: "関西・名古屋（時刻表の目安）", routes: KANSAI_CHUBU_ROUTES },
])("鉄道網ルート概算の所要時間：$region", ({ routes }) => {
  it.each(routes)(
    "$from → $to が参照値（$minutes 分）の ±30% に収まる",
    (route) => {
      const estimated = estimateMinutes(route.from, route.to);
      expect(
        Math.abs(relativeError(route)),
        `推定 ${estimated.toFixed(1)} 分`,
      ).toBeLessThanOrEqual(MAX_ROUTE_ERROR);
    },
  );

  it("全体として長め・短めに偏らない", () => {
    const errors = routes.map(relativeError);
    const meanBias = errors.reduce((sum, error) => sum + error, 0) / errors.length;
    expect(Math.abs(meanBias)).toBeLessThanOrEqual(MAX_MEAN_BIAS);
  });
});
