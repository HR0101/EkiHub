import { describe, expect, it } from "vitest";

import { LOCALES, MESSAGES, translate } from "@/i18n";

/** ネストした辞書をドット区切りのキー一覧へ潰す */
function flattenKeys(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key)
  );
}

describe("辞書", () => {
  const japaneseKeys = flattenKeys(MESSAGES.ja).sort();

  it.each(LOCALES)("%s は日本語と同じキーを持つ", (locale) => {
    expect(flattenKeys(MESSAGES[locale]).sort()).toEqual(japaneseKeys);
  });

  /**
   * 見出しは「前・強調・後」の3つに割って組み立てているため、
   * 語順の違いでどちらかが空になるのは正しい
   * （中国語の「寻找大家的[中心车站]」には後ろに続く語がない）。
   */
  const ALLOW_EMPTY = new Set(["hero.titleBefore", "hero.titleAfter"]);

  it.each(LOCALES)("%s に空の文言がない", (locale) => {
    const empty = japaneseKeys
      .filter((key) => !ALLOW_EMPTY.has(key))
      .filter((key) => translate(locale, key as never).trim() === "");
    expect(empty).toEqual([]);
  });
});

describe("translate", () => {
  it("キーに対応する文言を返す", () => {
    expect(translate("ja", "form.submit")).toBe("中心駅を検索する");
    expect(translate("en", "form.submit")).toBe("Find the midpoint station");
  });

  it("プレースホルダを差し替える", () => {
    expect(translate("ja", "travel.minutes", { count: 39 })).toBe("39分");
    expect(translate("en", "travel.minutes", { count: 39 })).toBe("39 min");
  });

  it("値が渡されないプレースホルダはそのまま残す", () => {
    expect(translate("ja", "travel.minutes")).toBe("{count}分");
  });

  it("未知のキーはキー自身を返す（画面が空にならないように）", () => {
    expect(translate("ja", "form.nope" as never)).toBe("form.nope");
  });
});
