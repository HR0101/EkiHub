import { describe, expect, it } from "vitest";

import { estimateFareYen } from "../lib/fareEstimate.js";

/**
 * 運賃概算（lib/fareEstimate.js）が、JR東日本の 2026年3月14日改定後の
 * 幹線 IC 運賃表どおりの区間で運賃を返すかを確かめる。
 * 営業キロは 1km 未満を切り上げてから区間を決める。
 */

interface FareCase {
  km: number;
  fareYen: number;
}

/** 区間の境界（上限ちょうどと、その直後） */
const BOUNDARY_CASES: FareCase[] = [
  { km: 1, fareYen: 155 },
  { km: 3, fareYen: 155 },
  { km: 4, fareYen: 199 },
  { km: 10, fareYen: 209 },
  { km: 11, fareYen: 253 },
  { km: 50, fareYen: 902 },
  { km: 51, fareYen: 1034 },
  { km: 100, fareYen: 1782 },
  { km: 101, fareYen: 2090 },
  { km: 160, fareYen: 2750 },
];

/** 1km 未満の端数は切り上げて次の区間に入る */
const FRACTION_CASES: FareCase[] = [
  { km: 0.4, fareYen: 155 },
  { km: 3.1, fareYen: 199 },
  { km: 10.3, fareYen: 253 },
];

/** 表の上限（160km）を超えた分は 20km ごとに 330円を足す */
const BEYOND_TABLE_CASES: FareCase[] = [
  { km: 161, fareYen: 3080 },
  { km: 180, fareYen: 3080 },
  { km: 181, fareYen: 3410 },
];

describe("運賃概算（2026年3月改定後の幹線IC運賃）", () => {
  it.each(BOUNDARY_CASES)("$km km は $fareYen 円", ({ km, fareYen }) => {
    expect(estimateFareYen(km)).toBe(fareYen);
  });

  it.each(FRACTION_CASES)("端数のある $km km は $fareYen 円", ({ km, fareYen }) => {
    expect(estimateFareYen(km)).toBe(fareYen);
  });

  it.each(BEYOND_TABLE_CASES)("表を超える $km km は $fareYen 円", ({ km, fareYen }) => {
    expect(estimateFareYen(km)).toBe(fareYen);
  });

  it.each([0, -5, Number.NaN])("距離が %s のときは 0 円", (km) => {
    expect(estimateFareYen(km)).toBe(0);
  });
});
