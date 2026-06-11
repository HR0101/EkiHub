// OSMデータのkana未登録駅に対してkuromijiで読みを自動生成するスクリプト
// 使用法: node scripts/generateKana.js

import kuromoji from 'kuromoji';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const osmPath = join(__dirname, '../data/stations-osm.json');

const osm = JSON.parse(readFileSync(osmPath, 'utf-8'));

// カタカナ→ひらがな変換
const katakanaToHiragana = (str) =>
  str.replace(/[ァ-ヶ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );

kuromoji
  .builder({ dicPath: join(__dirname, '../node_modules/kuromoji/dict') })
  .build((err, tokenizer) => {
    if (err) {
      console.error('kuromijiビルドに失敗:', err);
      process.exit(1);
    }

    let count = 0;
    for (const station of osm) {
      if (!station.name) continue;
      if (station.kana && station.kana !== '') continue; // すでにkanaがある駅はスキップ

      const tokens = tokenizer.tokenize(station.name);
      const reading = tokens
        .map((t) => {
          // readingがあればそれを使い、なければsurface_form（カタカナ等をそのまま）
          const r = t.reading || t.surface_form;
          return katakanaToHiragana(r);
        })
        .join('');

      station.kana = reading;
      count++;
    }

    writeFileSync(osmPath, JSON.stringify(osm, null, 2), 'utf-8');
    console.log(`完了: ${count}件のkanaを生成しました`);
  });
