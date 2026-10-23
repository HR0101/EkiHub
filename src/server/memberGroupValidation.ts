import { parseGroupInput } from "@/lib/memberGroups";
import { MemberApiError } from "@/server/memberApi";
import { loadStationIndex } from "@/server/stationRepository";

export async function validatedGroup(request: Request) {
  let input;
  try {
    input = parseGroupInput(await request.json());
  } catch (error) {
    throw new MemberApiError(
      error instanceof Error ? error.message : "入力内容を確認してください。",
      400,
    );
  }
  const stations = await loadStationIndex();
  if (input.origins.some((origin) => !stations.has(origin.name)))
    throw new MemberApiError("登録されている駅を選択してください。", 400);
  return input;
}
