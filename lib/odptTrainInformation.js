const ODPT_API_BASE = "https://api.odpt.org/api/v4";
const DEFAULT_REFRESH_SECONDS = 60;
const MIN_REFRESH_SECONDS = 15;
const MAX_REFRESH_SECONDS = 300;

function pickJapanese(value, fallback = "") {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return fallback;
  return String(value.ja || value.en || Object.values(value).find(Boolean) || fallback).trim();
}

function referenceTail(value) {
  if (typeof value !== "string") return "";
  const afterColon = value.includes(":") ? value.split(":").pop() : value;
  return afterColon.split(".").pop() || afterColon;
}

function safeDate(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function clampRefreshSeconds(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_REFRESH_SECONDS;
  return Math.min(MAX_REFRESH_SECONDS, Math.max(MIN_REFRESH_SECONDS, Math.round(seconds)));
}

function isNormalService(status, text) {
  const combined = `${status} ${text}`.toLowerCase();
  return [
    "平常",
    "通常",
    "正常",
    "normal",
    "on time",
    "on-time"
  ].some((word) => combined.includes(word));
}

export function buildRailwayTitleMap(rawRailways) {
  const titles = new Map();
  if (!Array.isArray(rawRailways)) return titles;

  rawRailways.forEach((item) => {
    const title = pickJapanese(item?.["odpt:railwayTitle"], item?.["dc:title"]);
    const keys = [item?.["@id"], item?.["owl:sameAs"]].filter(Boolean);
    keys.forEach((key) => {
      if (title) titles.set(String(key), title);
    });
  });
  return titles;
}

export function normalizeTrainInformation(rawItems, railwayTitles = new Map(), now = new Date()) {
  if (!Array.isArray(rawItems)) return [];
  const nowMs = now.getTime();

  return rawItems
    .map((item) => {
      const validUntil = safeDate(item?.["dct:valid"]);
      if (validUntil && Date.parse(validUntil) < nowMs) return null;

      const railwayRef = String(item?.["odpt:railway"] || "");
      const status = pickJapanese(item?.["odpt:trainInformationStatus"]);
      const text = pickJapanese(item?.["odpt:trainInformationText"]);
      const railway =
        railwayTitles.get(railwayRef) ||
        pickJapanese(item?.["odpt:railwayTitle"]) ||
        referenceTail(railwayRef) ||
        "路線名未提供";
      const updatedAt = safeDate(item?.["dc:date"] || item?.["odpt:timeOfOrigin"]);
      const refreshAfterSeconds = clampRefreshSeconds(item?.["odpt:frequency"]);

      return {
        id: String(item?.["@id"] || `${railwayRef}:${updatedAt || text}`),
        railway,
        railwayRef,
        status: status || (isNormalService("", text) ? "平常運転" : "運行情報あり"),
        text: text || status || "運行情報の本文は提供されていません。",
        updatedAt,
        validUntil,
        refreshAfterSeconds,
        isNormal: isNormalService(status, text)
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.isNormal !== b.isNormal) return a.isNormal ? 1 : -1;
      return a.railway.localeCompare(b.railway, "ja");
    });
}

function buildOdptUrl(resource, token) {
  const url = new URL(`${ODPT_API_BASE}/${resource}`);
  url.searchParams.set("acl:consumerKey", token);
  return url;
}

async function fetchJson(url, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`ODPT応答エラー: ${response.status}`);
    }
    const json = await response.json();
    if (!Array.isArray(json)) {
      throw new Error("ODPT応答の形式が不正です");
    }
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

export function createOdptTrainInformationClient({
  token,
  fetchImpl = globalThis.fetch,
  timeoutMs = 8000,
  now = () => new Date()
}) {
  let railwayTitleCache = null;
  let railwayTitleExpiresAt = 0;
  let informationCache = null;
  let informationExpiresAt = 0;

  async function getRailwayTitles() {
    const currentMs = now().getTime();
    if (railwayTitleCache && currentMs < railwayTitleExpiresAt) return railwayTitleCache;

    const rawRailways = await fetchJson(
      buildOdptUrl("odpt:Railway", token),
      fetchImpl,
      timeoutMs
    );
    railwayTitleCache = buildRailwayTitleMap(rawRailways);
    railwayTitleExpiresAt = currentMs + 24 * 60 * 60 * 1000;
    return railwayTitleCache;
  }

  async function getTrainInformation() {
    if (!token) {
      const error = new Error("ODPTアクセストークンが設定されていません");
      error.code = "ODPT_NOT_CONFIGURED";
      throw error;
    }
    if (typeof fetchImpl !== "function") {
      throw new Error("fetch APIを利用できません");
    }

    const current = now();
    if (informationCache && current.getTime() < informationExpiresAt) {
      return informationCache;
    }

    const [rawInformation, railwayTitles] = await Promise.all([
      fetchJson(buildOdptUrl("odpt:TrainInformation", token), fetchImpl, timeoutMs),
      getRailwayTitles().catch((error) => {
        console.warn("ODPT路線名の取得に失敗したため識別子で表示します:", error.message);
        return new Map();
      })
    ]);
    const items = normalizeTrainInformation(rawInformation, railwayTitles, current);
    const refreshAfterSeconds =
      items.length > 0
        ? Math.min(...items.map((item) => item.refreshAfterSeconds))
        : DEFAULT_REFRESH_SECONDS;
    const updatedAt = items
      .map((item) => item.updatedAt)
      .filter(Boolean)
      .sort()
      .pop() || current.toISOString();

    informationCache = {
      items,
      updatedAt,
      refreshAfterSeconds,
      fetchedAt: current.toISOString()
    };
    informationExpiresAt = current.getTime() + refreshAfterSeconds * 1000;
    return informationCache;
  }

  return { getTrainInformation };
}
