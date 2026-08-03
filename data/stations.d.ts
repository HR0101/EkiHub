import type { Station } from "../src/types/ekihub";

/**
 * 手動でキュレーションした主要駅。
 * isMajor はサーバー側で乗降客数から再計算するため、ここでは省略されている。
 */
export const stations: (Omit<Station, "isMajor"> & { isMajor?: boolean })[];

/** 緯度経度に応じた主要駅判定のしきい値（1日あたり乗降客数） */
export function getMajorThreshold(lat: number, lng: number): number;
