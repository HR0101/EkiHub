import { CATEGORY_LABELS } from "../../../lib/poiService.js";

/** 周辺スポットのカテゴリ一覧（固定値なのでビルド時に確定してよい） */
export function GET(): Response {
  return Response.json({ categories: CATEGORY_LABELS });
}
