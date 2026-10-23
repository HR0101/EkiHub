import { workspaceRepository } from "@/server/workspaceRepository";
import {
  memberError,
  memberJson,
  requireMember,
  MemberApiError,
} from "@/server/memberApi";
import { body, text, station } from "@/server/workspaceValidation";
import { parseGroupInput } from "@/lib/memberGroups";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await requireMember(request);
    return memberJson({ entries: workspaceRepository().history(user) });
  } catch (e) {
    return memberError(e);
  }
}
export async function PUT(request: Request) {
  try {
    const user = await requireMember(request, true);
    const data = await body(request);
    let conditions;
    try {
      conditions = parseGroupInput({
        ...data,
        name: "履歴",
        fairnessWeight: data.fairnessWeight ?? 0.6,
        fareWeight: data.fareWeight ?? 0,
      });
    } catch {
      throw new MemberApiError("検索履歴の内容を確認してください。", 400);
    }
    await Promise.all(conditions.origins.map((o) => station(o.name)));
    const entry = {
      id: text(data.id, 2000, true),
      origins: conditions.origins,
      mode: conditions.mode,
      fairnessWeight: conditions.fairnessWeight,
      fareWeight: conditions.fareWeight,
      bestName: await station(data.bestName),
      savedAt: new Date().toISOString(),
      isFavorite: data.isFavorite === true,
    };
    workspaceRepository().putHistory(user, entry);
    return memberJson({ entry });
  } catch (e) {
    return memberError(e);
  }
}
export async function DELETE(request: Request) {
  try {
    const user = await requireMember(request, true);
    const data = await body(request);
    workspaceRepository().deleteHistory(user, text(data.id, 2000, true));
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return memberError(e);
  }
}
