/**
 * 待ち合わせスポットデータの参照と距離計算。
 *
 * data/meetingPoints.json をビルド時に同梱して参照する。
 * ファイルが存在しない場合や空の場合は空配列へ安全にフォールバックする。
 */

import defaultDataset from "@data/meetingPoints.json";
import type {
  MeetingPoint,
  MeetingPointType,
  StationMeetingPoints,
} from "@/types/ekihub";

export interface MeetingPointWithDistance extends MeetingPoint {
  /** 駅中心からの直線距離（メートル） */
  distanceMeters?: number;
  /** 徒歩所要時間の目安（分） */
  walkingMinutes?: number;
}

/** 徒歩分数の基準（不動産表示基準: 80m = 1分、端数は切り上げ） */
const WALKING_SPEED_METERS_PER_MINUTE = 80;

/** 地球の平均半径（メートル） */
const EARTH_RADIUS_METERS = 6371000;

/** 2点間の直線距離（メートル, Haversine式） */
export function calculateDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lng2)
  ) {
    return 0;
  }
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h)));
}

/** 距離（メートル）から徒歩所要時間（分）を見積もる（最低1分） */
export function estimateWalkingMinutes(meters: number): number {
  if (!Number.isFinite(meters) || meters <= 0) return 1;
  return Math.max(1, Math.ceil(meters / WALKING_SPEED_METERS_PER_MINUTE));
}

/** 駅名から「駅」サフィックスを取り除く */
export function normalizeStationName(name: string): string {
  if (!name || typeof name !== "string") return "";
  return name.trim().replace(/駅$/, "");
}

/** 許可されているスポット種別 */
const ALLOWED_TYPES = new Set<MeetingPointType>([
  "statue",
  "plaza",
  "gate",
  "building",
  "landmark",
]);

/** スポットデータが妥当かチェック */
function isValidMeetingPoint(item: unknown): item is MeetingPoint {
  if (!item || typeof item !== "object") return false;
  const p = item as Partial<MeetingPoint>;
  return (
    typeof p.name === "string" &&
    p.name.trim().length > 0 &&
    typeof p.lat === "number" &&
    Number.isFinite(p.lat) &&
    typeof p.lng === "number" &&
    Number.isFinite(p.lng) &&
    typeof p.type === "string" &&
    ALLOWED_TYPES.has(p.type as MeetingPointType) &&
    typeof p.description === "string"
  );
}

/**
 * 駅名（および路線）から該当する待ち合わせスポット配列を取得する。
 *
 * @param stationName 検索対象の駅名（「駅」の有無は問わない）
 * @param lines 駅が所属する路線一覧（同名駅の絞り込みに使用）
 * @param dataset 使用するデータセット（未指定時は同梱の defaultDataset）
 * @param stationCoord 駅の座標（指定された場合は距離と徒歩目安を算出）
 */
export function getMeetingPoints(
  stationName: string,
  lines?: readonly string[] | string[],
  dataset?: readonly StationMeetingPoints[] | StationMeetingPoints[],
  stationCoord?: { lat: number; lng: number } | null,
): MeetingPointWithDistance[] {
  const cleanName = normalizeStationName(stationName);
  if (!cleanName) return [];

  const rawList = dataset ?? (defaultDataset as StationMeetingPoints[]);
  if (!Array.isArray(rawList) || rawList.length === 0) return [];

  // 駅名が一致し、meetingPoints が配列であるエントリを抽出
  const matchedEntries = rawList.filter(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      normalizeStationName(entry.station) === cleanName &&
      Array.isArray(entry.meetingPoints),
  );

  if (matchedEntries.length === 0) return [];

  let targetEntry: StationMeetingPoints | undefined;

  if (matchedEntries.length === 1) {
    targetEntry = matchedEntries[0];
  } else {
    // 同名駅の照合: lines と stationHint の一致を探す
    if (lines && lines.length > 0) {
      targetEntry = matchedEntries.find((entry) => {
        if (!entry.stationHint) return false;
        const hint = entry.stationHint.trim();
        return lines.some(
          (line) => line.includes(hint) || hint.includes(line),
        );
      });
    }
    // 路線で一致しなかった場合、stationHint が無いエントリ、または先頭のエントリへフォールバック
    if (!targetEntry) {
      targetEntry =
        matchedEntries.find((entry) => !entry.stationHint) ?? matchedEntries[0];
    }
  }

  if (!targetEntry || !Array.isArray(targetEntry.meetingPoints)) {
    return [];
  }

  // 不正なデータを安全に除外して距離を計算
  const validPoints: MeetingPointWithDistance[] = [];
  for (const point of targetEntry.meetingPoints) {
    if (!isValidMeetingPoint(point)) continue;

    const enriched: MeetingPointWithDistance = { ...point };
    if (
      stationCoord &&
      Number.isFinite(stationCoord.lat) &&
      Number.isFinite(stationCoord.lng)
    ) {
      const dist = calculateDistanceMeters(
        stationCoord.lat,
        stationCoord.lng,
        point.lat,
        point.lng,
      );
      enriched.distanceMeters = dist;
      enriched.walkingMinutes = estimateWalkingMinutes(dist);
    }
    validPoints.push(enriched);
  }

  return validPoints;
}
