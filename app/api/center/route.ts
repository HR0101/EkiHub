import { computeCenterStation } from "../../../lib/centerLogic.js";
import { makeProviderFromEnv } from "../../../lib/routeProvider.js";
import { loadStations } from "@/server/stationRepository";
import type {
  ApiError,
  CenterRequest,
  CenterResult,
  Mode,
  Station,
} from "@/types/ekihub";

export const dynamic = "force-dynamic";

/** 経路プロバイダ。環境変数が未設定なら null（距離概算へフォールバック） */
const routeProvider = makeProviderFromEnv();
const ROUTING_ENABLED = Boolean(routeProvider);

/** ランキングに残す件数と、経路APIで精緻化する件数 */
const TOP_N = 8;
const REFINE_COUNT = 8;

/** 未指定・不正値のときに使う既定の重み */
const DEFAULT_FAIRNESS_WEIGHT = 0.6;
const DEFAULT_FARE_WEIGHT = 0;

/** 0〜1 に収まる数値だけ受け取り、それ以外は既定値へ倒す */
function clampWeight(value: unknown, fallback: number): number {
  return typeof value === "number" && value >= 0 && value <= 1 ? value : fallback;
}

/** 人数は 1 以上の整数だけ受け取る */
function normalizePeople(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

/** 中心駅算出API */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as Partial<CenterRequest>;
    const { origins, mode, weight, fareWeight, peopleCounts } = body;

    if (!Array.isArray(origins) || origins.length < 2) {
      return Response.json(
        { error: "最寄駅を2駅以上入力してください." } satisfies ApiError,
        { status: 400 }
      );
    }

    const safeMode: Mode = mode === "A" ? "A" : "B";
    const fairnessWeight = clampWeight(weight, DEFAULT_FAIRNESS_WEIGHT);
    const safeFareWeight = clampWeight(fareWeight, DEFAULT_FARE_WEIGHT);

    const allStations = await loadStations();
    const stationByName = new Map(allStations.map((s) => [s.name, s]));

    // 入力された駅名を駅マスタへ解決する（人数の重みを付ける）
    const originStations: (Station & { people: number })[] = [];
    const unknown: string[] = [];
    origins.forEach((name, index) => {
      const trimmed = typeof name === "string" ? name.trim() : "";
      const found = stationByName.get(trimmed);
      if (found) {
        // 駅マスタは共有参照なので、複製してから people を付ける
        const people = normalizePeople(
          Array.isArray(peopleCounts) ? peopleCounts[index] : 1
        );
        originStations.push({ ...found, people });
      } else if (trimmed.length > 0) {
        unknown.push(trimmed);
      }
    });

    if (unknown.length > 0) {
      return Response.json(
        {
          error: "登録されていない駅名があります: " + unknown.join("、"),
          unknown,
        } satisfies ApiError,
        { status: 400 }
      );
    }
    if (originStations.length < 2) {
      return Response.json(
        { error: "有効な最寄駅を2駅以上入力してください." } satisfies ApiError,
        { status: 400 }
      );
    }

    const result = await computeCenterStation({
      originStations,
      allStations,
      mode: safeMode,
      routeProvider,
      topN: TOP_N,
      fairnessWeight,
      fareWeight: safeFareWeight,
      refineCount: REFINE_COUNT,
    });

    const payload: CenterResult = {
      ...result,
      origins: originStations.map(({ name, kana, lat, lng, people }) => ({
        name,
        kana,
        lat,
        lng,
        people,
      })),
      routingUsed: ROUTING_ENABLED,
    };
    return Response.json(payload);
  } catch (error) {
    console.error("中心駅の算出に失敗:", error);
    return Response.json(
      {
        error: "算出に失敗しました。時間をおいて再度お試しください。",
      } satisfies ApiError,
      { status: 500 }
    );
  }
}
