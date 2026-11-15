import { GroupLimitError } from "@/server/memberRepository";
import { auth, isAuthConfigured } from "@/auth";

export class MemberApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function requireMember(
  request: Request,
  mutate = false,
): Promise<string> {
  if (mutate) {
    const expectedOrigin = new URL(process.env.AUTH_URL || request.url).origin;
    if (request.headers.get("origin") !== expectedOrigin)
      throw new MemberApiError(
        "この操作はEkiHubの画面から行ってください。",
        403,
      );
  }
  if (!isAuthConfigured())
    throw new MemberApiError("会員ログインは準備中です。", 503);
  const session = await auth();
  if (!session?.user?.id)
    throw new MemberApiError("ログインしてください。", 401);
  const expectedAccount = request.headers.get("X-EkiHub-Account");
  if (expectedAccount && expectedAccount !== session.user.id)
    throw new MemberApiError(
      "ログイン中のアカウントが変わりました。画面を再読み込みしてください。",
      409,
    );
  return session.user.id;
}
export function memberJson(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(data, { ...init, headers });
}
export function memberError(error: unknown): Response {
  if (error instanceof GroupLimitError)
    return memberJson({ error: error.message }, { status: 409 });
  if (error instanceof MemberApiError)
    return memberJson({ error: error.message }, { status: error.status });
  console.error("会員データの処理に失敗:", error);
  return memberJson(
    { error: "保存データを処理できませんでした。時間をおいて試してください。" },
    { status: 500 },
  );
}
