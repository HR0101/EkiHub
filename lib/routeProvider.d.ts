/**
 * 経路検索APIの共通インターフェース。
 * 取得できなかった項目は null を返す（呼び出し側が距離概算で補う）。
 */
export interface RouteResult {
  minutes: number | null;
  fareYen: number | null;
  transfers: number | null;
}

export interface RouteQuery {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  /** 出発時刻。未指定なら現在時刻 */
  departAt?: Date;
}

export interface RouteProvider {
  route(query: RouteQuery): Promise<RouteResult>;
}

/**
 * 環境変数（ROUTING_PROVIDER など）からプロバイダを作る。
 * 未設定なら null を返し、呼び出し側は距離概算へフォールバックする。
 */
export function makeProviderFromEnv(): RouteProvider | null;
