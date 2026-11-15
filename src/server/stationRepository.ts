/**
 * 駅マスタの読み込みと、旧駅名の読み替え。
 *
 * 駅マスタは scripts/buildStationMaster.js が作る data/stations-master.json。
 * station_database（CC BY 4.0）の全国の営業中の駅に、手動キュレーションの主要駅
 * （data/stations.js）と乗降客数（data/ridership.json）を当てた生成物で、
 * 同名駅は「日吉(神奈川)」のように駅名で区別されている。
 *
 * 共有URL・履歴・保存済みグループに残る旧駅名（例:「日吉」「市ヶ谷」）は、
 * data/station-aliases.json で新しい駅名へ読み替える。
 *
 * 結果はモジュールスコープにキャッシュするので、
 * リクエストのたびにファイルを読み直すことはない。
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { stations as embeddedStations } from "../../data/stations.js";
import type { RailLine, Station } from "../types/ekihub";

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

/** 駅マスタが読めないときは、手動キュレーションの主要駅だけで動かし続ける */
function fallbackStations(): Station[] {
  console.error("stations-master.json が読めないため、手動データの主要駅だけで続行します");
  return (embeddedStations as Station[]).map((station) => ({
    ...station,
    isMajor: station.isMajor === true,
  }));
}

let stationCache: Station[] | null = null;
let indexCache: Map<string, Station> | null = null;

/** 全駅の一覧を返す（初回だけ読み込み、以降はキャッシュ） */
export async function loadStations(): Promise<Station[]> {
  if (stationCache) return stationCache;
  const master = readJsonFile<Station[]>("stations-master.json", []);
  stationCache = master.length > 0 ? master : fallbackStations();
  return stationCache;
}

/**
 * 駅名から駅を引くための Map を返す。
 * 旧駅名も読み替え先の駅を指すので、`get(name)?.name` が新しい駅名になる。
 */
export async function loadStationIndex(): Promise<Map<string, Station>> {
  if (indexCache) return indexCache;
  const stations = await loadStations();
  const index = new Map(stations.map((station) => [station.name, station]));
  const aliases = readJsonFile<Record<string, string>>("station-aliases.json", {});
  for (const [from, to] of Object.entries(aliases)) {
    const station = index.get(to);
    // 実在する駅名は読み替えで上書きしない
    if (station && !index.has(from)) index.set(from, station);
  }
  indexCache = index;
  return indexCache;
}

let railLinesCache: RailLine[] | null = null;

/**
 * 路線ごとの駅の並び（data/rail-lines.json）を返す。
 * 新快速の区間の所要時間の補正に使う。無ければ空配列（補正なし）で続行する。
 */
export async function loadRailLines(): Promise<RailLine[]> {
  if (railLinesCache) return railLinesCache;
  const railLines = readJsonFile<RailLine[]>("rail-lines.json", []);
  railLinesCache = Array.isArray(railLines) ? railLines : [];
  return railLinesCache;
}
