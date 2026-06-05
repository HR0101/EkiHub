// 駅マスタデータ（埋め込み・自己完結用）
// 各駅: name(駅名), kana(読み), lat(緯度), lng(経度),
//        lines(主要路線), ridership(1日あたり乗降客数の概数・単位:人),
//        isMajor(主要ターミナル駅フラグ)
//
// ridership は「モードA（主要駅限定）」の候補絞り込みにも利用する.
// ODPTなど外部APIで全駅へ拡張する場合は、同じ形式の配列を生成して
// この配列とマージすれば良い（server.js の mergeStations を参照）.

export const MAJOR_RIDERSHIP_THRESHOLD = 200000; // モードA候補とみなす乗降客数の下限

export const stations = [
  // ─── 山手線・主要ターミナル ───────────────────────────────
  { name: "新宿",       kana: "しんじゅく",     lat: 35.690921, lng: 139.700258, lines: ["JR山手線", "JR中央線", "小田急", "京王", "都営新宿線", "丸ノ内線"], ridership: 1500000, isMajor: true },
  { name: "渋谷",       kana: "しぶや",         lat: 35.658034, lng: 139.701636, lines: ["JR山手線", "東急東横線", "東急田園都市線", "京王井の頭線", "半蔵門線", "副都心線"], ridership: 1100000, isMajor: true },
  { name: "池袋",       kana: "いけぶくろ",     lat: 35.728926, lng: 139.71038,  lines: ["JR山手線", "東武東上線", "西武池袋線", "丸ノ内線", "有楽町線", "副都心線"], ridership: 1000000, isMajor: true },
  { name: "東京",       kana: "とうきょう",     lat: 35.681382, lng: 139.766084, lines: ["JR各線", "東海道新幹線", "丸ノ内線"], ridership: 870000, isMajor: true },
  { name: "品川",       kana: "しながわ",       lat: 35.62876,  lng: 139.73876,  lines: ["JR各線", "京急本線", "東海道新幹線"], ridership: 650000, isMajor: true },
  { name: "上野",       kana: "うえの",         lat: 35.713768, lng: 139.777254, lines: ["JR各線", "東北新幹線", "銀座線", "日比谷線"], ridership: 500000, isMajor: true },
  { name: "新橋",       kana: "しんばし",       lat: 35.665498, lng: 139.75964,  lines: ["JR各線", "銀座線", "都営浅草線", "ゆりかもめ"], ridership: 500000, isMajor: true },
  { name: "秋葉原",     kana: "あきはばら",     lat: 35.698683, lng: 139.774219, lines: ["JR各線", "日比谷線", "つくばエクスプレス"], ridership: 480000, isMajor: true },
  { name: "高田馬場",   kana: "たかだのばば",   lat: 35.712285, lng: 139.703782, lines: ["JR山手線", "西武新宿線", "東西線"], ridership: 280000, isMajor: true },
  { name: "目黒",       kana: "めぐろ",         lat: 35.633998, lng: 139.715828, lines: ["JR山手線", "東急目黒線", "南北線", "都営三田線"], ridership: 230000, isMajor: true },
  { name: "五反田",     kana: "ごたんだ",       lat: 35.625974, lng: 139.723822, lines: ["JR山手線", "東急池上線", "都営浅草線"], ridership: 220000, isMajor: true },
  { name: "大崎",       kana: "おおさき",       lat: 35.61969,  lng: 139.728439, lines: ["JR山手線", "りんかい線"], ridership: 200000, isMajor: true },
  { name: "恵比寿",     kana: "えびす",         lat: 35.646685, lng: 139.710106, lines: ["JR山手線", "日比谷線"], ridership: 280000, isMajor: true },
  { name: "田町",       kana: "たまち",         lat: 35.645736, lng: 139.747575, lines: ["JR山手線", "JR京浜東北線"], ridership: 240000, isMajor: true },
  { name: "浜松町",     kana: "はままつちょう", lat: 35.655646, lng: 139.756749, lines: ["JR山手線", "東京モノレール", "都営浅草線"], ridership: 250000, isMajor: true },
  { name: "有楽町",     kana: "ゆうらくちょう", lat: 35.675069, lng: 139.763328, lines: ["JR山手線", "有楽町線"], ridership: 250000, isMajor: true },
  { name: "神田",       kana: "かんだ",         lat: 35.69169,  lng: 139.770883, lines: ["JR各線", "銀座線"], ridership: 230000, isMajor: true },
  { name: "御茶ノ水",   kana: "おちゃのみず",   lat: 35.699739, lng: 139.765071, lines: ["JR中央線", "丸ノ内線"], ridership: 270000, isMajor: true },
  { name: "巣鴨",       kana: "すがも",         lat: 35.733492, lng: 139.739345, lines: ["JR山手線", "都営三田線"], ridership: 150000, isMajor: false },
  { name: "駒込",       kana: "こまごめ",       lat: 35.736842, lng: 139.748053, lines: ["JR山手線", "南北線"], ridership: 100000, isMajor: false },
  { name: "日暮里",     kana: "にっぽり",       lat: 35.727908, lng: 139.770981, lines: ["JR山手線", "京成本線", "日暮里舎人ライナー"], ridership: 230000, isMajor: true },
  { name: "鶯谷",       kana: "うぐいすだに",   lat: 35.720495, lng: 139.778837, lines: ["JR山手線"], ridership: 50000, isMajor: false },
  { name: "大塚",       kana: "おおつか",       lat: 35.731412, lng: 139.728584, lines: ["JR山手線", "都電荒川線"], ridership: 120000, isMajor: false },
  { name: "新大久保",   kana: "しんおおくぼ",   lat: 35.701306, lng: 139.700044, lines: ["JR山手線"], ridership: 100000, isMajor: false },
  { name: "原宿",       kana: "はらじゅく",     lat: 35.670646, lng: 139.702592, lines: ["JR山手線", "千代田線(明治神宮前)"], ridership: 150000, isMajor: false },

  // ─── 中央線（西方面） ─────────────────────────────────────
  { name: "中野",       kana: "なかの",         lat: 35.705751, lng: 139.665742, lines: ["JR中央線", "東西線"], ridership: 280000, isMajor: true },
  { name: "高円寺",     kana: "こうえんじ",     lat: 35.705478, lng: 139.649694, lines: ["JR中央線"], ridership: 90000, isMajor: false },
  { name: "阿佐ヶ谷",   kana: "あさがや",       lat: 35.704917, lng: 139.635983, lines: ["JR中央線"], ridership: 90000, isMajor: false },
  { name: "荻窪",       kana: "おぎくぼ",       lat: 35.704506, lng: 139.620061, lines: ["JR中央線", "丸ノ内線"], ridership: 170000, isMajor: false },
  { name: "吉祥寺",     kana: "きちじょうじ",   lat: 35.703119, lng: 139.579772, lines: ["JR中央線", "京王井の頭線"], ridership: 280000, isMajor: true },
  { name: "三鷹",       kana: "みたか",         lat: 35.702683, lng: 139.560517, lines: ["JR中央線"], ridership: 180000, isMajor: false },
  { name: "国分寺",     kana: "こくぶんじ",     lat: 35.700114, lng: 139.480642, lines: ["JR中央線", "西武国分寺線"], ridership: 250000, isMajor: true },
  { name: "立川",       kana: "たちかわ",       lat: 35.698545, lng: 139.413828, lines: ["JR中央線", "JR南武線", "多摩モノレール"], ridership: 320000, isMajor: true },

  // ─── 東京西部・私鉄ターミナル ─────────────────────────────
  { name: "下北沢",     kana: "しもきたざわ",   lat: 35.661333, lng: 139.667314, lines: ["小田急", "京王井の頭線"], ridership: 250000, isMajor: true },
  { name: "三軒茶屋",   kana: "さんげんぢゃや", lat: 35.643424, lng: 139.66951,  lines: ["東急田園都市線", "東急世田谷線"], ridership: 130000, isMajor: false },
  { name: "二子玉川",   kana: "ふたこたまがわ", lat: 35.611893, lng: 139.626159, lines: ["東急田園都市線", "東急大井町線"], ridership: 150000, isMajor: false },
  { name: "自由が丘",   kana: "じゆうがおか",   lat: 35.607565, lng: 139.668918, lines: ["東急東横線", "東急大井町線"], ridership: 140000, isMajor: false },
  { name: "中目黒",     kana: "なかめぐろ",     lat: 35.644483, lng: 139.69937,  lines: ["東急東横線", "日比谷線"], ridership: 200000, isMajor: true },
  { name: "明大前",     kana: "めいだいまえ",   lat: 35.668242, lng: 139.649072, lines: ["京王線", "京王井の頭線"], ridership: 110000, isMajor: false },
  { name: "成城学園前", kana: "せいじょうがくえんまえ", lat: 35.640698, lng: 139.598989, lines: ["小田急"], ridership: 90000, isMajor: false },
  { name: "調布",       kana: "ちょうふ",       lat: 35.652163, lng: 139.544671, lines: ["京王線", "京王相模原線"], ridership: 240000, isMajor: true },

  // ─── 城東・副都心 ─────────────────────────────────────────
  { name: "錦糸町",     kana: "きんしちょう",   lat: 35.696889, lng: 139.814247, lines: ["JR総武線", "半蔵門線"], ridership: 240000, isMajor: true },
  { name: "北千住",     kana: "きたせんじゅ",   lat: 35.749081, lng: 139.804813, lines: ["JR常磐線", "東武スカイツリーライン", "日比谷線", "千代田線", "つくばエクスプレス"], ridership: 450000, isMajor: true },
  { name: "押上",       kana: "おしあげ",       lat: 35.710344, lng: 139.81337,  lines: ["半蔵門線", "都営浅草線", "東武スカイツリーライン", "京成押上線"], ridership: 200000, isMajor: true },
  { name: "亀戸",       kana: "かめいど",       lat: 35.697574, lng: 139.826535, lines: ["JR総武線", "東武亀戸線"], ridership: 110000, isMajor: false },
  { name: "豊洲",       kana: "とよす",         lat: 35.654755, lng: 139.79655,  lines: ["有楽町線", "ゆりかもめ"], ridership: 230000, isMajor: true },
  { name: "門前仲町",   kana: "もんぜんなかちょう", lat: 35.671792, lng: 139.796906, lines: ["東西線", "都営大江戸線"], ridership: 130000, isMajor: false },
  { name: "両国",       kana: "りょうごく",     lat: 35.696012, lng: 139.793173, lines: ["JR総武線", "都営大江戸線"], ridership: 90000, isMajor: false },
  { name: "飯田橋",     kana: "いいだばし",     lat: 35.701974, lng: 139.744977, lines: ["JR総武線", "東西線", "有楽町線", "南北線", "都営大江戸線"], ridership: 250000, isMajor: true },
  { name: "市ヶ谷",     kana: "いちがや",       lat: 35.691108, lng: 139.735224, lines: ["JR総武線", "有楽町線", "南北線", "都営新宿線"], ridership: 200000, isMajor: true },
  { name: "四ツ谷",     kana: "よつや",         lat: 35.686097, lng: 139.730407, lines: ["JR中央線", "丸ノ内線", "南北線"], ridership: 220000, isMajor: true },
  { name: "後楽園",     kana: "こうらくえん",   lat: 35.707892, lng: 139.751731, lines: ["丸ノ内線", "南北線"], ridership: 120000, isMajor: false },

  // ─── 城南・神奈川方面 ─────────────────────────────────────
  { name: "蒲田",       kana: "かまた",         lat: 35.562479, lng: 139.71608,  lines: ["JR京浜東北線", "東急池上線", "東急多摩川線"], ridership: 280000, isMajor: true },
  { name: "大井町",     kana: "おおいまち",     lat: 35.606532, lng: 139.734291, lines: ["JR京浜東北線", "東急大井町線", "りんかい線"], ridership: 240000, isMajor: true },
  { name: "武蔵小杉",   kana: "むさしこすぎ",   lat: 35.576236, lng: 139.659445, lines: ["JR各線", "東急東横線", "東急目黒線"], ridership: 400000, isMajor: true },
  { name: "横浜",       kana: "よこはま",       lat: 35.465777, lng: 139.622453, lines: ["JR各線", "東急東横線", "京急本線", "相鉄線", "横浜市営地下鉄"], ridership: 760000, isMajor: true },
  { name: "川崎",       kana: "かわさき",       lat: 35.531257, lng: 139.696744, lines: ["JR各線"], ridership: 420000, isMajor: true },

  // ─── 埼玉・千葉方面 ───────────────────────────────────────
  { name: "大宮",       kana: "おおみや",       lat: 35.906291, lng: 139.623684, lines: ["JR各線", "東北新幹線", "東武野田線"], ridership: 650000, isMajor: true },
  { name: "浦和",       kana: "うらわ",         lat: 35.860835, lng: 139.657162, lines: ["JR各線"], ridership: 180000, isMajor: false },
  { name: "赤羽",       kana: "あかばね",       lat: 35.778053, lng: 139.721156, lines: ["JR各線"], ridership: 240000, isMajor: true },
  { name: "西船橋",     kana: "にしふなばし",   lat: 35.707763, lng: 139.96094,  lines: ["JR総武線", "東西線", "東葉高速線", "武蔵野線"], ridership: 280000, isMajor: true },
  { name: "船橋",       kana: "ふなばし",       lat: 35.701736, lng: 139.985281, lines: ["JR総武線", "東武野田線", "京成本線"], ridership: 280000, isMajor: true },
  { name: "千葉",       kana: "ちば",           lat: 35.613165, lng: 140.113287, lines: ["JR各線", "千葉都市モノレール"], ridership: 200000, isMajor: true },
  { name: "柏",         kana: "かしわ",         lat: 35.862096, lng: 139.970917, lines: ["JR常磐線", "東武野田線"], ridership: 240000, isMajor: true },
  { name: "町田",       kana: "まちだ",         lat: 35.541056, lng: 139.446658, lines: ["JR横浜線", "小田急"], ridership: 290000, isMajor: true },

  // ─── その他主要 ───────────────────────────────────────────
  { name: "表参道",     kana: "おもてさんどう", lat: 35.665247, lng: 139.71245,  lines: ["銀座線", "半蔵門線", "千代田線"], ridership: 230000, isMajor: true },
  { name: "六本木",     kana: "ろっぽんぎ",     lat: 35.662836, lng: 139.731443, lines: ["日比谷線", "都営大江戸線"], ridership: 180000, isMajor: false },
  { name: "大手町",     kana: "おおてまち",     lat: 35.686614, lng: 139.766084, lines: ["丸ノ内線", "東西線", "千代田線", "半蔵門線", "都営三田線"], ridership: 350000, isMajor: true },
  { name: "銀座",       kana: "ぎんざ",         lat: 35.671989, lng: 139.76506,  lines: ["銀座線", "丸ノ内線", "日比谷線"], ridership: 250000, isMajor: true },

  // ─── 千葉エリア（拡張） ───────────────────────────────────
  { name: "海浜幕張",   kana: "かいひんまくはり", lat: 35.648434, lng: 140.034717, lines: ["JR京葉線"], ridership: 120000, isMajor: false },
  { name: "幕張",       kana: "まくはり",       lat: 35.661911, lng: 140.060947, lines: ["JR総武線"], ridership: 30000, isMajor: false },
  { name: "幕張本郷",   kana: "まくはりほんごう", lat: 35.66805,  lng: 140.045438, lines: ["JR総武線", "京成千葉線"], ridership: 60000, isMajor: false },
  { name: "津田沼",     kana: "つだぬま",       lat: 35.688149, lng: 140.019547, lines: ["JR総武線", "JR総武快速線"], ridership: 200000, isMajor: true },
  { name: "稲毛",       kana: "いなげ",         lat: 35.635214, lng: 140.082966, lines: ["JR総武線"], ridership: 90000, isMajor: false },
  { name: "新浦安",     kana: "しんうらやす",   lat: 35.659542, lng: 139.916123, lines: ["JR京葉線"], ridership: 100000, isMajor: false },
  { name: "舞浜",       kana: "まいはま",       lat: 35.635805, lng: 139.880975, lines: ["JR京葉線"], ridership: 120000, isMajor: false },
  { name: "市川",       kana: "いちかわ",       lat: 35.731088, lng: 139.907235, lines: ["JR総武線", "JR総武快速線"], ridership: 140000, isMajor: false },
  { name: "本八幡",     kana: "もとやわた",     lat: 35.721635, lng: 139.928944, lines: ["JR総武線", "都営新宿線", "京成八幡"], ridership: 130000, isMajor: false },
  { name: "松戸",       kana: "まつど",         lat: 35.78564,  lng: 139.901089, lines: ["JR常磐線", "新京成線"], ridership: 220000, isMajor: true },

  // ─── 埼玉エリア（拡張） ───────────────────────────────────
  { name: "川口",       kana: "かわぐち",       lat: 35.80747,  lng: 139.720729, lines: ["JR京浜東北線"], ridership: 170000, isMajor: false },
  { name: "南浦和",     kana: "みなみうらわ",   lat: 35.839748, lng: 139.66946,  lines: ["JR京浜東北線", "JR武蔵野線"], ridership: 140000, isMajor: false },
  { name: "武蔵浦和",   kana: "むさしうらわ",   lat: 35.846543, lng: 139.643021, lines: ["JR埼京線", "JR武蔵野線"], ridership: 120000, isMajor: false },
  { name: "和光市",     kana: "わこうし",       lat: 35.78468,  lng: 139.605163, lines: ["東武東上線", "有楽町線", "副都心線"], ridership: 170000, isMajor: false },
  { name: "所沢",       kana: "ところざわ",     lat: 35.799396, lng: 139.469075, lines: ["西武池袋線", "西武新宿線"], ridership: 230000, isMajor: true },
  { name: "越谷",       kana: "こしがや",       lat: 35.891239, lng: 139.790698, lines: ["東武スカイツリーライン"], ridership: 90000, isMajor: false },
  { name: "春日部",     kana: "かすかべ",       lat: 35.975205, lng: 139.752073, lines: ["東武スカイツリーライン", "東武野田線"], ridership: 120000, isMajor: false },

  // ─── 神奈川エリア（拡張） ─────────────────────────────────
  { name: "新横浜",     kana: "しんよこはま",   lat: 35.50745,  lng: 139.617056, lines: ["JR横浜線", "東海道新幹線", "横浜市営地下鉄", "東急新横浜線"], ridership: 320000, isMajor: true },
  { name: "鶴見",       kana: "つるみ",         lat: 35.507665, lng: 139.676863, lines: ["JR京浜東北線", "JR鶴見線"], ridership: 170000, isMajor: false },
  { name: "戸塚",       kana: "とつか",         lat: 35.40058,  lng: 139.53413,  lines: ["JR東海道線", "JR横須賀線", "横浜市営地下鉄"], ridership: 280000, isMajor: true },
  { name: "大船",       kana: "おおふな",       lat: 35.351399, lng: 139.531884, lines: ["JR東海道線", "JR横須賀線", "湘南モノレール"], ridership: 230000, isMajor: true },
  { name: "藤沢",       kana: "ふじさわ",       lat: 35.338637, lng: 139.487759, lines: ["JR東海道線", "小田急江ノ島線", "江ノ電"], ridership: 280000, isMajor: true },
  { name: "鎌倉",       kana: "かまくら",       lat: 35.319042, lng: 139.55008,  lines: ["JR横須賀線", "江ノ電"], ridership: 100000, isMajor: false },
  { name: "本厚木",     kana: "ほんあつぎ",     lat: 35.43855,  lng: 139.365171, lines: ["小田急"], ridership: 280000, isMajor: true },
  { name: "海老名",     kana: "えびな",         lat: 35.451963, lng: 139.390298, lines: ["小田急", "相鉄線", "JR相模線"], ridership: 250000, isMajor: true },
  { name: "中央林間",   kana: "ちゅうおうりんかん", lat: 35.50931, lng: 139.444894, lines: ["東急田園都市線", "小田急江ノ島線"], ridership: 150000, isMajor: false },
  { name: "たまプラーザ", kana: "たまぷらーざ", lat: 35.578548, lng: 139.561005, lines: ["東急田園都市線"], ridership: 160000, isMajor: false },

  // ─── 多摩・東京西部（拡張） ───────────────────────────────
  { name: "八王子",     kana: "はちおうじ",     lat: 35.65557,  lng: 139.338998, lines: ["JR中央線", "JR横浜線", "JR八高線"], ridership: 240000, isMajor: true },
  { name: "多摩センター", kana: "たません",     lat: 35.624858, lng: 139.42064,  lines: ["京王相模原線", "小田急多摩線", "多摩モノレール"], ridership: 150000, isMajor: false },
  { name: "府中",       kana: "ふちゅう",       lat: 35.671988, lng: 139.480257, lines: ["京王線"], ridership: 110000, isMajor: false },
  { name: "分倍河原",   kana: "ぶばいがわら",   lat: 35.663607, lng: 139.471548, lines: ["京王線", "JR南武線"], ridership: 100000, isMajor: false },
  { name: "拝島",       kana: "はいじま",       lat: 35.71759,  lng: 139.353601, lines: ["JR青梅線", "JR五日市線", "西武拝島線"], ridership: 80000, isMajor: false },
  { name: "聖蹟桜ヶ丘", kana: "せいせきさくらがおか", lat: 35.650607, lng: 139.446694, lines: ["京王線"], ridership: 80000, isMajor: false }
];
