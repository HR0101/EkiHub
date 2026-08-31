import { describe, expect, it } from "vitest";

import { buildShareQuery, parseShareParams } from "@/lib/shareUrl";

describe("buildShareQuery", () => {
  it("駅・人数・条件をクエリにする", () => {
    const query = buildShareQuery({
      origins: [
        { name: "新宿", people: 2 },
        { name: "横浜", people: 1 },
      ],
      mode: "A",
      fairnessWeight: 0.6,
      fareWeight: 0,
    });
    const params = new URLSearchParams(query);
    expect(params.get("o")).toBe("新宿,横浜");
    expect(params.get("people")).toBe("2,1");
    expect(params.get("mode")).toBe("A");
    expect(params.get("w")).toBe("60");
    expect(params.get("fw")).toBe("0");
  });

  it("重みは0〜100に丸める", () => {
    const query = buildShareQuery({
      origins: [{ name: "新宿", people: 1 }],
      mode: "B",
      fairnessWeight: 1.4,
      fareWeight: -0.2,
    });
    const params = new URLSearchParams(query);
    expect(params.get("w")).toBe("100");
    expect(params.get("fw")).toBe("0");
  });
});

describe("parseShareParams", () => {
  it("組み立てたクエリを元に戻せる", () => {
    const input = {
      origins: [
        { name: "新宿", people: 2 },
        { name: "横浜", people: 1 },
      ],
      mode: "A" as const,
      fairnessWeight: 0.6,
      fareWeight: 0.3,
    };
    const parsed = parseShareParams("?" + buildShareQuery(input));
    expect(parsed).not.toBeNull();
    expect(parsed?.origins).toEqual(input.origins);
    expect(parsed?.mode).toBe("A");
    expect(parsed?.fairnessWeight).toBeCloseTo(0.6);
    expect(parsed?.fareWeight).toBeCloseTo(0.3);
  });

  it("駅が2つ未満なら復元しない", () => {
    expect(parseShareParams("?o=新宿")).toBeNull();
    expect(parseShareParams("")).toBeNull();
  });

  it("人数が欠けていれば1人として扱う", () => {
    const parsed = parseShareParams("?o=新宿,横浜");
    expect(parsed?.origins.map((o) => o.people)).toEqual([1, 1]);
  });

  it("不正なモードや重みは指定なしとして返す", () => {
    const parsed = parseShareParams("?o=新宿,横浜&mode=X&w=abc");
    expect(parsed?.mode).toBeNull();
    expect(parsed?.fairnessWeight).toBeNull();
  });
});
