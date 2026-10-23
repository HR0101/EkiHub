import { memberRepository } from "@/server/memberRepository";
import { workspaceRepository } from "@/server/workspaceRepository";
import {
  memberError,
  memberJson,
  requireMember,
  MemberApiError,
} from "@/server/memberApi";
import { body, text } from "@/server/workspaceValidation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await requireMember(request);
    return memberJson({ workspaces: workspaceRepository().list(user) });
  } catch (e) {
    return memberError(e);
  }
}
export async function POST(request: Request) {
  try {
    const user = await requireMember(request, true);
    const input = await body(request);
    const group = memberRepository()
      .list(user)
      .find((g) => g.id === text(input.groupId, 100, true));
    if (!group) throw new MemberApiError("保存グループが見つかりません。", 404);
    const { id, name, updatedAt: _time, ...conditions } = group;
    return memberJson(
      { workspace: workspaceRepository().create(user, name, id, conditions) },
      { status: 201 },
    );
  } catch (e) {
    return memberError(e);
  }
}
