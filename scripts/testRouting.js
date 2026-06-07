// 経路精緻化ロジックのモック検証
//   1) routeProvider 無し: 従来どおり距離概算で算出（routingRefined=false, transfers=null）
//   2) routeProvider 有り(モック): finalists のみ実データで上書きされ、
//      乗換回数が入り、必要に応じてランキングが入れ替わること
//   3) モックの呼び出し回数が「全候補数」ではなく finalists×メンバー数 に抑えられること

import assert from "assert";
import { computeCenterStation } from "../lib/centerLogic.js";

// テスト用の簡易駅マスタ（緯度経度・路線）
const allStations = [
  { name: "A駅", kana: "えー", lat: 35.70, lng: 139.70, lines: ["X線"], ridership: 300000, isMajor: true },
  { name: "B駅", kana: "びー", lat: 35.60, lng: 139.62, lines: ["Y線"], ridership: 300000, isMajor: true },
  { name: "C駅", kana: "しー", lat: 35.66, lng: 139.66, lines: ["Z線"], ridership: 300000, isMajor: true },
  { name: "D駅", kana: "でぃー", lat: 35.65, lng: 139.67, lines: ["Z線"], ridership: 300000, isMajor: true },
  { name: "E駅", kana: "いー", lat: 35.64, lng: 139.69, lines: ["W線"], ridership: 300000, isMajor: true },
  { name: "F駅", kana: "えふ", lat: 35.69, lng: 139.71, lines: ["X線"], ridership: 300000, isMajor: true }
];

const origins = [
  { name: "A駅", kana: "えー", lat: 35.70, lng: 139.70, lines: ["X線"], people: 1 },
  { name: "B駅", kana: "びー", lat: 35.60, lng: 139.62, lines: ["Y線"], people: 1 }
];

async function run() {
  // --- 1) フォールバック（プロバイダ無し） ---
  const base = await computeCenterStation({
    originStations: origins,
    allStations,
    mode: "B",
    routeProvider: null,
    topN: 4
  });
  assert.strictEqual(base.routingRefined, false, "プロバイダ無しでは routingRefined=false");
  assert.ok(base.best, "best が返る");
  assert.strictEqual(base.best.averageTransfers, null, "概算では averageTransfers=null");
  assert.strictEqual(base.best.travelTimes[0].transfers, null, "概算では transfers=null");
  console.log("1) フォールバック: best=", base.best.name, "/ routingRefined=", base.routingRefined);

  // --- 2) モック経路プロバイダ ---
  // C駅を「実データでは非常に速く・乗換0」にして、ランキング上位へ押し上げる
  let callCount = 0;
  const calledPairs = new Set();
  const mockProvider = async (origin, candidate) => {
    callCount += 1;
    calledPairs.add(candidate.name);
    if (candidate.name === "C駅") {
      return { minutes: 5, fareYen: 150, transfers: 0 };
    }
    // 他候補は遅く・乗換2回
    return { minutes: 60, fareYen: 800, transfers: 2 };
  };

  const refined = await computeCenterStation({
    originStations: origins,
    allStations,
    mode: "B",
    routeProvider: mockProvider,
    topN: 4,
    refineCount: 4
  });

  assert.strictEqual(refined.routingRefined, true, "プロバイダ有りでは routingRefined=true");
  // C駅が実データで最速・乗換0 → best になるはず
  assert.strictEqual(refined.best.name, "C駅", "実データでC駅がbestに昇格する");
  assert.strictEqual(refined.best.averageTransfers, 0, "C駅の平均乗換は0");
  assert.strictEqual(refined.best.travelTimes[0].transfers, 0, "C駅の各メンバー乗換は0");
  assert.strictEqual(refined.best.travelTimes[0].minutes, 5, "実データの所要時間で上書きされる");
  assert.strictEqual(refined.best.routed, true, "best.routed=true");
  console.log("2) モック精緻化: best=", refined.best.name, "/ 平均乗換=", refined.best.averageTransfers,
    "/ 所要=", refined.best.travelTimes.map((t) => t.minutes + "分").join(","));

  // --- 3) 呼び出し回数が finalists×メンバー数 に抑えられている ---
  // 候補は入力2駅を除く4駅。finalists=min(refineCount, topN系)=4、メンバー2 → 8回以下
  const maxExpected = 4 * origins.length;
  assert.ok(callCount <= maxExpected, `経路API呼び出しが抑制される (${callCount} <= ${maxExpected})`);
  console.log("3) 呼び出し回数:", callCount, "(上限", maxExpected, ") / 対象候補:", [...calledPairs].join(","));

  console.log("\nALL PASS");
}

run().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
