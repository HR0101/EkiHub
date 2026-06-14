# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

EkiHub は，複数人の最寄駅から「全員が集まりやすい中心駅」を算出・提案する Web アプリです．関東圏の約 2,000 駅に対応します．Node.js + Express のバックエンドと，フレームワーク非依存の Vanilla JS フロントエンドで構成されます．**ビルドステップはありません**（`public/` をそのまま配信）．

詳細な機能一覧・データ出典・OTP 連携手順は `README.md` を参照してください．本ファイルは「コードを触る上で非自明な点」に絞ります．

## コマンド

```bash
npm install              # 依存インストール（express のみ。kuromoji は devDependency）
npm start                # 本番起動（http://localhost:3000）
npm run dev              # node --watch 付き起動（開発用）

node scripts/testRouting.js   # 経路精緻化ロジックの単体テスト（サーバー・外部依存なし）
```

### スモークテストの注意

`scripts/smoke*.js`（`smokeTest.js` / `smokeMap.js` / `smokeSpots.js` / `smokeLoading.js` など）は puppeteer を使うブラウザテストですが，**puppeteer は package.json に含まれていません**．実行には次が必要です．

1. `npm i puppeteer`（別途インストール）
2. サーバーを `localhost:3000` で起動しておくこと
3. Chrome（パスが `/Applications/Google Chrome.app/...` にハードコードされている＝macOS 前提）

CI 的に安定して回せるのは `node scripts/testRouting.js` のみです．

### データ再生成（外部データを最新化する時のみ）

```bash
node scripts/fetchKantoStations.js                 # OSM → data/stations-osm.json
node scripts/buildRidership.js <S12_GeoJSON>       # 国土数値情報S12 → data/ridership.json
node scripts/generateKana.js                       # kuromojiでkana未登録駅の読みを補完
```

## アーキテクチャ（複数ファイルを跨ぐ全体像）

### フロントエンド：コア + 独立機能モジュール

2 層構成です．**新機能はコアを編集せず，独立した機能モジュールとして追加する**のが原則です．

- **コア（`public/app.js`）** … フォーム・オートコンプリート・モード/重み・API 呼び出し・地図描画を担当し，拡張 API `window.EkiHub` を公開する．`window.EkiHub` はイベントバス（`on`/`off`/`emit`），状態アクセサ（`getState`/`getResult`/`getSelected` 等），状態変更（`setOrigins`/`setFareWeight`/`compute` 等），地図操作（`map`/`flyTo`），ヘルパー（`injectStyle`/`escapeHtml`/`t` など）を持つ．
- **機能モジュール（`public/js/features/*.js`）** … 各機能が `(() => { ... })()` の即時関数 1 ファイル．`window.EkiHub` のイベント（`ready` / `result` / `select` / `inputs-change` / `fareweight-change` / `meeting-change` など）を購読し，**固定の拡張枠 DOM** へ自身の UI を `appendChild` する．相互に独立しており，1 つが throw しても `emit` 側が try/catch で握るため他へ波及しない．

拡張枠（`public/index.html` 内の挿入先 ID）：

| ID | 用途 |
|---|---|
| `#toolbar` | テーマ/言語/履歴などヘッダー系 |
| `#feature-controls` | 入力フォーム内のコントロール（運賃重視スライダー等） |
| `#hero-actions` | 結果カード内のアクション（共有/QR/カレンダー/印刷） |
| `#feature-panels` | 結果下のパネル（周辺スポット等） |

**機能を追加する手順**：`public/js/features/foo.js` を新規作成 → `public/index.html` の末尾に `<script defer src="js/features/foo.js"></script>` を登録．スタイルは `E.injectStyle(id, css)` で機能固有の接頭辞付きクラスとして注入する（CSS の衝突を避ける）．

### 中心駅算出パイプライン（`lib/centerLogic.js` の `computeCenterStation`）

サーバーの `POST /api/center` から呼ばれる中核ロジック．段階は次のとおりです．

1. **重心算出** … 入力駅の緯度経度を人数で重み付け平均（地図表示・参考指標用．選定そのものには使わない）．
2. **候補絞り込み（モード分岐）** … モード A は主要駅のみ（`isMajor` または `ridership >= 200000`），モード B は全駅．
3. **駅ネットワークの最短経路**（`lib/stationGraph.js`）… 全駅から近接グラフを構築し，各入力駅からダイクストラで全駅への所要時間・距離を求める．**「近さ」は重心からの直線距離ではなく，このグラフ上の実所要時間で評価する**．
4. **複合スコア** … `公平性（時間のばらつきの小ささ）× 近さ × 運賃` を集合内で正規化・反転して加重合算．
5. **第2段階（任意）** … `routeProvider` があれば，上位 `refineCount`（既定 8）駅のみ実 API で精緻化して再ランキング（全 ~2000 駅は叩かない）．

### 海上重心問題と駅グラフ（重要な設計判断）

`lib/stationGraph.js` のエッジ上限 `DEFAULT_EDGE_CAP_M`（= 12km）は単なる性能パラメータではありません．**12km を超える駅間を接続しないことで，東京湾横断（約 30km）のような「海上を渡るショートカット」がグラフ上に物理的に存在しなくなり，重心が海上に出ても海を渡る経路が生まれない**＝海上重心問題を根治しています．この値を安易に上げると誤接続が復活します．

### routeProvider（差し替え式の経路 API インターフェース）

`lib/routeProvider.js` は `{ minutes, fareYen, transfers }`（取得不可項目は null）を返す共通インターフェースです．`makeProviderFromEnv` が環境変数（`ROUTING_PROVIDER` 等）からプロバイダを生成し，**未設定なら null を返して `centerLogic` 側が距離概算へ自動フォールバック**します．現状は OTP（OpenTripPlanner）のみ対応．別プロバイダ（駅すぱあと等）を足す場合は `makeProviderFromEnv` に分岐を追加します．

### データ層

`server.js` 起動時に 3 データソースをマージします（同名駅は埋め込みを優先）．

- `data/stations.js` … 手動キュレーションの主要駅（乗降客数・`isMajor` 付き）．
- `data/stations-osm.json` … OSM 由来の関東圏全駅（生成物）．
- `data/ridership.json` … 国土数値情報 S12 由来の駅名→乗降客数マップ（生成物）．S12 値があれば `ridership` を上書きし，`isMajor` を再計算．

> `stations-osm.json` と `ridership.json` は生成物ですが，アプリ動作に必須かつ再取得が不安定なため，**あえて Git にコミットしています**（`.gitignore` 参照）．クローン後すぐ動きます．

## 触る前に知っておくべき制約・落とし穴

- **ESM プロジェクト**（package.json `"type": "module"`）．`import`/`export` を使用．Node **>= 18** 必須（グローバル `fetch` に依存）．
- **`MAJOR_THRESHOLD`（= 200000）が 2 箇所に重複定義**されています：`server.js` の `MAJOR_THRESHOLD` と `data/stations.js` の `MAJOR_RIDERSHIP_THRESHOLD`．主要駅の閾値を変える時は**両方を揃える**こと．
- 駅マスタは共有参照です．`server.js` の `/api/center` では入力駅を `{ ...found, people }` で**複製してから** people を付与し，マスタを汚さないようにしています（同パターンを踏襲すること）．
- 外部 API（Overpass / OTP / ODPT）はすべてキャッシュ＋タイムアウト＋失敗フォールバック付きで実装されています．新たな外部呼び出しを足す際も同じ防御方針に揃えてください．
