/**
 * 待ち合わせスポットデータの参照と距離計算。
 *
 * data/meetingPoints.json をビルド時に同梱して参照する。
 * 実データ未収集の間は空配列（[]）をコミットしておき、空の場合は空配列を返す。
 * ビルド設定でのエイリアス差し替えには頼らない（設定の分岐が本番ビルドの事故源になるため）。
 */

import defaultDataset from "../../data/meetingPoints.json";
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

/**
 * 駅から離れすぎたスポットを除外する距離の上限（メートル）。
 * scripts/validateMeetingPoints.js の MAX_DISTANCE_ERROR_M と揃えること。
 * 同名駅の取り違えや座標の誤りが、画面に出ないようにする最後の防壁。
 */
export const MAX_DISTANCE_FROM_STATION_METERS = 1000;

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

/** stationHint が駅の路線一覧のいずれかと一致するか */
function matchesLines(hint: string, lines: readonly string[]): boolean {
  const trimmed = hint.trim();
  if (!trimmed) return false;
  return lines.some((line) => line.includes(trimmed) || trimmed.includes(line));
}

/**
 * 駅名が一致した複数エントリから、対象の駅のものを選ぶ。
 *
 * 優先順位:
 *   1. stationHint が路線と一致するエントリ（確実に同じ駅）
 *   2. stationHint の無いエントリ（同名駅が他にない前提で書かれたもの）
 *   3. 路線が不明（lines が空）のときに限り、stationHint 付きのエントリ
 *      （照合できないため、後段の距離チェックに委ねる）
 * 路線が分かっていて stationHint と食い違うエントリは、同名の別駅なので採用しない。
 */
function selectEntry(
  entries: readonly StationMeetingPoints[],
  lines?: readonly string[] | string[],
): StationMeetingPoints | undefined {
  const knownLines = lines ?? [];
  const verified = entries.find(
    (entry) => entry.stationHint && matchesLines(entry.stationHint, knownLines),
  );
  if (verified) return verified;

  const generic = entries.find((entry) => !entry.stationHint);
  if (generic) return generic;

  if (knownLines.length === 0) return entries[0];
  return undefined;
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

  const targetEntry = selectEntry(matchedEntries, lines);

  if (!targetEntry) return [];

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
      // 駅から遠すぎるスポットは、別の駅の情報や座標の誤りとみなして除外
      if (dist > MAX_DISTANCE_FROM_STATION_METERS) continue;
      enriched.distanceMeters = dist;
      enriched.walkingMinutes = estimateWalkingMinutes(dist);
    }
    validPoints.push(enriched);
  }

  return validPoints;
}
