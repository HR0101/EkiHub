import type { Mode } from "@/types/ekihub";

export interface GroupConditions {
  origins: { name: string; people: number }[];
  mode: Mode;
  fairnessWeight: number;
  fareWeight: number;
}
export interface MemberGroup extends GroupConditions {
  id: string;
  name: string;
  updatedAt: string;
}
export interface MemberAccount {
  enabled: boolean;
  user: { id: string; name: string | null } | null;
}

/** Strict validation shared by the editor and authenticated API. */
export function parseGroupInput(
  value: unknown,
): { name: string } & GroupConditions {
  if (!value || typeof value !== "object")
    throw new Error("グループの内容を確認してください。");
  const input = value as Record<string, unknown>;
  if (
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.trim().length > 60
  )
    throw new Error("グループ名は1〜60文字で入力してください。");
  if (
    !Array.isArray(input.origins) ||
    input.origins.length < 2 ||
    input.origins.length > 20
  )
    throw new Error("出発駅は2〜20件で登録してください。");
  const origins = input.origins.map((item: unknown) => {
    if (!item || typeof item !== "object")
      throw new Error("出発駅を確認してください。");
    const row = item as Record<string, unknown>;
    if (
      typeof row.name !== "string" ||
      !row.name.trim() ||
      row.name.trim().length > 120 ||
      typeof row.people !== "number" ||
      !Number.isInteger(row.people) ||
      row.people < 1 ||
      row.people > 10
    )
      throw new Error("出発駅と人数（1〜10人）を確認してください。");
    return { name: row.name.trim(), people: row.people };
  });
  const validWeight = (n: unknown): n is number =>
    typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
  if (
    (input.mode !== "A" && input.mode !== "B") ||
    !validWeight(input.fairnessWeight) ||
    !validWeight(input.fareWeight)
  )
    throw new Error("検索条件を確認してください。");
  return {
    name: input.name.trim(),
    origins,
    mode: input.mode,
    fairnessWeight: input.fairnessWeight,
    fareWeight: input.fareWeight,
  };
}
