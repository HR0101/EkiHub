# EkiHub 🗾

複数人の最寄駅を入力すると，**全員が集まりやすい「中心となる駅」**を算出・提案するWebアプリケーションです．関東圏の鉄道駅（約2,000駅）に対応し，駅の規模（乗降客数）による絞り込みにも対応しています．

ダークモードを基調とした没入感のあるUIで，地図上に各駅からの位置関係と所要時間を可視化します．

## 🌐 今すぐ使う（インストール不要）

クラウド（Render）にデプロイ済みです．以下の公開URLへブラウザでアクセスするだけで利用できます．ローカル環境の構築は不要です．

> **▶ [https://ekihub.onrender.com](https://ekihub.onrender.com)**

> ℹ️ 無料プランで運用しているため，一定時間アクセスが無いとサーバーがスリープします．スリープ後の初回アクセスは起動に十数秒〜数十秒かかることがありますが，しばらく待つと通常どおり表示されます．

ローカルで開発・改造したい場合は，後述の「[ローカルで開発する](#ローカルで開発する開発者向け)」を参照してください．

---

## 主な機能

- **複数駅の入力**：2駅以上を任意の数だけ追加でき，駅名のオートコンプリート付き．
- **中心駅の算出**：地理的重心と移動時間の均等さ（公平性）を組み合わせた複合スコアで最適駅を提案．
- **規模による絞り込み（トグル切替）**
  - **モードA（主要駅限定）**：乗降客数20万人/日以上のターミナル駅のみを候補にする．
  - **モードB（規模不問）**：規模を問わず，純粋に地理・時間の中心駅を候補にする．
- **結果の可視化**：中心駅カード，各最寄駅からの所要時間バー，地図上の経路線・重心表示．
- **候補ランキング**：候補駅をクリックすると，その駅基準でカード・所要時間・地図が切り替わる．

### 拡張機能（機能モジュール）

コア（`app.js`）が公開するイベントバス `window.EkiHub` を介して，以下の機能を独立モジュールとして追加しています（`public/js/features/`）．

| 機能 | 概要 |
|---|---|
| メンバー名・人数 | 各駅にメンバー名と人数を設定．人数で重心・平均を重み付け． |
| 重視ポイント | 「近さ ⇄ 公平さ」スライダーに加え，**運賃の重視度**スライダーを追加． |
| 運賃概算・直通可能性 | 距離から普通運賃を概算し表示．同一路線なら「直通」を表示． |
| 現在地から最寄駅 | Geolocationで現在地を取得し，最寄駅を入力欄へ自動挿入． |
| 共有URL・QR | 入力・条件をURL化してコピー／Web共有／QRコード表示．開くと自動復元． |
| 結果コピー | 集合駅と各メンバーの所要時間・運賃をテキストでコピー． |
| 集合時刻・出発逆算・カレンダー | 集合時刻から各メンバーの出発時刻を逆算．`.ics`でカレンダー登録． |
| 周辺スポット | 集合駅周辺のカフェ・居酒屋・カラオケ等をOSMから取得し地図表示． |
| 履歴・お気に入り | 検索履歴を保存・再実行．駅の組合せをお気に入り登録． |
| テーマ・言語 | ダーク／ライト／自動テーマ，日本語／英語の切替（永続化）． |
| 印刷 | 結果を印刷用レイアウトで出力． |

---

## 技術スタック

| 区分 | 採用技術 | 選定理由 |
|---|---|---|
| ホスティング | Render（Web Service） | GitHub連携でpush時に自動デプロイ．公開URLで誰でも利用可能． |
| バックエンド | Node.js + Express | 軽量．駅データのマージやAPIキーの秘匿をサーバー側に集約できる． |
| フロントエンド | HTML / CSS / Vanilla JS | フレームワーク非依存で軽量．没入感あるUIを直接制御． |
| 地図 | Leaflet + CARTO Dark タイル | **APIキー不要・無料**でダークモードの地図を実現． |
| 駅データ | OpenStreetMap（Overpass API） | キー不要で関東圏全駅の位置情報を一括取得． |
| 乗降客数 | 国土数値情報 S12（駅別乗降客数） | 国土交通省の公式オープンデータ．主要駅判定に利用． |
| 経路（任意） | 経路検索API（差し替え式） | `routeProvider` 実装で実所要時間に置換可能．未設定時は距離推定． |
| 周辺スポット | OpenStreetMap（Overpass API） | 集合駅周辺の店舗・施設をキー不要で取得． |
| QRコード | qrcodejs（CDN） | 共有URLのQRをクライアント側で生成． |

### アーキテクチャ（拡張の仕組み）

- **コア（`public/app.js`）** … 入力・算出・地図描画と，拡張用API `window.EkiHub`（イベントバス＋アクセサ＋ヘルパー）を提供．
- **機能モジュール（`public/js/features/*.js`）** … 各機能が独立した即時関数ファイル．`window.EkiHub` の `on("ready"/"result"/"select")` 等を購読し，所定の拡張枠（`#toolbar` / `#feature-controls` / `#hero-actions` / `#feature-panels`）へ自身のUIを差し込む．相互に独立しているため，1つが失敗しても他に波及しない．

---

## ディレクトリ構成

```
EkiHub/
├── server.js                  # Expressサーバー（API・データマージ）
├── package.json
├── data/
│   ├── stations.js            # 埋め込み主要駅（乗降客数つき・手動キュレーション）
│   ├── stations-osm.json      # 関東圏全駅（OSMから生成・コミット対象）
│   └── ridership.json         # 駅名→乗降客数マップ（S12から生成・コミット対象）
├── lib/
│   ├── centerLogic.js         # 中心駅算出（重心・時間・運賃・人数重み・モードA/B）
│   ├── fareEstimate.js        # 距離からの運賃概算
│   └── poiService.js          # 周辺スポット取得（Overpass・キャッシュつき）
├── scripts/
│   ├── fetchKantoStations.js  # OSMから関東圏の駅を取得
│   ├── buildRidership.js      # S12のGeoJSONから乗降客数マップを生成
│   └── smokeTest.js           # ブラウザ起動スモークテスト（puppeteer）
└── public/
    ├── index.html             # 画面構造（拡張枠つき）
    ├── style.css              # ダーク/ライトモードUI
    ├── app.js                 # コア：フォーム・地図・算出・拡張API(window.EkiHub)
    └── js/features/           # 機能モジュール（各機能が独立した1ファイル）
        ├── themeToggle.js     # テーマ切替（ダーク/ライト/自動）
        ├── i18n.js            # 日本語/英語 切替
        ├── geolocation.js     # 現在地から最寄駅
        ├── fareWeight.js      # 運賃の重視度スライダー
        ├── shareLink.js       # 共有URLのコピー/共有
        ├── qrShare.js         # 共有URLのQRコード
        ├── clipboardSummary.js# 結果サマリーのコピー
        ├── meetingTools.js    # 集合時刻・出発逆算・カレンダー(.ics)
        ├── nearbySpots.js     # 周辺スポット取得・地図表示
        ├── historyFavorites.js# 履歴・お気に入り
        └── printExport.js     # 印刷用出力
```

---

## 使い方

利用方法は2通りです．**ただ使いたいだけなら ① だけで完結します．**

### ① 公開URLで使う（一般利用者向け）

ブラウザで公開URLを開くだけです．インストール・ログイン不要で，スマートフォンからも利用できます．

> **▶ [https://ekihub.onrender.com](https://ekihub.onrender.com)**

### ② ローカルで開発する（開発者向け）

コードを改造したい場合や，経路API（OTP）を自前で連携したい場合は，手元で起動します．**Node.js 18 以上**が必要です．

#### 1. リポジトリを取得して依存をインストール

```bash
git clone https://github.com/HR0101/EkiHub.git
cd EkiHub
npm install
```

#### 2. サーバーを起動

```bash
npm start          # 本番起動
npm run dev        # ファイル監視つき起動（開発用）
```

#### 3. ブラウザでアクセス

```
http://localhost:3000
```

> `data/stations-osm.json` と `data/ridership.json` はリポジトリに同梱済みのため，クローン後すぐに動作します．

---

## Renderへのデプロイ

本アプリは **[Render](https://render.com/)** の Web Service として公開しています（公開URL：[https://ekihub.onrender.com](https://ekihub.onrender.com)）．GitHubリポジトリと連携しておけば，`main` ブランチへのpushで自動的に再デプロイされます．

### サービス設定

Render ダッシュボードで **New → Web Service** を作成し，本リポジトリを連携したうえで，以下を設定します．

| 項目 | 値 |
|---|---|
| Environment | `Node` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | 任意（無料プランの `Free` でも動作） |

> ビルド工程はありません（フロントエンドは `public/` の静的ファイルをそのまま配信します）．`npm install` で依存を入れ，`npm start`（＝`node server.js`）で起動するだけです．

### ポートの扱い

Render は待受ポートを環境変数 `PORT` で注入します．`server.js` は `const PORT = process.env.PORT || 3000;` でこれを受けるため，**追加設定は不要**です（ローカルでは既定の3000，Render上では注入値で起動します）．

### 環境変数（任意）

外部APIを使う場合は，Render ダッシュボードの **Environment → Environment Variables** に追加します．いずれも未設定で動作します（埋め込みデータ＋距離概算へ自動フォールバック）．

| 変数 | 用途 |
|---|---|
| `ODPT_TOKEN` | 公共交通オープンデータ(ODPT)で駅データを拡張する場合 |
| `ROUTING_PROVIDER` / `ROUTING_OTP_URL` / `ROUTING_TIMEOUT_MS` | 経路API(OTP)で所要時間・運賃を実データ化する場合（詳細は後述） |

各変数の意味は「[環境変数（任意）](#環境変数任意)」を参照してください．

> ⚠️ **無料プランの注意**：一定時間アクセスが無いとサービスがスリープし，次回アクセス時に再起動（コールドスタート）が発生します．初回表示が遅い場合は数十秒お待ちください．常時稼働させたい場合は有料プランへの変更を検討してください．

---

## 中心駅の算出ロジック

`lib/centerLogic.js` の `computeCenterStation` が中核です．

1. **重心算出**：入力駅群の緯度経度を平均し，地理的重心を求める．
2. **候補絞り込み（モード分岐）**
   - モードA … 乗降客数20万人/日以上，または主要駅フラグを持つ駅のみ．
   - モードB … 全駅を候補にする．
3. **時間補正**：各候補について，入力駅からの所要時間を算出（経路APIがあれば実値，無ければ「直線距離 ÷ 表定速度35km/h ＋ 乗換オーバーヘッド5分」で推定）．
4. **複合スコア**：`公平性0.6 ＋ 重心近接0.4` で評価．公平性は所要時間の標準偏差（小さいほど全員均等），近接は重心からの距離で，それぞれ正規化・反転して合算する．
5. 入力駅自身を除外し，スコア降順で上位5駅を返す．

---

## データ更新

外部データを最新化したい場合の手順です．

### 関東圏の駅データ（OSM）

```bash
node scripts/fetchKantoStations.js
# -> data/stations-osm.json を再生成
```

### 乗降客数データ（国土数値情報 S12）

1. [国土数値情報「駅別乗降客数」](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-S12.html) からGML/GeoJSON（例：`S12-23_GML.zip`）をダウンロードして展開．
2. 展開先のGeoJSONを指定して実行：

```bash
node scripts/buildRidership.js /path/to/S12-23_NumberOfPassengers.geojson
# -> data/ridership.json を再生成
```

更新後はサーバーを再起動すると反映されます．

---

## 環境変数（任意）

ローカルでは `.env.example` を `.env` にコピーして設定できます（`.env` はコミットされません）．Render 上では「[Renderへのデプロイ](#renderへのデプロイ)」の手順に従い，ダッシュボードの Environment Variables に設定します．

| 変数 | 用途 |
|---|---|
| `PORT` | 待受ポート（既定：3000）．Render では自動注入されるため設定不要． |
| `ODPT_TOKEN` | 公共交通オープンデータ(ODPT)で駅データをさらに拡張する場合に設定 |
| `ROUTING_PROVIDER` | 経路APIの種別．現在は `otp`（OpenTripPlanner）に対応 |
| `ROUTING_OTP_URL` | OTP2 の GraphQL エンドポイント |
| `ROUTING_TIMEOUT_MS` | 経路APIのタイムアウト（既定：8000） |

設定例：

```bash
PORT=8080 ODPT_TOKEN=xxxxx npm start
```

---

## 経路APIで所要時間・運賃を精緻化する（任意・無料）

既定では所要時間・運賃を距離から概算します．より正確にしたい場合は，**無料・キー不要**の
[OpenTripPlanner (OTP)](https://www.opentripplanner.org/) を自前で立て，日本のオープンGTFS
（[GTFS-JP](https://www.gtfs.jp/) / 公共交通オープンデータ）を読み込ませて連携できます．

### 仕組み（2段階方式）

候補は最大約2,000駅あるため，**全候補を経路APIで叩くことはしません**．

1. **絞り込み**：まず距離からの概算で全候補をスコアリングし，上位8駅に絞る．
2. **精緻化**：上位8駅についてのみ，各メンバーから経路APIで実所要時間・運賃・乗換回数を取得し，再ランキングする．

これにより経路APIの呼び出しは「8駅 × メンバー数」程度に抑えられます．経路APIが未設定・到達不可・タイムアウトの場合は，自動的に距離概算へフォールバックします（結果には「実経路データ／距離からの概算」の別が表示されます）．

### OTPの起動例

```bash
# 1) Java 17+ と OTP2 の jar を用意
# 2) 関東圏のGTFS（GTFS-JP）と OSM(.pbf) を graphs/kanto/ に配置
java -Xmx4G -jar otp-2.x.jar --build --serve graphs/kanto
# -> http://localhost:8080 で起動

# 3) EkiHub から接続
ROUTING_PROVIDER=otp \
ROUTING_OTP_URL=http://localhost:8080/otp/routers/default/index/graphql \
npm start
```

> 運賃は GTFS に運賃情報（`fare_attributes` / `fare_rules`）が含まれる場合に実値化されます．含まれない場合は所要時間・乗換のみが実データ化され，運賃は概算のままになります．
> 将来 駅すぱあと(Ekispert) 等へ差し替える場合は，`lib/routeProvider.js` の `makeProviderFromEnv` に分岐を追加してください（プロバイダは `{ minutes, fareYen, transfers }` を返す共通インターフェースです）．

---

## 調整ポイント

- **主要駅の閾値**：`server.js` の `MAJOR_THRESHOLD`（既定20万人/日）を変更すると，モードAの候補数を増減できます（15万→約107駅，30万→約42駅）．
- **スコアの重み**：`lib/centerLogic.js` の `DEFAULT_WEIGHT_FAIRNESS`（「近さ＝平均所要時間」と「公平さ＝時間のばらつき」の配分）と，UIの運賃重視スライダーでバランスを調整できます．
- **精緻化する駅数**：`server.js` の `computeCenterStation({ refineCount })`（既定8）で，経路APIで精緻化する上位候補数を変更できます．

---

## データ出典・ライセンス

- 駅位置情報：© OpenStreetMap contributors（ODbL）
- 乗降客数：国土交通省「国土数値情報（駅別乗降客数データ）」
- 地図タイル：© CARTO

各データの利用条件に従ってご利用ください．
