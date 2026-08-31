/**
 * 結果をテキストに起こす（チャットへ貼り付ける用）。
 * 形式は旧実装のまま：
 *   集合駅: 武蔵小杉(平均37分 / ¥320)
 *   ・新宿→ 39分 ¥320
 *   ・横浜→ 35分 ¥320 直通
 */

import type { RankingEntry } from "@/types/ekihub";

export function buildSummaryText(station: RankingEntry): string {
  const head: string[] = [];
  if (station.averageMinutes > 0) head.push(`平均${station.averageMinutes}分`);
  if (station.averageFareYen > 0) {
    head.push(`¥${station.averageFareYen.toLocaleString("ja-JP")}`);
  }
  const suffix = head.length > 0 ? `(${head.join(" / ")})` : "";

  const lines = [`集合駅: ${station.name}${suffix}`];

  for (const travel of station.travelTimes) {
    const parts: string[] = [];
    if (travel.minutes > 0) parts.push(`${travel.minutes}分`);
    if (travel.fareYen > 0) {
      parts.push(`¥${travel.fareYen.toLocaleString("ja-JP")}`);
    }
    if (travel.directPossible) parts.push("直通");
    lines.push(`・${travel.from}→${parts.length > 0 ? ` ${parts.join(" ")}` : ""}`);
  }

  return lines.join("\n");
}
