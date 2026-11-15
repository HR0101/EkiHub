import { workspaceRepository } from "@/server/workspaceRepository";
import { memberRepository } from "@/server/memberRepository";
import { memberError, memberJson, requireMember } from "@/server/memberApi";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<Response> {
  try {
    const owner = await requireMember(request);
    return memberJson(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        groups: memberRepository().list(owner),
        history: workspaceRepository().history(owner),
      },
      {
        headers: {
          "Content-Disposition": 'attachment; filename="ekihub-groups.json"',
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error) {
    return memberError(error);
  }
}
