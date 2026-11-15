import { workspaceRepository } from "@/server/workspaceRepository";
import { memberError, memberJson, requireMember } from "@/server/memberApi";
import { actionInput } from "@/server/workspaceValidation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ token: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const user = await requireMember(request);
    const { token } = await context.params;
    return memberJson(workspaceRepository().read(token, user));
  } catch (e) {
    return memberError(e);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const user = await requireMember(request, true);
    const { token } = await context.params;
    return memberJson(
      workspaceRepository().mutate(token, user, await actionInput(request)),
    );
  } catch (e) {
    return memberError(e);
  }
}
