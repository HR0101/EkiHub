import { memberRepository } from "@/server/memberRepository";
import {
  MemberApiError,
  memberError,
  memberJson,
  requireMember,
} from "@/server/memberApi";
import { validatedGroup } from "@/server/memberGroupValidation";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(
  request: Request,
  context: Context,
): Promise<Response> {
  try {
    const owner = await requireMember(request, true);
    const { id } = await context.params;
    const group = memberRepository().update(
      owner,
      id,
      await validatedGroup(request),
    );
    if (!group) throw new MemberApiError("グループが見つかりません。", 404);
    return memberJson({ group });
  } catch (error) {
    return memberError(error);
  }
}
export async function DELETE(
  request: Request,
  context: Context,
): Promise<Response> {
  try {
    const owner = await requireMember(request, true);
    const { id } = await context.params;
    if (!memberRepository().remove(owner, id))
      throw new MemberApiError("グループが見つかりません。", 404);
    return new Response(null, { status: 204 });
  } catch (error) {
    return memberError(error);
  }
}
