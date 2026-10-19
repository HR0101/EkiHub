// AIが収集した待ち合わせスポットJSONを検証する
// 使用法: node scripts/validateMeetingPoints.js <JSONファイル>
// エラーがあれば終了コード1で終わる（警告のみなら0）.
// 検証内容: 構造・必須項目・列挙値・駅の実在・座標の妥当性（駅から離れすぎていないか）・重複

import { readFileSync } from 'fs';
import {
  loadStationMaster,
  groupByName,
  distanceMeters
} from './loadStationMaster.js';

// 日本国内とみなす座標範囲
const JAPAN_MIN_LAT = 20;
const JAPAN_MAX_LAT = 46;
const JAPAN_MIN_LNG = 122;
const JAPAN_MAX_LNG = 154;
// 駅からの距離の上限（メートル）. 超えるとエラー，WARN 以上は警告
const MAX_DISTANCE_ERROR_M = 1000;
const MAX_DISTANCE_WARN_M = 500;
// 同一駅あたりの採録件数の上限（超えると警告）
const MAX_POINTS_PER_STATION = 4;
const MAX_DESCRIPTION_LENGTH = 60;
// 座標の小数桁の下限（粗すぎる値は推測の疑い）
const MIN_COORD_DECIMALS = 4;

const ALLOWED_TYPES = ['statue', 'plaza', 'gate', 'building', 'landmark'];
const ALLOWED_CONFIDENCE = ['high', 'medium', 'low'];
const HIRAGANA_PATTERN = /^[ぁ-ゖー・\s]+$/;

const errors = [];
const warnings = [];

const addError = (where, message) => errors.push(`${where}: ${message}`);
const addWarning = (where, message) => warnings.push(`${where}: ${message}`);

// 小数点以下の桁数
function countDecimals(value) {
  const text = String(value);
  const index = text.indexOf('.');
  return index === -1 ? 0 : text.length - index - 1;
}

// URLとして妥当か（http/https のみ）
function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// 入力ファイルを読み込む
function readInput(path) {
  if (!path) {
    console.error('使用法: node scripts/validateMeetingPoints.js <JSONファイル>');
    process.exit(1);
  }
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (error) {
    console.error(`入力ファイルを読み込めません: ${error.message}`);
    process.exit(1);
  }
}

// 項目の駅に対応するマスタ駅の候補を返す（stationHint があれば路線で絞る）
function findCandidates(entry, nameGroups) {
  const candidates = nameGroups.get(entry.station) ?? [];
  if (!entry.stationHint || candidates.length <= 1) return candidates;
  const narrowed = candidates.filter((s) =>
    (s.lines ?? []).some((line) => line.includes(entry.stationHint))
  );
  return narrowed.length > 0 ? narrowed : candidates;
}

// 待ち合わせスポット1件を検証する
function validatePoint(point, where, candidates) {
  if (typeof point.name !== 'string' || point.name.trim() === '') {
    addError(where, 'name が空です');
  }
  if (typeof point.kana !== 'string' || !HIRAGANA_PATTERN.test(point.kana)) {
    addError(where, 'kana はひらがなで指定してください');
  }
  if (!ALLOWED_TYPES.includes(point.type)) {
    addError(where, `type が不正です: ${point.type}（許可: ${ALLOWED_TYPES.join('/')}）`);
  }
  if (!ALLOWED_CONFIDENCE.includes(point.confidence)) {
    addError(where, `confidence が不正です: ${point.confidence}`);
  } else if (point.confidence === 'low') {
    addWarning(where, 'confidence が low です（人の目で確認してください）');
  }
  if (typeof point.description !== 'string' || point.description.trim() === '') {
    addError(where, 'description が空です');
  } else if (point.description.length > MAX_DESCRIPTION_LENGTH) {
    addWarning(where, `description が${MAX_DESCRIPTION_LENGTH}字を超えています`);
  }
  if (point.exit !== null && typeof point.exit !== 'string') {
    addError(where, 'exit は文字列か null にしてください');
  }
  if (typeof point.sourceUrl !== 'string' || !isHttpUrl(point.sourceUrl)) {
    addError(where, 'sourceUrl が有効なURLではありません');
  }

  validateCoordinates(point, where, candidates);
}

// 座標の妥当性（範囲・桁数・駅からの距離）を検証する
function validateCoordinates(point, where, candidates) {
  const { lat, lng } = point;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    addError(where, 'lat / lng が数値ではありません');
    return;
  }
  const inJapan =
    lat >= JAPAN_MIN_LAT && lat <= JAPAN_MAX_LAT &&
    lng >= JAPAN_MIN_LNG && lng <= JAPAN_MAX_LNG;
  if (!inJapan) {
    addError(where, `座標が日本国内にありません (${lat}, ${lng}). 緯度と経度が逆の可能性があります`);
    return;
  }
  if (countDecimals(lat) < MIN_COORD_DECIMALS || countDecimals(lng) < MIN_COORD_DECIMALS) {
    addWarning(where, '座標の桁数が少なく，推測値の疑いがあります');
  }
  if (candidates.length === 0) return;

  // 同名駅が複数ある場合は最も近い駅との距離で判定する
  const nearest = Math.min(
    ...candidates.map((s) => distanceMeters(lat, lng, s.lat, s.lng))
  );
  const rounded = Math.round(nearest);
  if (nearest > MAX_DISTANCE_ERROR_M) {
    addError(where, `駅から${rounded}m離れています（上限${MAX_DISTANCE_ERROR_M}m）`);
  } else if (nearest > MAX_DISTANCE_WARN_M) {
    addWarning(where, `駅から${rounded}m離れています`);
  }
}

// 駅ごとの項目を検証する
function validateEntry(entry, index, nameGroups, seenStations) {
  const where = `[${index}] ${entry?.station ?? '(駅名なし)'}`;
  if (typeof entry?.station !== 'string' || entry.station === '') {
    addError(where, 'station が空です');
    return 0;
  }
  if (entry.station.endsWith('駅')) {
    addError(where, 'station に「駅」を付けないでください');
  }
  if (seenStations.has(entry.station) && !entry.stationHint) {
    addWarning(where, '同じ駅が複数回出ています（同名駅なら stationHint を付けてください）');
  }
  seenStations.add(entry.station);

  const candidates = findCandidates(entry, nameGroups);
  if (candidates.length === 0) {
    addError(where, '駅マスタに存在しない駅名です');
  } else if (candidates.length > 1 && !entry.stationHint) {
    addWarning(where, `同名駅が${candidates.length}件あります（stationHint で路線を指定してください）`);
  }

  if (!Array.isArray(entry.meetingPoints)) {
    addError(where, 'meetingPoints が配列ではありません');
    return 0;
  }
  if (entry.meetingPoints.length > MAX_POINTS_PER_STATION) {
    addWarning(where, `スポットが${MAX_POINTS_PER_STATION}件を超えています`);
  }

  const seenNames = new Set();
  entry.meetingPoints.forEach((point, i) => {
    const pointWhere = `${where} #${i + 1} ${point?.name ?? ''}`.trim();
    if (point === null || typeof point !== 'object') {
      addError(pointWhere, 'オブジェクトではありません');
      return;
    }
    if (seenNames.has(point.name)) addError(pointWhere, '同じ駅内で名前が重複しています');
    seenNames.add(point.name);
    validatePoint(point, pointWhere, candidates);
  });
  return entry.meetingPoints.length;
}

function main() {
  const data = readInput(process.argv[2]);
  if (!Array.isArray(data)) {
    console.error('トップレベルが配列ではありません');
    process.exit(1);
  }

  const nameGroups = groupByName(loadStationMaster());
  const seenStations = new Set();
  let pointCount = 0;
  data.forEach((entry, index) => {
    pointCount += validateEntry(entry, index, nameGroups, seenStations);
  });

  warnings.forEach((w) => console.log(`警告  ${w}`));
  errors.forEach((e) => console.log(`エラー ${e}`));
  console.log(
    `\n${data.length}駅・${pointCount}スポットを検証: エラー ${errors.length}件, 警告 ${warnings.length}件`
  );
  process.exit(errors.length > 0 ? 1 : 0);
}

main();
