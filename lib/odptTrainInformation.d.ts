import type { TrainInformation } from "../src/types/ekihub";

export interface OdptClientOptions {
  /** ODPT のアクセストークン。null なら未設定として扱う */
  token?: string | null;
  /** テスト用に fetch を差し替える */
  fetchImpl?: typeof fetch;
  /** 取得のタイムアウト（ミリ秒） */
  timeoutMs?: number;
}

export interface OdptTrainInformationClient {
  /**
   * 最新の運行情報を返す（結果はキャッシュされる）。
   * トークン未設定なら code: "ODPT_NOT_CONFIGURED" のエラーを投げる。
   */
  getTrainInformation(): Promise<TrainInformation>;
}

export function createOdptTrainInformationClient(
  options?: OdptClientOptions
): OdptTrainInformationClient;
