import { fetchNearbySpots, CATEGORY_LABELS } from "../../../lib/poiService.js";
import type { ApiError, SpotCategory } from "@/types/ekihub";

export const dynamic = "force-dynamic";

/** 検索半径の範囲（メートル） */
const RADIUS_MIN = 100;
const RADIUS_MAX = 1500;
const RADIUS_DEFAULT = 800;

function isSpotCategory(value: string): value is SpotCategory {
  return Object.hasOwn(CATEGORY_LABELS, value);
}

/** 周辺スポットAPI: 集合駅のまわりで集まれる場所を返す */
export async function GET(request: Request): Promise<Response> {
  try {
    const params = new URL(request.url).searchParams;
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return Response.json(
        { error: "緯度経度を指定してください." } satisfies ApiError,
        { status: 400 }
      );
    }

    const rawCategory = params.get("category") ?? "cafe";
    if (!isSpotCategory(rawCategory)) {
      return Response.json(
        { error: "未対応のカテゴリです: " + rawCategory } satisfies ApiError,
        { status: 400 }
      );
    }

    const radius = Math.min(
      RADIUS_MAX,
      Math.max(RADIUS_MIN, Number(params.get("radius")) || RADIUS_DEFAULT)
    );

    const spots = await fetchNearbySpots({
      lat,
      lng,
      category: rawCategory,
      radius,
    });
    return Response.json({
      count: spots.length,
      category: rawCategory,
      radius,
      spots,
    });
  } catch (error) {
    console.error("周辺スポットの取得に失敗:", error);
    return Response.json(
      {
        error: "周辺スポットの取得に失敗しました。時間をおいて再度お試しください。",
      } satisfies ApiError,
      { status: 500 }
    );
  }
}
