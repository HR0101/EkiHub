import { createOdptTrainInformationClient } from "../../../lib/odptTrainInformation.js";
import type { ApiError } from "@/types/ekihub";

export const dynamic = "force-dynamic";

/** アクセストークンはサーバー内だけで使い、フロントへは返さない */
const client = createOdptTrainInformationClient({
  token: process.env.ODPT_TOKEN ?? null,
});

/** ODPT のエラーは code を持つ。未設定と取得失敗を区別するために使う */
function errorCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String((error as { code: unknown }).code);
  }
  return null;
}

/** 最新の鉄道運行情報を返す */
export async function GET(): Promise<Response> {
  try {
    const data = await client.getTrainInformation();
    return Response.json(data, {
      headers: {
        "Cache-Control": `public, max-age=${data.refreshAfterSeconds}, stale-while-revalidate=30`,
      },
    });
  } catch (error) {
    const noStore = { "Cache-Control": "no-store" };

    if (errorCode(error) === "ODPT_NOT_CONFIGURED") {
      return Response.json(
        {
          code: "ODPT_NOT_CONFIGURED",
          error: "運行情報は現在準備中です。",
        } satisfies ApiError,
        { status: 503, headers: noStore }
      );
    }

    console.error("ODPT運行情報の取得に失敗:", error);
    return Response.json(
      {
        code: "ODPT_UNAVAILABLE",
        error: "運行情報を取得できませんでした。時間をおいて更新してください。",
      } satisfies ApiError,
      { status: 502, headers: noStore }
    );
  }
}
