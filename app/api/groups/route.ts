import { memberRepository } from "@/server/memberRepository";
import { memberError, memberJson, requireMember } from "@/server/memberApi";
import { validatedGroup } from "@/server/memberGroupValidation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<Response> {
  try {
    const owner = await requireMember(request);
    return memberJson(
      { groups: memberRepository().list(owner) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return memberError(error);
  }
}
export async function POST(request: Request): Promise<Response> {
  try {
    const owner = await requireMember(request, true);
    const input = await validatedGroup(request);
    const repository = memberRepository();
    return memberJson(
      { group: repository.create(owner, input) },
      { status: 201 },
    );
  } catch (error) {
    return memberError(error);
  }
}
