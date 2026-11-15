import { auth, isAuthConfigured } from "@/auth";
export const dynamic = "force-dynamic";
export async function GET(): Promise<Response> {
  const enabled = isAuthConfigured();
  const session = enabled ? await auth() : null;
  return Response.json(
    {
      enabled,
      user: session?.user?.id
        ? { id: session.user.id, name: session.user.name ?? null }
        : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
