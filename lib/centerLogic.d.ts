import type { CenterResult, Mode, Station } from "../src/types/ekihub";
import type { RouteProvider } from "./routeProvider";

/** computeCenterStation の戻り値。origins と routingUsed は API 層で付け足す */
export type ComputeCenterResult = Omit<CenterResult, "origins" | "routingUsed">;

export interface ComputeCenterOptions {
  /** 人数の重みを付けた入力駅 */
  originStations: (Station & { people: number })[];
  allStations: Station[];
  mode: Mode;
  /** 経路API。null なら距離概算へフォールバックする */
  routeProvider?: RouteProvider | null;
  /** ランキングに残す件数 */
  topN?: number;
  /** 公平さの重み 0〜1 */
  fairnessWeight?: number;
  /** 運賃の重み 0〜1 */
  fareWeight?: number;
  /** 経路APIで精緻化する上位件数 */
  refineCount?: number;
}

export function computeCenterStation(
  options: ComputeCenterOptions
): Promise<ComputeCenterResult>;
