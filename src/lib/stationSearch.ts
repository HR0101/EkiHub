/**
 * 駅名のあいまい検索。
 *
 * 「しんじゅく」「shinjuku」「新宿」のどれで打っても同じ駅に当たるよう、
 * クエリと駅データの両方をひらがなへ寄せてから突き合わせる。
 * 表記揺れ（づ↔ず、ぢ↔じ）も同じ側で吸収する。
 */

import type { Station } from "@/types/ekihub";

/** ローマ字→ひらがな。3文字の拗音から順に長い方を優先して当てる */
const ROMAJI_TO_HIRAGANA: Record<string, string> = {
  a: "あ", i: "い", u: "う", e: "え", o: "お",
  ka: "か", ki: "き", ku: "く", ke: "け", ko: "こ",
  sa: "さ", shi: "し", si: "し", su: "す", se: "せ", so: "そ",
  ta: "た", chi: "ち", ti: "ち", tsu: "つ", tu: "つ", te: "て", to: "と",
  na: "な", ni: "に", nu: "ぬ", ne: "ね", no: "の",
  ha: "は", hi: "ひ", fu: "ふ", hu: "ふ", he: "へ", ho: "ほ",
  ma: "ま", mi: "み", mu: "む", me: "め", mo: "も",
  ya: "や", yu: "ゆ", yo: "よ",
  ra: "ら", ri: "り", ru: "る", re: "れ", ro: "ろ",
  wa: "わ", wo: "を", n: "ん",
  ga: "が", gi: "ぎ", gu: "ぐ", ge: "げ", go: "ご",
  za: "ざ", ji: "じ", zi: "じ", zu: "ず", ze: "ぜ", zo: "ぞ",
  da: "だ", de: "で", do: "ど",
  ba: "ば", bi: "び", bu: "ぶ", be: "べ", bo: "ぼ",
  pa: "ぱ", pi: "ぴ", pu: "ぷ", pe: "ぺ", po: "ぽ",
  kya: "きゃ", kyu: "きゅ", kyo: "きょ",
  sha: "しゃ", shu: "しゅ", sho: "しょ",
  cha: "ちゃ", chu: "ちゅ", cho: "ちょ",
  tya: "ちゃ", tyu: "ちゅ", tyo: "ちょ",
  nya: "にゃ", nyu: "にゅ", nyo: "にょ",
  hya: "ひゃ", hyu: "ひゅ", hyo: "ひょ",
  mya: "みゃ", myu: "みゅ", myo: "みょ",
  rya: "りゃ", ryu: "りゅ", ryo: "りょ",
  gya: "ぎゃ", gyu: "ぎゅ", gyo: "ぎょ",
  ja: "じゃ", ju: "じゅ", jo: "じょ",
  bya: "びゃ", byu: "びゅ", byo: "びょ",
  pya: "ぴゃ", pyu: "ぴゅ", pyo: "ぴょ",
};

/** ローマ字の最長マッチ長（拗音の3文字） */
const MAX_ROMAJI_CHUNK = 3;

/** 検索結果として返す最大件数 */
export const SUGGEST_LIMIT = 8;

/** カタカナをひらがなへ寄せる */
function katakanaToHiragana(value: string): string {
  return value.replace(/[ァ-ヶ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

/** 表記揺れを統一する（クエリ・データの両方に適用して相互に引けるようにする） */
function normalizeKana(value: string): string {
  return value.replace(/づ/g, "ず").replace(/ぢ/g, "じ");
}

/** ローマ字をひらがなへ変換する（変換できない文字はそのまま残す） */
export function romajiToHiragana(value: string): string {
  const source = value.toLowerCase();
  let result = "";
  let i = 0;

  while (i < source.length) {
    const current = source[i] ?? "";
    const next = source[i + 1];

    // 重子音（tt / kk など）は促音「っ」に変換する
    if (
      next !== undefined &&
      current !== "n" &&
      current === next &&
      /[bcdfghjklmnpqrstvwxyz]/.test(current)
    ) {
      result += "っ";
      i += 1;
      continue;
    }

    let matched = false;
    for (
      let len = Math.min(MAX_ROMAJI_CHUNK, source.length - i);
      len >= 1;
      len--
    ) {
      const chunk = source.slice(i, i + len);
      const hiragana = ROMAJI_TO_HIRAGANA[chunk];
      if (hiragana) {
        result += hiragana;
        i += len;
        matched = true;
        break;
      }
    }

    if (!matched) {
      result += current;
      i += 1;
    }
  }

  return result;
}

/** 駅名・かな・ローマ字の一致度を点数にする（完全 > 前方 > 部分） */
export function scoreStation(station: Station, query: string): number {
  const kana = normalizeKana(katakanaToHiragana(station.kana.toLowerCase()));
  const lowerQuery = query.toLowerCase();
  const kanaQuery = normalizeKana(katakanaToHiragana(lowerQuery));
  const romajiQuery = normalizeKana(romajiToHiragana(lowerQuery));

  let score = 0;

  // 駅名そのもの
  if (station.name === query) score += 1000;
  else if (station.name.startsWith(query)) score += 500;
  else if (station.name.includes(query)) score += 200;

  // 読みがな
  if (kana === kanaQuery) score += 900;
  else if (kana.startsWith(kanaQuery)) score += 400;
  else if (kana.includes(kanaQuery)) score += 150;

  // ローマ字入力（実際に変換が起きた時だけ見る）
  if (romajiQuery !== lowerQuery) {
    if (kana === romajiQuery) score += 850;
    else if (kana.startsWith(romajiQuery)) score += 350;
    else if (kana.includes(romajiQuery)) score += 120;
  }

  if (score === 0) return 0;

  // 同点のときは規模の大きい駅を上に出す
  if (station.ridership) {
    score += Math.min(Math.floor(Math.log10(station.ridership) * 8), 80);
  }
  if (station.isMajor) score += 20;

  return score;
}

/** クエリに合う駅をスコア順で返す */
export function searchStations(
  stations: readonly Station[],
  query: string,
  limit: number = SUGGEST_LIMIT
): Station[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const scored: { station: Station; score: number }[] = [];
  for (const station of stations) {
    const score = scoreStation(station, trimmed);
    if (score > 0) scored.push({ station, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((entry) => entry.station);
}

/**
 * 駅名をクエリに一致する部分で3つに割る。
 * 呼び出し側が真ん中だけ <mark> で囲めるようにするためで、
 * ここで HTML を組み立てない（React に任せる）。
 */
export function splitByMatch(
  name: string,
  query: string
): { before: string; match: string; after: string } {
  const index = query ? name.indexOf(query) : -1;
  if (index === -1) return { before: name, match: "", after: "" };
  return {
    before: name.slice(0, index),
    match: query,
    after: name.slice(index + query.length),
  };
}
