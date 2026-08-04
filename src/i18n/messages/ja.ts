/**
 * 日本語の文言（この言語がマスター）。
 *
 * 画面に出す文字はすべてここに集め、コンポーネントからはキーで引く。
 * 他の言語ファイルはこの型に合わせるので、キーを足すと
 * 翻訳漏れがコンパイルエラーとして出る。
 */
export const ja = {
  hero: {
    badge: "EkiHub",
    titleBefore: "みんなの",
    titleAccent: "中心駅",
    titleAfter: "を探す",
    lead: "複数人の最寄駅を入力すると、全員が集まりやすい駅を提案します。",
  },

  nav: {
    howto: "使い方",
    home: "← ホームに戻る",
  },

  form: {
    panelTitle: "最寄駅を入力",
    placeholder: "例）新宿、横浜、大宮…",
    stationLabel: "最寄駅",
    peopleLabel: "人数",
    remove: "この駅を削除",
    addStation: "＋ 駅を追加",
    modeTitle: "候補の絞り込み",
    modeAMain: "主要駅限定",
    modeASub: "新宿・渋谷など大規模駅",
    modeBMain: "規模不問",
    modeBSub: "純粋に地理・時間の中心",
    weightTitle: "重視ポイント",
    weightAriaLabel: "重視ポイント（全員の公平さと近さのバランス）",
    weightNear: "近さ重視",
    weightFair: "公平さ重視",
    weightLabels: {
      nearest: "近さ最優先",
      nearer: "やや近さ重視",
      balanced: "バランス",
      fairer: "やや公平さ重視",
      fairest: "公平さ最優先",
    },
    fareTitle: "運賃の重視度",
    fareLabels: {
      low: "重視しない",
      mid: "やや重視",
      high: "重視",
    },
    submit: "中心駅を算出する",
    computing: "算出中…",
    stationsError: "駅データを読み込めませんでした。ページを再読み込みしてください。",
  },

  steps: {
    ariaLabel: "操作の手順",
    origins: "最寄駅",
    originsHint: "集まる人それぞれの最寄駅を、2駅以上入力してください。",
    compute: "算出",
    computeHint: "駅が揃いました。「中心駅を算出する」を押してください。",
    tune: "調整",
    tuneHint: "候補の絞り込みや重視ポイントを変えると、結果を選び直せます。",
  },

  result: {
    emptyLine1: "最寄駅を2駅以上入力して",
    emptyLine2: "「算出する」を押してください。",
    emptyTitle: "みんなの中心駅を見つけます",
    emptyLead: "全員の移動時間と運賃から、集まりやすい駅を提案します。",
    emptyPoint1: "遠い人が出ないよう、移動時間のばらつきを抑えます",
    emptyPoint2: "運賃の概算と、直通で行けるかどうかも表示します",
    emptyPoint3: "決まった駅の周辺から、集まれる場所を探せます",
    quickStartLabel: "例で試す",
    eyebrowBest: "提案された中心駅",
    eyebrowSelected: "選択中の候補駅",
    majorStation: "主要ターミナル駅",
    ridership: "乗降 約{man}万人/日",
    avgMinutes: "平均所要時間(分)",
    fairness: "時間のばらつき",
    avgFare: "平均運賃(概算)",
    distance: "重心までの距離(km)",
    range: "各メンバー {min}〜{max}分{transfers} {source}",
    transfers: " ・平均乗換 {count}回",
    sourceRouted: "（実経路データ）",
    sourceGraph: "（鉄道網ルート概算）",
    sourceStraight: "（距離からの概算）",
  },

  travel: {
    title: "各最寄駅からの所要時間（推定）",
    minutes: "{count}分",
    direct: "直通",
    transfer: "乗換{count}回",
  },

  ranking: {
    title: "候補駅ランキング（クリックで詳細を表示）",
    meta: "平均{minutes}分 / ±{fairness}",
  },

  actions: {
    copyUrl: "URLをコピー",
    copied: "コピーしました",
    copyFailed: "コピーできません",
    share: "共有",
    shareTitle: "EkiHub — みんなの中心駅",
    shareText: "集合駅の候補: {name}",
    qr: "QR",
    qrAlt: "この条件を開く共有リンクのQRコード",
    qrPreparing: "QRコードを準備しています…",
    qrNote: "スマートフォンで読み取ると、同じ条件で開けます。",
    copySummary: "結果をコピー",
    print: "印刷",
  },

  spots: {
    title: "周辺スポット",
    categories: {
      cafe: "カフェ",
      restaurant: "レストラン",
      fastfood: "ファストフード",
      izakaya: "居酒屋・バー",
      karaoke: "カラオケ",
      convenience: "コンビニ",
      park: "公園",
    },
    radiusLabel: "範囲",
    chooseCategory: "カテゴリを選んでください",
    searching: "探しています…",
    failed: "周辺スポットを取得できませんでした。時間をおいて試してください。",
    empty: "この範囲では見つかりませんでした。",
    more: "ほか {count} 件（上位{limit}件のみ表示）",
  },

  trainInfo: {
    title: "鉄道の運行情報",
    coverage: "首都圏のODPT提供路線のみ（全路線を網羅していません）",
    refresh: "運行情報を更新",
    loading: "最新情報を確認しています",
    preparing: "運行情報は現在準備中です。",
    failed: "運行情報を取得できませんでした。時間をおいて更新してください。",
    none: "提供中の路線に運行情報はありません。",
    updated: "更新: {time}",
    creditProvider: "公共交通オープンデータセンター",
    creditBefore: "公共交通データは ",
    creditAfter: " 提供。正確性・完全性は保証されません。",
    contactBefore: "内容について交通事業者へ直接問い合わせず、",
    contactLink: "EkiHubへお問い合わせください",
    contactAfter: "。",
  },

  history: {
    button: "履歴",
    dialogLabel: "算出履歴",
    empty: "算出するとここに履歴が残ります。",
    addFavorite: "お気に入りに追加",
    removeFavorite: "お気に入りから外す",
    remove: "この履歴を削除",
  },

  theme: {
    button: "テーマ",
    dialogLabel: "テーマ設定",
    brightness: "明るさ",
    color: "色",
    modes: {
      light: "ライト",
      dark: "ダーク",
      auto: "端末に合わせる",
    },
    colors: {
      default: "そら",
      sakura: "さくら",
      forest: "もり",
      ocean: "うみ",
      sunset: "ゆうやけ",
      autumn: "こうよう",
      "high-contrast": "高コントラスト",
    },
  },

  locale: {
    button: "言語",
    dialogLabel: "言語設定",
  },

  loading: {
    text: "ちょうどいい駅をさがしています",
  },

  map: {
    ariaLabel: "位置関係マップ",
    loading: "地図を読み込み中",
    origin: "最寄駅 {index}",
    originPeople: " ・{count}人",
    centerBest: "提案された中心駅",
    centerSelected: "選択中の候補駅",
    centroid: "入力駅の地理的重心",
    pinCenter: "中心",
    pinCandidate: "候補",
  },

  footer: {
    text: "EkiHub — 重心＋移動時間補正アルゴリズムによる中心駅提案 / 地図データ © OpenStreetMap contributors",
  },
} as const;

/**
 * 他の言語ファイルが従う形。
 *
 * ja は `as const` で書いてあるため、そのまま型にすると
 * 値まで日本語のリテラルとして固定されてしまう。
 * ここで文字列へ緩めることで「キーの構造は同じ・中身は自由」にしている。
 */
type DeepString<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepString<T[K]>;
};

export type Messages = DeepString<typeof ja>;
