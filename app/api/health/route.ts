import { makeProviderFromEnv } from "../../../lib/routeProvider.js";

export const dynamic = "force-dynamic";

const routingEnabled = Boolean(makeProviderFromEnv());

/** ヘルスチェック（有効な機能の一覧つき） */
export function GET(): Response {
  return Response.json({
    status: "ok",
    odptEnabled: Boolean(process.env.ODPT_TOKEN?.trim()),
    routingEnabled,
    routingProvider: routingEnabled
      ? (process.env.ROUTING_PROVIDER ?? "custom")
      : null,
    features: [
      "center",
      "fare",
      "people-weight",
      "spots",
      "routing",
      "train-information",
    ],
  });
}
