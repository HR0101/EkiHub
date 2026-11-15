/**
 * 駅マスタの読み込みとマージ。
 *
 * 3つのデータ源を1つの配列にまとめる（同名駅は先に入った方を優先）。
 *   1. data/stations.js       … 手動キュレーションの主要駅（乗降客数つき）
 *   2. data/stations-osm.json … OSM 由来の関東圏全駅（生成物）
 *   3. ODPT の駅API           … トークンがある時だけ全国へ拡張
 * そのうえで data/ridership.json（国土数値情報S12）の実測値を当て、
 * 主要駅フラグを確定する。
 *
 * 結果はモジュールスコープにキャッシュするので、
 * リクエストのたびにファイルを読み直すことはない。
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { stations as embeddedStations } from "../../data/stations.js";
import type { Station } from "../types/ekihub";

/** モードA（主要駅）判定のしきい値。data/stations.js の値と揃えること */
const MAJOR_THRESHOLD = 200000;

/** ridership.json に載らない地域の主要駅を手当てする */
const EXTRA_MAJOR_STATIONS = new Set([
  "札幌", "青森", "盛岡", "仙台", "秋田", "山形", "福島",
  "新潟", "富山", "金沢", "福井", "甲府", "長野",
  "岐阜", "静岡", "浜松", "名古屋", "豊橋",
  "津", "大津", "京都", "大阪", "新大阪", "天王寺", "難波", "なんば", "京橋",
  "神戸", "三ノ宮", "姫路", "奈良", "和歌山",
  "鳥取", "松江", "岡山", "倉敷", "広島", "福山", "山口", "新山口",
  "徳島", "高松", "松山", "高知",
  "福岡", "博多", "小倉", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島中央", "那覇空港",
]);

/** data/ 以下の生成物を読む。無い・壊れている場合は既定値で続行する */
function readJsonFile<T>(fileName: string, fallback: T): T {
  const path = join(process.cwd(), "data", fileName);
  if (!existsSync(path)) return fallback;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
    return (parsed ?? fallback) as T;
  } catch (error) {
    console.error(`${fileName} の読込に失敗:`, (error as Error).message);
    return fallback;
  }
}

const osmStations = readJsonFile<Station[]>("stations-osm.json", []);
const ridershipMap = readJsonFile<Record<string, number>>("ridership.json", {});

/** 乗降客数の実測値を当て、主要駅フラグを再計算する */
function applyRidership(stations: Station[]): Station[] {
  for (const station of stations) {
    const measured = ridershipMap[station.name];
    if (typeof measured === "number" && measured > 0) {
      station.ridership = measured;
    }
    station.isMajor =
      station.isMajor === true ||
      (station.ridership ?? 0) >= MAJOR_THRESHOLD ||
      EXTRA_MAJOR_STATIONS.has(station.name);
  }
  return stations;
}

/** 同名駅の重複を排除して2配列をマージする（base を優先） */
function mergeStations(base: Station[], extra: Station[]): Station[] {
  const map = new Map<string, Station>();
  for (const station of base) map.set(station.name, station);
  for (const station of extra) {
    if (!map.has(station.name)) map.set(station.name, station);
  }
  return Array.from(map.values());
}

/** ODPT の駅APIレスポンス（必要なフィールドだけ） */
interface OdptStation {
  "dc:title"?: string;
  "geo:lat"?: number | string;
  "geo:long"?: number | string;
  "odpt:railway"?: string;
  "odpt:stationTitle"?: { ja?: string };
}

/** ODPT のレスポンスを内部形式へ正規化する */
function normalizeOdptStations(raw: OdptStation[]): Station[] {
  return raw
    .filter((item) => item["geo:lat"] && item["geo:long"] && item["dc:title"])
    .map((item) => ({
      name: String(item["dc:title"]),
      kana: item["odpt:stationTitle"]?.ja ?? String(item["dc:title"]),
      lat: Number(item["geo:lat"]),
      lng: Number(item["geo:long"]),
      lines: item["odpt:railway"]
        ? [String(item["odpt:railway"]).split(".").pop() ?? ""]
        : [],
      // ODPT は乗降客数を持たないため 0。モードAでは埋め込みの主要駅が優先される
      ridership: 0,
      isMajor: false,
    }));
}

let stationCache: Station[] | null = null;

/** 全駅の一覧を返す（初回だけ読み込み、以降はキャッシュ） */
export async function loadStations(): Promise<Station[]> {
  if (stationCache) return stationCache;

  const baseStations = applyRidership(
    mergeStations(embeddedStations as Station[], osmStations)
  );

  const token = process.env.ODPT_TOKEN?.trim();
  if (!token) {
    stationCache = baseStations;
    return stationCache;
  }

  try {
    const endpoint =
      "https://api.odpt.org/api/v4/odpt:Station?acl:consumerKey=" +
      encodeURIComponent(token);
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error("ODPT応答エラー: " + response.status);

    const raw = (await response.json()) as OdptStation[];
    stationCache = mergeStations(baseStations, normalizeOdptStations(raw));
    console.log(`ODPT拡張完了: 合計 ${stationCache.length} 駅`);
    return stationCache;
  } catch (error) {
    // 外部APIが落ちていてもアプリは動かし続ける
    console.error(
      "ODPT取得失敗のため埋め込み+OSMデータで継続します:",
      (error as Error).message
    );
    stationCache = baseStations;
    return stationCache;
  }
}

/** 駅名から駅を引くための Map を返す */
export async function loadStationIndex(): Promise<Map<string, Station>> {
  const stations = await loadStations();
  return new Map(stations.map((station) => [station.name, station]));
}
