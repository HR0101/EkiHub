// 駅マスタ（data/stations-master.json）と旧駅名の読み替え表（data/station-aliases.json）を作るビルドスクリプト.
//
// 元データ: station_database（https://github.com/Seo-4d696b75/station_database, CC BY 4.0）
//   リリースタグを固定して out/main/station.json と out/main/line.json を取得し、そのディレクトリを渡す.
//   例: TAG=v20260930
//       curl -sSLO https://raw.githubusercontent.com/Seo-4d696b75/station_database/$TAG/out/main/station.json
//       curl -sSLO https://raw.githubusercontent.com/Seo-4d696b75/station_database/$TAG/out/main/line.json
//       node scripts/buildStationMaster.js <取得したディレクトリ> $TAG
//
// 方針:
//   - 同名駅は station_database の表記どおり「日吉(神奈川)」のように半角カッコで区別する.
//   - 「市ケ谷(市ヶ谷)」のような別表記のカッコは、衝突しない限り前半だけを駅名にする.
//   - 手動キュレーションの主要駅（data/stations.js）と乗降客数（data/ridership.json）は、
//     元の駅名と座標で対応付けて当てる. 読みの確認済み補正（data/station-kana-overrides.json）も上書きする.
//   - 共有URL・履歴・保存済みグループに残る旧駅名は読み替え表で新しい駅名へ対応付ける.
//     同名駅の元の名前（例: 「日吉」）は、乗降客数が最も多い駅へ読み替える.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { stations as curatedStations } from "../data/stations.js";
import { normalizeStationKana, findStationKanaOverride } from "../lib/stationKana.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const MASTER_PATH = join(DATA_DIR, "stations-master.json");
const ALIASES_PATH = join(DATA_DIR, "station-aliases.json");
const LEGACY_OSM_PATH = join(DATA_DIR, "stations-osm.json");
const RIDERSHIP_PATH = join(DATA_DIR, "ridership.json");
const KANA_OVERRIDES_PATH = join(DATA_DIR, "station-kana-overrides.json");

// 地球半径(メートル)
const EARTH_RADIUS_M = 6371000;
// 手動キュレーションの駅を対応付けるときに許す距離(メートル). 代表点の取り方の差を吸収する.
const CURATED_MATCH_RADIUS_M = 2000;
// 旧データの駅名を読み替えるときに許す距離(メートル).
const LEGACY_MATCH_RADIUS_M = 3000;
// モードA（主要駅）判定のしきい値. data/stations.js・src/server/stationRepository.ts・lib/centerLogic.js と揃える.
const MAJOR_THRESHOLD = 200000;
// ridership.json の対象範囲（scripts/buildRidership.js の関東圏と同じ）[南, 西, 北, 東]
const RIDERSHIP_BBOX = { south: 34.9, west: 138.9, north: 37.2, east: 141.1 };

// ridership.json に載らない地域の主要駅. 同名駅がある場合は区別した名前で書く.
const EXTRA_MAJOR_STATIONS = [
  "札幌", "青森", "盛岡", "仙台(JR)", "秋田", "山形", "福島(福島)",
  "新潟", "富山", "金沢", "福井(福井)", "甲府", "長野",
  "岐阜", "静岡", "浜松", "名古屋", "豊橋",
  "津", "大津", "京都", "大阪", "新大阪", "天王寺", "難波", "なんば", "京橋(大阪)",
  "神戸(兵庫)", "三ノ宮", "姫路", "奈良", "和歌山",
  "鳥取", "松江", "岡山", "倉敷", "広島", "福山", "山口(山口)", "新山口",
  "徳島", "高松(香川)", "松山(愛媛)", "高知",
  "博多", "小倉(福岡)", "佐賀", "長崎(長崎)", "熊本", "大分", "宮崎", "鹿児島中央", "那覇空港",
];

// station_database の区別用の名前のうち、利用者に分かりにくいものを言い換える.
// 浅草は東武・東京メトロ・都営の駅が「浅草(その他)」になっているため、主たる駅として「浅草」にする.
const DISPLAY_NAME_OVERRIDES = {
  "浅草(その他)": "浅草",
};

// 表記揺れでは対応付けられない旧駅名（station_database では別の駅にまとめられている）
const LEGACY_MANUAL_ALIASES = {
  "モノレール浜松町": "浜松町",
  "新線新宿": "新宿",
};

// 全角数字を半角へ寄せる（「羽田空港第３ターミナル」を「羽田空港第3ターミナル」で打てるようにする）
function toHalfWidthDigits(value) {
  return value.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

// 度をラジアンに変換する
function toRadians(degree) {
  return (degree * Math.PI) / 180;
}

// 2地点間のハバーサイン距離(メートル)を返す
function distanceMeters(a, b) {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// 表記揺れ（ヶ/ケ/ヵ、ッ/ツ、驒/騨 など）を寄せて、旧データとの照合に使う
function normalizeForMatch(name) {
  return String(name ?? "")
    .normalize("NFKC")
    .replace(/[ヶヵケ]/g, "ケ")
    .replace(/ッ/g, "ツ")
    .replace(/驒/g, "騨")
    .replace(/祗/g, "祇")
    .replace(/鴬/g, "鶯")
    .replace(/遥/g, "遙")
    .replace(/\s+/g, "")
    .replace(/駅$/u, "");
}

// JSON ファイルを読む. 無い・壊れている場合は理由を添えて止める
function readJson(path, label) {
  if (!existsSync(path)) throw new Error(`${label} が見つかりません: ${path}`);
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (error) {
    throw new Error(`${label} を読めません: ${error.message}`);
  }
}

// 「前半(後半)」「前半（後半）」の形なら2つに分ける
function splitParenthesized(name) {
  const match = /^(.+?)[(（](.+)[)）]$/.exec(name);
  return match ? { head: match[1], inner: match[2] } : null;
}

// station_database の営業中の駅を、アプリの駅の形へ変換する
function convertStations(rawStations, lineNameByCode) {
  const active = rawStations
    .filter((station) => station.closed === false)
    .map((station) => {
      const name = toHalfWidthDigits(station.name);
      return {
        ...station,
        name: DISPLAY_NAME_OVERRIDES[name] ?? name,
        original_name: toHalfWidthDigits(station.original_name),
      };
    });
  const takenNames = new Set(active.map((station) => station.name));
  const takenOriginals = new Set(active.map((station) => station.original_name));
  const extraAliases = new Map();

  const converted = active.map((station) => {
    let name = station.name;
    let originalName = station.original_name;
    // 別表記・副駅名のカッコ（例: 市ケ谷(市ヶ谷)、押上（スカイツリー前））は、
    // 前半が他の駅と衝突しなければ前半だけを駅名にする（同名駅を区別するカッコは残す）
    const parts = station.name === station.original_name ? splitParenthesized(station.name) : null;
    if (parts && !takenNames.has(parts.head) && !takenOriginals.has(parts.head)) {
      takenNames.add(parts.head);
      extraAliases.set(station.name, parts.head);
      extraAliases.set(parts.inner, parts.head);
      name = parts.head;
      originalName = parts.head;
    }
    const lines = [...new Set(station.lines.map((code) => lineNameByCode.get(code)).filter(Boolean))];
    return {
      code: station.code,
      name,
      originalName,
      kana: normalizeStationKana(station.name_kana),
      lat: station.lat,
      lng: station.lng,
      lines,
      prefecture: station.prefecture,
      ridership: 0,
      isMajor: false,
    };
  });
  return { converted, extraAliases };
}

// 照合用の名前（元の駅名・別表記）から駅を引く索引を作る
function buildMatchIndex(stations, extraAliases) {
  const index = new Map();
  const add = (key, station) => {
    const normalized = normalizeForMatch(key);
    if (!index.has(normalized)) index.set(normalized, []);
    const list = index.get(normalized);
    if (!list.includes(station)) list.push(station);
  };
  const byName = new Map(stations.map((station) => [station.name, station]));
  for (const station of stations) {
    add(station.name, station);
    add(station.originalName, station);
  }
  for (const [alias, name] of extraAliases) add(alias, byName.get(name));
  return index;
}

// 名前が合い、指定距離以内で最も近い駅を返す
function findNearest(matchIndex, name, point, radiusMeters) {
  const candidates = matchIndex.get(normalizeForMatch(name)) ?? [];
  let best = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = distanceMeters(point, candidate);
    if (distance <= radiusMeters && distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

// 手動キュレーションの主要駅の乗降客数・主要駅フラグを当てる
function applyCurated(matchIndex, warnings) {
  for (const curated of curatedStations) {
    const station = findNearest(matchIndex, curated.name, curated, CURATED_MATCH_RADIUS_M);
    if (!station) {
      warnings.push(`手動データの駅が見つかりません: ${curated.name}`);
      continue;
    }
    if (typeof curated.ridership === "number" && curated.ridership > 0) {
      station.ridership = curated.ridership;
    }
    if (curated.isMajor === true) station.isMajor = true;
  }
}

// 座標が ridership.json の対象範囲内か
function inRidershipBbox(station) {
  return (
    station.lat >= RIDERSHIP_BBOX.south && station.lat <= RIDERSHIP_BBOX.north &&
    station.lng >= RIDERSHIP_BBOX.west && station.lng <= RIDERSHIP_BBOX.east
  );
}

// 国土数値情報 S12 由来の乗降客数（駅名キー・関東圏）を当てる.
// 関東圏に同名駅が複数ある場合は、乗り入れ路線の多い駅へ当てる（元データが駅名で合算済みのため）.
function applyRidership(matchIndex, ridershipByName, warnings) {
  for (const [name, value] of Object.entries(ridershipByName)) {
    if (typeof value !== "number" || value <= 0) continue;
    const candidates = (matchIndex.get(normalizeForMatch(name)) ?? []).filter(inRidershipBbox);
    if (candidates.length === 0) continue;
    if (candidates.length > 1) {
      warnings.push(`関東圏に同名駅が複数あるため路線の多い駅へ当てました: ${name}`);
    }
    const target = [...candidates].sort((a, b) => b.lines.length - a.lines.length)[0];
    target.ridership = value;
  }
}

// 主要駅フラグを確定する
function applyMajorFlags(stations, warnings) {
  const byName = new Map(stations.map((station) => [station.name, station]));
  for (const name of EXTRA_MAJOR_STATIONS) {
    const station = byName.get(name);
    if (station) station.isMajor = true;
    else warnings.push(`主要駅の追加指定に該当する駅がありません: ${name}`);
  }
  for (const station of stations) {
    if (station.ridership >= MAJOR_THRESHOLD) station.isMajor = true;
  }
}

// 読みの確認済み補正を当てる（元の駅名と座標で照合する）
function applyKanaOverrides(stations, overrides) {
  let applied = 0;
  for (const station of stations) {
    const override = findStationKanaOverride(station, overrides);
    if (override && override.kana !== station.kana) {
      station.kana = override.kana;
      applied += 1;
    }
  }
  return applied;
}

// 同名駅の代表を選ぶ（主要駅 → 乗降客数 → 路線数 → 駅コードの順）.
// 乗降客数は関東圏と手動データにしか無いため、地方の主要駅を主要駅フラグで先に拾う.
function pickRepresentative(candidates) {
  return [...candidates].sort(
    (a, b) =>
      Number(b.isMajor) - Number(a.isMajor) ||
      b.ridership - a.ridership ||
      b.lines.length - a.lines.length ||
      a.code - b.code,
  )[0];
}

// 旧駅名 → 新しい駅名 の読み替え表を作る
function buildAliases(stations, extraAliases, matchIndex, legacyStations) {
  const names = new Set(stations.map((station) => station.name));
  const aliases = new Map();
  const setAlias = (from, to) => {
    if (!from || names.has(from) || aliases.has(from)) return;
    aliases.set(from, to);
  };

  // 1. 同名駅の元の名前は、乗降客数が最も多い駅へ読み替える
  const groups = new Map();
  for (const station of stations) {
    if (station.originalName === station.name) continue;
    if (!groups.has(station.originalName)) groups.set(station.originalName, []);
    groups.get(station.originalName).push(station);
  }
  for (const [originalName, group] of groups) {
    setAlias(originalName, pickRepresentative(group).name);
  }

  // 2. 別表記のカッコを外した駅の、元の表記と別表記. 表記揺れで寄せられない旧駅名
  for (const [from, to] of extraAliases) setAlias(from, to);
  for (const [from, to] of Object.entries(LEGACY_MANUAL_ALIASES)) {
    if (!names.has(to)) throw new Error(`読み替え先の駅がありません: ${from} → ${to}`);
    setAlias(from, to);
  }

  // 3. 旧データの駅名で、今の駅名に無いものは座標と表記揺れで対応付ける
  const unresolved = [];
  for (const legacy of legacyStations) {
    if (names.has(legacy.name) || aliases.has(legacy.name)) continue;
    const station = findNearest(matchIndex, legacy.name, legacy, LEGACY_MATCH_RADIUS_M);
    if (station) setAlias(legacy.name, station.name);
    else unresolved.push(legacy.name);
  }
  return { aliases, unresolved };
}

// 出力用に、空の項目と内部用の項目を落とす
function toOutputStation(station) {
  const output = {
    name: station.name,
    kana: station.kana,
    lat: station.lat,
    lng: station.lng,
    lines: station.lines,
  };
  if (station.ridership > 0) output.ridership = station.ridership;
  output.isMajor = station.isMajor;
  if (station.originalName !== station.name) output.originalName = station.originalName;
  output.prefecture = station.prefecture;
  return output;
}

function main() {
  const sourceDir = process.argv[2];
  const sourceTag = process.argv[3] ?? "unknown";
  if (!sourceDir) {
    console.error("使い方: node scripts/buildStationMaster.js <station.json と line.json のディレクトリ> [リリースタグ]");
    process.exit(1);
  }

  const rawStations = readJson(join(sourceDir, "station.json"), "station.json");
  const rawLines = readJson(join(sourceDir, "line.json"), "line.json");
  const lineNameByCode = new Map(rawLines.map((line) => [line.code, line.name]));

  const warnings = [];
  const { converted, extraAliases } = convertStations(rawStations, lineNameByCode);
  const duplicated = converted.length - new Set(converted.map((station) => station.name)).size;
  if (duplicated > 0) throw new Error(`駅名が重複しています: ${duplicated} 件`);

  const matchIndex = buildMatchIndex(converted, extraAliases);
  applyCurated(matchIndex, warnings);
  applyRidership(matchIndex, readJson(RIDERSHIP_PATH, "ridership.json"), warnings);
  applyMajorFlags(converted, warnings);
  const kanaApplied = applyKanaOverrides(converted, readJson(KANA_OVERRIDES_PATH, "station-kana-overrides.json"));

  const legacyStations = [...curatedStations, ...readJson(LEGACY_OSM_PATH, "stations-osm.json")];
  const { aliases, unresolved } = buildAliases(converted, extraAliases, matchIndex, legacyStations);

  const master = converted.map(toOutputStation);
  const aliasObject = Object.fromEntries([...aliases].sort(([a], [b]) => a.localeCompare(b, "ja")));
  writeFileSync(MASTER_PATH, JSON.stringify(master) + "\n", "utf-8");
  writeFileSync(ALIASES_PATH, JSON.stringify(aliasObject, null, 2) + "\n", "utf-8");

  const disambiguated = master.filter((station) => station.originalName).length;
  console.log(`元データ: station_database ${sourceTag}（営業中 ${master.length} 駅）`);
  console.log(`同名駅として区別した駅: ${disambiguated} / 主要駅: ${master.filter((s) => s.isMajor).length}`);
  console.log(`読みの補正: ${kanaApplied} 件 / 読み替え表: ${aliases.size} 件`);
  console.log(`旧データで対応する駅が無い駅名（廃止・休止など）: ${unresolved.length} 件`);
  for (const warning of warnings) console.warn("注意:", warning);
  console.log(`出力: ${MASTER_PATH}`);
  console.log(`出力: ${ALIASES_PATH}`);
}

try {
  main();
} catch (error) {
  console.error("駅マスタの生成に失敗しました:", error.message);
  process.exit(1);
}
