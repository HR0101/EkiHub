import { loadStations } from "@/server/stationRepository";
import type { ApiError, Station } from "@/types/ekihub";

// 駅マスタは ODPT トークンの有無で内容が変わるため、実行時に評価する
export const dynamic = "force-dynamic";

/** 駅一覧API: 入力補完と候補表示に使う */
export async function GET(): Promise<Response> {
  try {
    const stations = await loadStations();
    // 入力補完に必要な最小限のフィールドだけ返す
    const slim: Station[] = stations.map(
      ({ name, kana, lat, lng, lines, isMajor }) => ({
        name,
        kana,
        lat,
        lng,
        lines,
        isMajor,
      })
    );
    return Response.json({ count: slim.length, stations: slim });
  } catch (error) {
    // 内部例外の詳細はログにだけ残し、利用者には一般化したメッセージを返す
    console.error("駅一覧の取得に失敗:", error);
    return Response.json(
      {
        error: "駅データの取得に失敗しました。時間をおいて再度お試しください。",
      } satisfies ApiError,
      { status: 500 }
    );
  }
}
