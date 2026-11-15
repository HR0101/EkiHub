# 駅の読みの独立再調査（途中経過：2026-10-20）

前レポートを正解辞書として使わず、現在の全国8,183行と手動登録157行を別の駅データと照合した。今回は調査のみで駅マスターは変更していない。

| 対象 | 読み一致 | 不一致・要検証 | 未照合 | 合計 |
|---|---:|---:|---:|---:|
| stations-osm.json | 7,066 | 981 | 136 | 8,183 |
| stations.js | 157 | 0 | 0 | 157 |

一致は独立データとの一致であり、鉄道会社への全件確認ではない。不一致981件も確定誤りの数ではない。廃駅・表記差・同名駅・副名称の扱いが混在する。前レポートの884件とは比較資料と照合方法が異なる。字形（驒/騨、祗/祇、鴬/鶯、遥/遙）、空白、副名称の括弧の違いも座標で確認した。これにより未照合の13行を照合でき、10行は読み一致、3行は引き続き比較対象となった。

## 一次資料で新たに誤りを確認した例

| 駅 | 現在 | 正しい読み | 根拠 |
|---|---|---|---|
| 本名 | ほんみょう | ほんな | [JR東日本](https://timetables.jreast.co.jp/cgi-bin/st_search.cgi?50on=&rosen=&token=7) |
| 藪神 | やぶしん | やぶかみ | [JR東日本](https://www.jreast.co.jp/estation/stations/1596.html) |
| 文挟 | ぶんきょう | ふばさみ | [JR東日本・文挾駅](https://www.jreast.co.jp/estation/stations/1386.html) |

JR東日本の66件の路線別一覧と県別一覧、[JR九州](https://www.jrkyushu.co.jp/railway/station/)、[JR四国](https://www.jr-shikoku.co.jp/01_trainbus/jikoku/)、[近畿日本鉄道](https://www.kintetsu.co.jp/station/)、[名古屋鉄道](https://www.meitetsu.co.jp/train/station_info/kana_list/01.html)、[阪急電鉄](https://www.hankyu.co.jp/station/index.html)、[京阪電気鉄道](https://www.keihan.co.jp/traffic/station/)の駅一覧を追加照合した。

公式資料と照合できた3,595行では、2,790行が一致、776行が誤読、9行が空白差、14行が公式表記差、1行が記号差、3行が副名称の範囲差、1行が出典間の不一致、1行が仮名表記未確認だった。空白・表記差等は誤読と同じ扱いにしていない。

個別確認の文挟・湖遊館新・表木山・阿夫利神社・大山寺・ケーブル八瀬を合わせ、確定した誤読は計782件。座標・現在値・確認した読み・根拠は verified.json に保存した。公式一覧の誤読776行は全件を確認済み。例として愛子「あいこ→あやし」、富田林「とみたりん→とんだばやし」、土佐昭和「とさあきかず→とさしょうわ」がある。

表木山は、[JR九州の駅ページ](https://www.jrkyushu.co.jp/railway/station/1191830_1601.html)が「ひようきやま」、[国土交通省の災害資料](https://www.mlit.go.jp/common/001904737.pdf)が「ひょうきやま」と食い違う。第三者の駅データと交通案内も後者。現在値「おもてきやま」は誤りと確認できるが、JR九州ページの表記はそのまま採用せず、確認した読みは「ひょうきやま」とした。official-checks.csv では source-conflict として食い違いも残す。

## 追加確認した会社と根拠の種類

[南海電鉄](https://www.nankai.co.jp/traffic/railway.html)の駅ページ・構内図16駅、[JR北海道の多言語駅名一覧](https://www.jrhokkaido.co.jp/global/pdf/station01.pdf)23駅、東武の駅ページ・広報誌・英語案内8駅を追加確認した。JR北海道の一覧は station01.pdf〜station10.pdf を調査した。

公式ローマ字で現在値と音が違うことを確認し、比較資料の仮名を照合した記録には evidence_kind=romanization と原表記を保存している。これらの仮名を公式ページからの直接引用とは扱わない。例：大麻は Ōasa、十弗は Tōfutsu、南海の金剛は KONGŌ。旧い構内図・多言語表にもとづく確認は、現時点の営業状況まで証明するものではない。

JR西日本の全国版予約案内 [Station_name.pdf](https://www.westjr.co.jp/global/en/howto/train-reservation/condition/station/Station_name.pdf) 全81ページも調査し、197候補を確認した。同名駅の都道府県注記を参照データの座標・都道府県と照合し、JRの駅コードに適用を限定した。長音や「ず／づ」をローマ字だけでは判定できないケースは、駅の個別ページも確認した。十島の長音は引き続き未確認とした。

人吉の現在値「ひとよし」は [JR九州の個別ページ](https://www.jrkyushu.co.jp/railway/station/1191819_1601.html)で正しいと確認。比較資料の「ひとよしおんせん」は採用しない。成田空港・空港第2ビルは副名称の範囲差、万座・鹿沢口は中点の差として誤読から除外した。

[秋田内陸縦貫鉄道](https://www.akita-nairiku.com/routemap/)、[一畑電車](https://railway.ichibata.co.jp/fare/futsu/list/)、[筑豊電気鉄道](https://www.chikutetsu.co.jp/station/)、えちぜん鉄道、長良川鉄道の公式一覧・個別ページも確認した。木尾「こんの」、轟「どめき」、美談「みだみ」などを確定した。穴生「あのう／あのお」は同じ発音の表記差として誤読数から除外した。

一畑の「湖遊館新」は正式名が「湖遊館新駅」、読みは「こゆうかんしんえき」。この駅では「駅」が固有名の一部のため、一律に削除しない。verified.json の name_correction に正式名を記録した。また、公式運賃一覧の浜山公園北口のふりがなには駅名との食い違いがあり、[個別駅案内](https://railway.ichibata.co.jp/operate/route/浜山公園北口/)の「はまやまこうえんきたぐち」を採用した。公式サイトにも誤記があり得るため、この出典上の問題を source-issues.json に記録した。

[ことでんの駅一覧](https://www.kotoden.co.jp/publichtm/kotoden/station/)、関東鉄道の個別駅ページ、[阪神の公式発表](https://www.hanshin.co.jp/company/press/pdf/20151110-higashinadarittai.pdf)から計20件、西鉄の[各駅情報サイト](https://www.ensen24.jp/tenjinomuta-line/zasshonokuma.html)から14件の誤読を追加確認した。西鉄福岡（天神）は公式サイトが読みから会社名を省略しているため、現在値を誤読とせず名称の範囲差に分類した。

## 未解決候補の追加調査

前回の474候補から、一次資料による誤読163件、読みの一致・表記差等8件、改称・施設種別10件を確認し、未解決は293件になった。駅マスターには今回の調査結果を反映していない。

樽見、島原、天竜浜名湖、アルピコ、静岡鉄道、秩父、遠州、平成筑豊、伊賀、和歌山、上信、小田急、東京メトロ、伊豆箱根、西武、大阪メトロ、愛知環状、伊豆急、京都丹後、青い森、肥薩おれんじ、神戸・京都市営、富山地方、山陽、豊橋、小湊、北陸、北九州、岳南、弘南、福井、アストラム、近江等の公式案内、および自治体の資料を確認した。各記録の出典は official-reference.json と verified.json に保存した。

例として、近江鉄道の[長谷野](https://www.ohmitetudo.co.jp/railway/ride/station/nagatanino/)は「ながたにの」、名古屋市交通局の[改称案内](https://www.kotsu.city.nagoya.jp/en/pc/OTHER/TRP0001448/Subway%20Station%20Name%20Change_.pdf)では太閤通が「たいこうどおり」。富山の加積各駅の「かずみ／かづみ」や江釣子の「えずりこ／えづりこ」は、音の違いではなく仮名表記の差として区別した。

読みの確認とは別に、次の10行を manual-reviews.json に分類した。この分類だけでは読みの正しさを確認したことにはならない。

- 東多良木・川村：くま川鉄道の[改称案内](https://kumagawa-rail.com/2026/09/19/4880/)を確認。多良木青蓮寺・相良十島への改称が必要で、後者は移転も確認が必要。
- 京成電鉄本社：駅ではなく本社施設。グラバースカイロードの2〜5階のりば4行も斜行エレベーターの乗降口。
- リニアの山梨県駅・長野県駅・岐阜県駅の仮称3行：建設中の計画駅。

これらを読みの訂正候補と混ぜないため pending.csv から分離した。駅名・座標・現在の読みが変わった場合、以前の判定では除外しない。未解決293行には松浦鉄道や名古屋市営の個別駅、廃線駅、未照合施設等が残っている。公式資料に読みがない場合やローマ字で長音を判別できない場合は、推測して確定していない。

## 記録と再現

- all.csv: 全8,340行の結果。元データ別の0始まりの行番号、座標、現在の読み、参照側の読み・コード・廃駅フラグを記録。
- different.csv: 不一致981件。unmatched.csv: 未照合136件。ambiguous.csv: 複数の読みの候補（今回0件）。
- summary.json: 集計と参照ファイルのSHA-256。
- reference.json: 参照資料を必要な列だけ抜粋した固定スナップショット。アプリには読み込まれない。
- official-reference.json: 取得した公式一覧から調査に用いた駅名・読みと出典URLを抽出した事実データ。ページ本文・画像は転載していない。
- official-checks.csv: 公式資料との照合3,595行。一致・誤読・空白差・公式表記差・出典間の不一致を区別する。
- verified.json / verified.csv: 一次資料で誤読を確認した782件の記録。
- pending.csv: 未解決の不一致・未照合候補293行。再生成時には確認済みの駅名・座標・現在値も照合する。
- manual-reviews.json: 改称・駅以外の施設・計画駅の分類10行。読みの正誤判定とは区別する。
- inputs.json: 調査時の入力ファイルのSHA-256。駅データを後から変更した場合の識別用。

駅名（参照側の original_name も対象）と1km以内の座標で照合する。完全一致で近接候補がない場合だけ、ヶ/ケと括弧内外の名称で候補を探し、match_method=name-variant を記録する。読みにはこの置換を使わない。

読みはNFKCとカタカナからひらがなへの変換だけ正規化する。長音・濁音・ヶの読みを推測して同一視しない。廃駅も候補に残して closed フラグを記録する。自動訂正はしない。

再現コマンド:

    python3 scripts/auditStationKana.py data/station-kana-audit/reference.json data/station-kana-audit

## 比較資料の出典

[Seo-4d696b75/station_database](https://github.com/Seo-4d696b75/station_database) out/main/station.csv、9,372行。Git blob SHA: b1d9bae160b2097a1472b29e4aabfca4b7a8419b。第三者データであり、鉄道会社の公式マスターではない。

© Seo-4d696b75/station_database contributors、[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。reference.json は列削減・形式変換を行ったもの。結果CSVの参照側項目もこの資料に基づく。元CSVのSHA-256: ebf14d235e3629a3aeb50d4137678fa8c38f3e7beab130e7bb9349337f2a3d4d。

## 残る調査

不一致候補の個別確認と未照合駅の調査は未完了。782件の確認をもって全駅の正誤確認完了とは扱わない。未解決候補は293行。記号・未変換漢字等を含む92行にも未確認のものが残る。
