import type { Spot, SpotCategory } from "../src/types/ekihub";

/** カテゴリの表示名（キーがそのまま API のカテゴリ値） */
export const CATEGORY_LABELS: Record<SpotCategory, string>;

export interface NearbySpotsQuery {
  lat: number;
  lng: number;
  /** 既定は "cafe" */
  category?: SpotCategory;
  /** 検索半径（メートル）。既定 800 */
  radius?: number;
}

/** Overpass から周辺スポットを取得する（キャッシュ＋タイムアウト付き） */
export function fetchNearbySpots(query: NearbySpotsQuery): Promise<Spot[]>;
