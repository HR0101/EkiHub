/**
 * 自APIを叩く薄いラッパー。
 * サーバーが返す ApiError を拾って、そのままの文言で例外にする
 * （利用者へ見せるメッセージはサーバー側で決めている）。
 */

import type {
  ApiError,
  CenterRequest,
  CenterResult,
  Spot,
  SpotCategory,
  Station,
  TrainInformation,
} from "@/types/ekihub";

/** API がメッセージ付きで失敗したことを表す */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  /** 未登録だった駅名（/api/center のみ） */
  readonly unknown: string[] | undefined;

  constructor(message: string, status: number, detail?: ApiError) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = detail?.code;
    this.unknown = detail?.unknown;
  }
}

/** レスポンスを JSON として読み、失敗時は ApiRequestError にして投げる */
async function parseResponse<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = (payload ?? {}) as ApiError;
    throw new ApiRequestError(
      detail.error ?? "通信に失敗しました。時間をおいて再度お試しください。",
      response.status,
      detail
    );
  }

  return payload as T;
}

/** 駅マスタを取得する */
export async function fetchStations(signal?: AbortSignal): Promise<Station[]> {
  const response = await fetch("/api/stations", { signal });
  const data = await parseResponse<{ count: number; stations: Station[] }>(
    response
  );
  return data.stations;
}

/** 中心駅を算出する */
export async function fetchCenterStation(
  request: CenterRequest,
  signal?: AbortSignal
): Promise<CenterResult> {
  const response = await fetch("/api/center", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  return parseResponse<CenterResult>(response);
}

/** 集合駅の周辺スポットを取得する */
export async function fetchSpots(
  params: { lat: number; lng: number; category: SpotCategory; radius: number },
  signal?: AbortSignal
): Promise<Spot[]> {
  const query = new URLSearchParams({
    lat: String(params.lat),
    lng: String(params.lng),
    category: params.category,
    radius: String(params.radius),
  });
  const response = await fetch(`/api/spots?${query.toString()}`, { signal });
  const data = await parseResponse<{ spots: Spot[] }>(response);
  return data.spots;
}

/** 最新の運行情報を取得する */
export async function fetchTrainInformation(
  signal?: AbortSignal
): Promise<TrainInformation> {
  const response = await fetch("/api/train-information", { signal });
  return parseResponse<TrainInformation>(response);
}
