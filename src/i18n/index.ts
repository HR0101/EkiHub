/**
 * 多言語の入口。
 *
 * 画面の文言はコンポーネントに直接書かず、messages/ 以下の辞書へ集約し、
 * キーで引く（t("form.submit") のように）。
 * 日本語（ja.ts）がマスターで、他の言語は同じ型に従うため、
 * キーを足したときの翻訳漏れはコンパイルエラーになる。
 *
 * 言語を増やす手順:
 *   1. messages/<code>.ts を作り、Messages 型で辞書を書く
 *   2. LOCALES と MESSAGES へ追加する
 */

import { en } from "./messages/en";
import { ja, type Messages } from "./messages/ja";
import { ko } from "./messages/ko";
import { zh } from "./messages/zh";

export type { Messages };

export const LOCALES = ["ja", "en", "zh", "ko"] as const;
export type Locale = (typeof LOCALES)[number];

/** 言語切替に出す表示名（その言語自身の表記） */
export const LOCALE_LABELS: Record<Locale, string> = {
  ja: "日本語",
  en: "English",
  zh: "中文",
  ko: "한국어",
};

export const MESSAGES: Record<Locale, Messages> = { ja, en, zh, ko };

export const DEFAULT_LOCALE: Locale = "ja";

export const LOCALE_STORAGE_KEY = "ekihub-locale";

/**
 * 辞書のキーをドット区切りで表した文字列。
 * "form.submit" は書けるが "form.nope" は型エラーになる。
 */
type Leaves<T> = T extends string
  ? []
  : {
      [K in Extract<keyof T, string>]: [K, ...Leaves<T[K]>];
    }[Extract<keyof T, string>];

type Join<T extends string[]> = T extends [infer F extends string]
  ? F
  : T extends [infer F extends string, ...infer R extends string[]]
    ? `${F}.${Join<R>}`
    : never;

export type MessageKey = Join<Leaves<Messages>>;

/** 差し込む値（{name} などのプレースホルダ） */
export type MessageValues = Record<string, string | number>;

/** ドット区切りのキーで辞書を引く */
function lookup(messages: Messages, key: string): string | undefined {
  let current: unknown = messages;
  for (const part of key.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

/**
 * 文言を取り出し、{name} を values で置き換える。
 * 訳が欠けている言語では日本語へ、それも無ければキー自身を返す
 * （画面が空になるより、どのキーが足りないか見えるほうがよい）。
 */
export function translate(
  locale: Locale,
  key: MessageKey,
  values?: MessageValues
): string {
  const template = lookup(MESSAGES[locale], key) ?? lookup(ja, key) ?? key;
  if (!values) return template;

  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}

/** localStorage から言語を読む（未保存・使用不可なら既定） */
export function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return LOCALES.includes(stored as Locale)
      ? (stored as Locale)
      : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** 言語を保存する（失敗しても表示は続く） */
export function storeLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // プライベートモード等では保存できないが、画面は動く
  }
}
