/**
 * 周辺スポットの取得。
 *
 * 既定はブラウザから Overpass を直接叩く。旧実装からの設計方針で、
 *   - 取得が利用者のネットワークで行われるため、サーバーの帯域とレート制限を使わない
 *   - サーバーが Overpass へ到達できない環境でも動く
 * という利点がある（Overpass は CORS を許可している）。
 *
 * ブラウザから出られなかったときだけ、サーバー経由（/api/spots）へ落とす。
 * 企業内ネットワークなどで直接アクセスが塞がれている場合の保険。
 */

import { fetchNearbySpots } from "../../lib/poiService.js";
import { fetchSpots as fetchSpotsViaServer } from "@/lib/api";
import type { Spot, SpotCategory } from "@/types/ekihub";

export interface SpotQuery {
  lat: number;
  lng: number;
  category: SpotCategory;
  radius: number;
}

/** 取得元。UI に「どちらで取れたか」を出す必要はないが、調査時に役立つ */
export type SpotSource = "browser" | "server";

export interface SpotResult {
  spots: Spot[];
  source: SpotSource;
}

export async function fetchSpotsWithFallback(
  query: SpotQuery,
  signal?: AbortSignal
): Promise<SpotResult> {
  try {
    const spots = await fetchNearbySpots(query);
    return { spots, source: "browser" };
  } catch (browserError) {
    console.warn(
      "Overpassへ直接アクセスできなかったため、サーバー経由で取得します:",
      (browserError as Error).message
    );
    const spots = await fetchSpotsViaServer(query, signal);
    return { spots, source: "server" };
  }
}
