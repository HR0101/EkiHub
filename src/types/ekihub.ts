/**
 * EkiHub の API が受け渡す値の型。
 *
 * 算出ロジック本体（lib/*.js）はまだ JavaScript のままなので、
 * ここが「サーバーが実際に返す形」の唯一の宣言になる。
 * lib/ 側の戻り値を変えたときは必ずここも合わせること。
 */

/** 候補の絞り込みモード。A = 主要駅のみ / B = 全駅 */
export type Mode = "A" | "B";

/**
 * 所要時間をどう求めたか。
 *   graph    … 駅ネットワーク上の最短経路（既定）
 *   straight … 直線距離からの概算（グラフが使えないときのフォールバック）
 *   otp      … 経路APIで精緻化した実測値
 */
export type RoutingMethod = "graph" | "straight" | "otp";

/** 運行状態。alert（異常）→ normal → ended の順で並べる */
export type ServiceState = "alert" | "normal" | "ended";

/** 周辺スポットのカテゴリ（lib/poiService.js の CATEGORY_LABELS と対応） */
export type SpotCategory =
  | "cafe"
  | "restaurant"
  | "izakaya"
  | "fastfood"
  | "karaoke"
  | "convenience"
  | "park";

/** 駅マスタ。/api/stations が返す最小限のフィールド */
export interface Station {
  name: string;
  kana: string;
  lat: number;
  lng: number;
  lines: string[];
  isMajor: boolean;
  /** 1日あたり乗降客数。データがない駅では未定義 */
  ridership?: number;
}

/** 入力された最寄駅（人数の重み付き） */
export interface OriginStation {
  name: string;
  kana: string;
  lat: number;
  lng: number;
  /** この駅から来る人数。重心と平均の重みになる */
  people: number;
}

/** 候補駅への、ある入力駅からの移動 */
export interface TravelTime {
  /** 出発する最寄駅名 */
  from: string;
  minutes: number;
  fareYen: number;
  /** 経路APIを使っていない場合は null */
  transfers: number | null;
  people: number;
  directPossible: boolean;
  /** 経路APIで精緻化された値かどうか */
  routed: boolean;
}

/** 候補駅ランキングの1件 */
export interface RankingEntry {
  name: string;
  kana: string;
  lat: number;
  lng: number;
  lines: string[];
  ridership?: number;
  isMajor: boolean;
  averageMinutes: number;
  totalMinutes: number;
  minMinutes: number;
  maxMinutes: number;
  /** 所要時間のばらつき（標準偏差・分）。小さいほど全員が均等 */
  fairness: number;
  averageFareYen: number;
  totalFareYen: number;
  averageTransfers: number | null;
  directCount: number;
  routed: boolean;
  distanceToCentroidKm: number;
  /** 公平性・近さ・運賃を加重合算した総合スコア */
  score: number;
  travelTimes: TravelTime[];
}

/** 入力駅の人数重み付き重心（地図表示と参考指標にのみ使う） */
export interface Centroid {
  lat: number;
  lng: number;
}

/** スコアの内訳の重み（合計 1） */
export interface ScoreWeights {
  fairness: number;
  proximity: number;
  fare: number;
}

/** POST /api/center のレスポンス */
export interface CenterResult {
  centroid: Centroid;
  best: RankingEntry;
  ranking: RankingEntry[];
  mode: Mode;
  candidateCount: number;
  candidateRadiusKm: number;
  routingMethod: RoutingMethod;
  /** 後方互換。経路APIで精緻化したかどうか */
  routingRefined: boolean;
  weights: ScoreWeights;
  origins: OriginStation[];
  /** 経路プロバイダが設定されているか */
  routingUsed: boolean;
}

/** POST /api/center のリクエスト */
export interface CenterRequest {
  origins: string[];
  mode: Mode;
  /** 公平さの重み 0〜1。既定 0.6 */
  weight?: number;
  /** 運賃の重み 0〜1。既定 0（考慮しない） */
  fareWeight?: number;
  /** origins と同じ並びの人数 */
  peopleCounts?: number[];
}

/** 周辺スポット1件 */
export interface Spot {
  name: string;
  category: SpotCategory;
  lat: number;
  lng: number;
  tags: {
    cuisine: string | null;
    opening_hours: string | null;
  };
}

/** 運行情報1件 */
export interface TrainInformationItem {
  id: string;
  /** 路線の表示名 */
  railway: string;
  /** ODPT の路線識別子 */
  railwayRef: string;
  status: string;
  text: string;
  updatedAt: string | null;
  validUntil: string | null;
  refreshAfterSeconds: number;
  serviceState: ServiceState;
  isNormal: boolean;
  isServiceEnded: boolean;
}

/** GET /api/train-information のレスポンス */
export interface TrainInformation {
  items: TrainInformationItem[];
  updatedAt: string;
  refreshAfterSeconds: number;
  fetchedAt: string;
}

/** エラー時に各APIが返す共通の形 */
export interface ApiError {
  error: string;
  /** 分岐が必要なエラーにだけ付く（例: ODPT_NOT_CONFIGURED） */
  code?: string;
  /** 未登録の駅名（/api/center のみ） */
  unknown?: string[];
}
