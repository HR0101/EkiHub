# EkiHub 🗾

複数人の最寄駅を入力すると，**全員が集まりやすい「中心となる駅」**を算出・提案するWebアプリケーションです．日本全国の鉄道駅（約8,200駅）に対応し，地理的重心ではなく**鉄道ネットワーク上の移動時間の公平性**でランキングします．

ダークモードを基調とした没入感のあるUIで，地図上に各駅からの位置関係と所要時間を可視化します．

## 🌐 今すぐ使う（インストール不要）

公開サーバーにデプロイ済みです．以下の公開URLへブラウザでアクセスするだけで利用できます．

> **▶ [https://ekihub.jp](https://ekihub.jp)**

ローカルで開発・改造したい場合は，後述の「[ローカルで開発する](#-ローカルで開発する開発者向け)」を参照してください．

---

## 主な機能

- **複数駅の入力**：2駅以上を任意の数だけ追加でき，駅名のオートコンプリート付き．
- **中心駅の算出**：鉄道ネットワーク上の移動時間の公平性と近接性を組み合わせた複合スコアで最適駅を提案．
- **駅ネットワークグラフ**：約8,200駅から近接グラフを構築し，ダイクストラ法で実際の鉄道経路に沿った所要時間を算出．
- **規模による絞り込み（トグル切替）**
  - **主要駅限定**：乗降客数20万人/日以上のターミナル駅のみを候補にする．
  - **規模不問**：規模を問わず，純粋に時間の中心駅を候補にする．
- **結果の可視化**：中心駅カード，各最寄駅からの所要時間バー，地図上の経路線・重心表示．
- **候補ランキング**：候補駅をクリックすると，その駅基準でカード・所要時間・地図が切り替わる．

### 拡張機能（機能モジュール）

コア（`app.js`）が公開するイベントバス `window.EkiHub` を介して，以下の機能を独立モジュールとして追加しています（`public/js/features/`）．

| 機能 | 概要 |
|---|---|
| テーマ切替 | ダーク／ライト／自動モードと7種のカラーテーマ（デフォルト・サクラ・森・海・夕焼け・紅葉・高コントラスト）．永続化対応． |
| 多言語対応 | 日本語・英語・中国語・韓国語の切替（`i18n.js`） |
| メンバー名・人数 | 各駅にメンバー名と人数を設定．人数で重心・平均を重み付け． |
| 重視ポイント | 「近さ ⇄ 公平さ」スライダーに加え，**運賃の重視度**スライダー． |
| 運賃概算・直通可能性 | 距離から普通運賃を概算し表示．同一路線なら「直通」を表示． |
| 現在地から最寄駅 | Geolocation APIで現在地を取得し，最寄駅を入力欄へ自動挿入． |
| 共有URL・QR | 入力・条件をURL化してコピー／Web共有／QRコード表示．開くと自動復元． |
| 結果コピー | 集合駅と各メンバーの所要時間・運賃をテキストでクリップボードにコピー． |
| 集合時刻・出発逆算 | 集合時刻から各メンバーの出発時刻を逆算．`.ics`でカレンダー登録． |
| 周辺スポット | 集合駅周辺のカフェ・居酒屋・カラオケ等をOSMから取得し地図表示． |
| 履歴・お気に入り | 検索履歴を保存・再実行．駅の組合せをお気に入り登録． |
| 印刷 | 結果を印刷用レイアウトで出力． |
| 鉄道運行情報 | ODPTセンターの最新運行情報を表示．PCでは入力欄下のカード、スマートフォンでは上部の「運行情報」ボタンから開く． |

---

## 技術スタック

| 区分 | 採用技術 | 選定理由 |
|---|---|---|
| バックエンド | Node.js（ESM）+ Express | 依存が `express` のみで極めて軽量．フロント・バック言語統一 |
| フロントエンド | Vanilla JS + HTML + CSS | ビルドステップなし（`public/` をそのまま配信）．フレームワーク非依存 |
| 地図 | Leaflet + CARTO Dark タイル | APIキー不要・無料でダークモードの地図を実現 |
| 駅データ | OpenStreetMap（Overpass API）+ 手動拡張 | キー不要で日本全国の駅位置情報を取得 |
| 乗降客数 | 国土数値情報 S12（駅別乗降客数） | 国土交通省の公式オープンデータ．主要駅判定に利用 |
| 経路（任意） | OpenTripPlanner（差し替え式） | `routeProvider` で実所要時間に置換可能．未設定時は距離推定にフォールバック |
| 周辺スポット | OpenStreetMap（Overpass API） | 集合駅周辺の店舗・施設をキー不要で取得 |
| QRコード | qrcodejs（CDN） | 共有URLのQRをクライアント側で生成 |
| ホスティング | Oracle Cloud VM + nginx + PM2 | Always Free枠で無期限無料．Let's EncryptでHTTPS化 |
| CDN / セキュリティ | Cloudflare | WAF・DDoS防御・オリジンIP秘匿・SSL/TLS |
| CI/CD | GitHub Actions | push時に自動テスト＆デプロイ（OCI CLIで動的ファイアウォール制御） |

### アーキテクチャ（コア + 機能モジュール）

```
コア（app.js: 979行）
  ├── フォーム・オートコンプリート・地図描画
  ├── API呼び出し・結果表示
  └── 拡張API（window.EkiHub）公開
        ├── イベントバス（on / off / emit）
        ├── 状態アクセサ（getState / getResult / getSelected）
        └── ヘルパー（injectStyle / escapeHtml / t）

機能モジュール（public/js/features/*.js: 各139〜572行）
  └── window.EkiHub の イベント を購読し，所定の拡張枠へUIを差し込む
      → 相互に独立．1つが例外を投げても他に波及しない
```

新機能の追加は `public/js/features/foo.js` を作成し，`index.html` 末尾に `<script defer>` を1行追加するだけで完了します．

---

## ディレクトリ構成

```
EkiHub/
├── server.js                  # Expressサーバー（API・データマージ・OGP生成）
├── package.json               # 依存: express のみ
├── .github/workflows/
│   └── deploy.yml             # CI/CD（テスト → Oracle Cloud VMへ自動デプロイ）
├── data/
│   ├── stations.js            # 埋め込み主要駅（乗降客数つき・手動キュレーション）
│   ├── stations-osm.json      # 日本全国約8,200駅（OSM + 手動拡張・コミット対象）
│   └── ridership.json         # 駅名→乗降客数マップ（S12から生成・コミット対象）
├── lib/
│   ├── centerLogic.js         # 中心駅算出（重心・時間・運賃・人数重み・モードA/B）
│   ├── stationGraph.js        # 駅ネットワークグラフ構築・ダイクストラ法
│   ├── fareEstimate.js        # 距離からの運賃概算
│   ├── odptTrainInformation.js# ODPT運行情報の取得・正規化・キャッシュ
│   ├── routeProvider.js       # 経路API抽象化（Strategy Pattern・差し替え式）
│   └── poiService.js          # 周辺スポット取得（Overpass API・キャッシュつき）
├── scripts/
│   ├── fetchKantoStations.js  # OSMから駅データを取得
│   ├── buildRidership.js      # S12のGeoJSONから乗降客数マップを生成
│   ├── generateKana.js        # kuromojiでkana未登録駅の読みを補完
│   ├── testRouting.js         # 経路精緻化ロジックの単体テスト
│   └── smoke*.js              # ブラウザ起動スモークテスト（puppeteer・別途インストール要）
└── public/
    ├── index.html             # トップページ（拡張枠つき）
    ├── howto.html             # 使い方ガイド
    ├── 404.html               # カスタム404ページ
    ├── style.css              # ダーク/ライト/7カラーテーマ対応UI
    ├── app.js                 # コア：フォーム・地図・算出・拡張API（window.EkiHub）
    ├── robots.txt / sitemap.xml
    └── js/features/           # 機能モジュール（各機能が独立した1ファイル）
        ├── themeToggle.js     # テーマ切替（モード＋カラー）
        ├── i18n.js            # 多言語切替（日/英/中/韓）
        ├── geolocation.js     # 現在地から最寄駅
        ├── fareWeight.js      # 運賃の重視度スライダー
        ├── shareLink.js       # 共有URLのコピー/共有
        ├── qrShare.js         # 共有URLのQRコード
        ├── clipboardSummary.js# 結果サマリーのコピー
        ├── meetingTools.js    # 集合時刻・出発逆算・カレンダー(.ics)
        ├── nearbySpots.js     # 周辺スポット取得・地図表示
        ├── historyFavorites.js# 履歴・お気に入り
        ├── trainInformation.js# ODPT鉄道運行情報カード
        └── printExport.js     # 印刷用出力
```

---

## 使い方

### ① 公開URLで使う（一般利用者向け）

ブラウザで公開URLを開くだけです．インストール・ログイン不要で，スマートフォンからも利用できます．

> **▶ [https://ekihub.jp](https://ekihub.jp)**

### ② ローカルで開発する（開発者向け）

コードを改造したい場合や，経路API（OTP）を自前で連携したい場合は，手元で起動します．**Node.js 18 以上**が必要です．

```bash
git clone https://github.com/HR0101/EkiHub.git
cd EkiHub
npm install
npm run dev        # ファイル監視つき起動（開発用）
# -> http://localhost:3000
```

> `data/stations-osm.json` と `data/ridership.json` はリポジトリに同梱済みのため，クローン後すぐに動作します．

---

## 中心駅の算出ロジック

`lib/centerLogic.js` の `computeCenterStation` が中核です．

1. **重心算出**：入力駅群の緯度経度を人数で重み付け平均し，地理的重心を求める（地図表示・参考指標用）．
2. **駅グラフ構築**（`lib/stationGraph.js`）：約8,200駅から近接グラフを構築（各駅から最寄りK=6駅を接続，エッジ上限12km）．ダイクストラ法で各入力駅から全駅への所要時間を算出．
3. **候補絞り込み（モード分岐）**
   - 主要駅限定 … 乗降客数20万人/日以上，または主要駅フラグを持つ駅のみ．
   - 規模不問 … 全駅を候補にする．
4. **複合スコア**：`公平性（時間のばらつきの小ささ） × 近接性 × 運賃` を正規化・反転して加重合算．
5. **2段階精緻化**（任意）：上位8駅のみ，経路API（あれば）で実所要時間・運賃・乗換回数を取得して再ランキング．

### エッジ上限12kmの意味（海上重心問題の根治）

`stationGraph.js` の `DEFAULT_EDGE_CAP_M = 12000`（12km）は単なるパフォーマンスパラメータではありません．東京湾横断（久里浜-浜金谷間など）は約30kmあるため，12kmを上限とすることで**海を渡るショートカットがグラフ上に物理的に存在しなくなり**，重心が海上に出ても海を渡る経路は生まれません．

---

## デプロイ

### インフラ構成

```
[ブラウザ] ──HTTPS──> [Cloudflare CDN/WAF] ──> [nginx :443] ──proxy──> [Node/Express :3000（PM2常駐）]
```

- **Cloudflare**：CDN・WAF・DDoS防御・オリジンIP秘匿・SSL/TLS終端
- **nginx**：リバースプロキシ（`Host` / `X-Forwarded-Proto` を転送し，OGP の絶対URLを正しく生成）
- **Node.js + Express**：アプリ本体（:3000）を **PM2** で常駐・自動再起動
- **Let's Encrypt（certbot）**：TLS証明書を取得し，自動更新

### CI/CD（GitHub Actions）

`main` ブランチへの push で自動的にテスト＆デプロイが走ります（`.github/workflows/deploy.yml`）．

```
push → テスト（testRouting.js）
     → OCI CLIでSSHファイアウォールを一時開放
     → SSH接続してgit fetch & reset → npm install → pm2 restart
     → ヘルスチェック（curl ekihub.jp）
     → ファイアウォールを自動クローズ
```

SSHポートは通常自宅IPのみに制限しており，デプロイ時のみ GitHub Actions ランナーのIPを動的に許可→完了後に自動削除します．認証情報はすべて GitHub Secrets に格納しています．

### 環境変数（任意）

外部APIを使う場合のみ設定します．いずれも未設定で動作します（埋め込みデータ＋距離概算へ自動フォールバック）．

| 変数 | 用途 |
|---|---|
| `PORT` | 待受ポート（既定：3000） |
| `ODPT_TOKEN` | 公共交通オープンデータセンターのアクセストークン．駅データ拡張と鉄道運行情報カードに使用 |
| `ROUTING_PROVIDER` | 経路APIの種別（現在は `otp` に対応） |
| `ROUTING_OTP_URL` | OTP2 の GraphQL エンドポイント |
| `ROUTING_TIMEOUT_MS` | 経路APIのタイムアウト（既定：8000） |

---

## 経路APIで所要時間・運賃を精緻化する（任意・無料）

既定では所要時間・運賃を距離から概算します．より正確にしたい場合は，**無料・キー不要**の [OpenTripPlanner (OTP)](https://www.opentripplanner.org/) を自前で立てて連携できます．

### 仕組み（2段階方式）

約8,200駅すべてを経路APIで叩くことはしません．距離概算で上位8駅に絞ってから実APIで精緻化することで，呼び出しは「8駅 × メンバー数」程度に抑えます．経路APIが未設定・到達不可・タイムアウトの場合は，自動的に距離概算へフォールバックします．

### OTPの起動例

```bash
# 1) Java 17+ と OTP2 の jar を用意
# 2) GTFSとOSM(.pbf)を graphs/japan/ に配置
java -Xmx4G -jar otp-2.x.jar --build --serve graphs/japan
# -> http://localhost:8080 で起動

# 3) EkiHub から接続
ROUTING_PROVIDER=otp \
ROUTING_OTP_URL=http://localhost:8080/otp/routers/default/index/graphql \
npm start
```

> 将来 駅すぱあと等へ差し替える場合は，`lib/routeProvider.js` の `makeProviderFromEnv` に分岐を追加してください（プロバイダは `{ minutes, fareYen, transfers }` を返す共通インターフェースです）．

---

## データ更新

外部データを最新化したい場合の手順です．

### 駅データ（OSM）

```bash
node scripts/fetchKantoStations.js
# -> data/stations-osm.json を再生成
```

### 乗降客数データ（国土数値情報 S12）

1. [国土数値情報「駅別乗降客数」](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-S12.html) からGeoJSONをダウンロードして展開．
2. 展開先のGeoJSONを指定して実行：

```bash
node scripts/buildRidership.js /path/to/S12-23_NumberOfPassengers.geojson
# -> data/ridership.json を再生成
```

### 駅名の読み補完

```bash
node scripts/generateKana.js
# -> kana未登録駅の読みをkuromojiで補完
```

更新後はサーバーを再起動すると反映されます．

> `stations-osm.json`（1.4MB）と `ridership.json` は生成物を含みますが，外部APIの可用性が保証されないこと，手動で追加・修正したデータが多く含まれること，クローン後すぐに動作させることを重視して，あえてGitにコミットしています．

---

## 調整ポイント

- **主要駅の閾値**：`server.js` の `MAJOR_THRESHOLD`（既定20万人/日）を変更すると，主要駅限定モードの候補数を増減できます．
- **スコアの重み**：`lib/centerLogic.js` の `DEFAULT_WEIGHT_FAIRNESS`（「近さ」と「公平さ」の配分）と，UIの運賃重視スライダーでバランスを調整できます．
- **精緻化する駅数**：`computeCenterStation({ refineCount })`（既定8）で，経路APIで精緻化する上位候補数を変更できます．
- **エッジ上限**：`lib/stationGraph.js` の `DEFAULT_EDGE_CAP_M`（12km）．この値を安易に上げると海上を渡るショートカットが復活するため注意が必要です．

---

## データ出典・ライセンス

- 駅位置情報：© OpenStreetMap contributors（ODbL）
- 乗降客数：国土交通省「国土数値情報（駅別乗降客数データ）」
- 地図タイル：© CARTO
