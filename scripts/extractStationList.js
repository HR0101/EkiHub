// AIに待ち合わせスポットを調査させるための駅リストを抽出する
// 使用法: node scripts/extractStationList.js [--top 100] [--skip 0] [--region kanto|all] [--out ファイル]
//   --top    乗降客数の多い順に何駅出すか（既定 100）
//   --skip   先頭から何駅を飛ばすか（バッチ分割用. 既定 0）
//   --region kanto で関東圏のみ（既定 all）
//   --out    指定するとファイルへ保存（未指定は標準出力）
// 同名駅がある場合は「大町（JR大糸線）」のように路線を付けて区別する.

import { writeFileSync } from 'fs';
import { loadStationMaster, groupByName } from './loadStationMaster.js';

const DEFAULT_TOP = 100;
// 関東圏の判定に使う範囲（getMajorThreshold の関東判定に合わせる）
const KANTO_MAX_LAT = 37.5;
const KANTO_MIN_LNG = 138.5;
const KANTO_MAX_LNG = 141.0;

// コマンドライン引数を読み取る
function parseArgs(argv) {
  const args = { top: DEFAULT_TOP, skip: 0, region: 'all', out: null };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (value === undefined) {
      throw new Error(`${key} の値が指定されていません`);
    }
    if (key === '--top') args.top = Number(value);
    else if (key === '--skip') args.skip = Number(value);
    else if (key === '--region') args.region = value;
    else if (key === '--out') args.out = value;
    else throw new Error(`未対応の引数です: ${key}`);
  }
  if (!Number.isInteger(args.top) || args.top < 1) {
    throw new Error('--top は1以上の整数で指定してください');
  }
  if (!Number.isInteger(args.skip) || args.skip < 0) {
    throw new Error('--skip は0以上の整数で指定してください');
  }
  if (!['kanto', 'all'].includes(args.region)) {
    throw new Error('--region は kanto か all を指定してください');
  }
  return args;
}

// 関東圏の駅か
function isKanto(station) {
  return (
    station.lat < KANTO_MAX_LAT &&
    station.lng >= KANTO_MIN_LNG &&
    station.lng < KANTO_MAX_LNG
  );
}

// 出力用の表記を作る（同名駅は路線で区別）
function formatLabel(station, nameGroups) {
  const sameName = nameGroups.get(station.name) ?? [];
  if (sameName.length <= 1) return station.name;
  const line = station.lines?.[0] ?? '路線不明';
  return `${station.name}（${line}）`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const master = loadStationMaster();
  const nameGroups = groupByName(master);

  const picked = master
    .filter((s) => args.region === 'all' || isKanto(s))
    .filter((s) => s.ridership > 0)
    .sort((a, b) => b.ridership - a.ridership)
    .slice(args.skip, args.skip + args.top);

  const text = picked.map((s) => formatLabel(s, nameGroups)).join('\n') + '\n';

  if (args.out) {
    writeFileSync(args.out, text, 'utf-8');
    console.error(`${picked.length}駅を ${args.out} に保存しました`);
  } else {
    process.stdout.write(text);
  }
}

try {
  main();
} catch (error) {
  console.error(`エラー: ${error.message}`);
  process.exit(1);
}
