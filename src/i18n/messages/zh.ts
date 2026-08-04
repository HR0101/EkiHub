import type { Messages } from "./ja";

/** 简体中文。键值结构与 ja.ts 一致。 */
export const zh: Messages = {
  hero: {
    badge: "EkiHub",
    titleBefore: "寻找大家的",
    titleAccent: "中心车站",
    titleAfter: "",
    lead: "输入每个人最近的车站，为大家推荐容易集合的地点。",
  },

  nav: {
    howto: "使用方法",
    home: "← 返回首页",
  },

  form: {
    panelTitle: "输入最近的车站",
    placeholder: "例）新宿、横滨、大宫…",
    stationLabel: "最近的车站",
    peopleLabel: "人数",
    remove: "删除此车站",
    addStation: "＋ 添加车站",
    modeTitle: "候选范围",
    modeAMain: "仅限主要车站",
    modeASub: "新宿、涩谷等大型车站",
    modeBMain: "不限规模",
    modeBSub: "纯粹的地理与时间中心",
    weightTitle: "优先事项",
    weightAriaLabel: "在公平与就近之间取得平衡",
    weightNear: "重视就近",
    weightFair: "重视公平",
    weightLabels: {
      nearest: "最优先就近",
      nearer: "略偏就近",
      balanced: "平衡",
      fairer: "略偏公平",
      fairest: "最优先公平",
    },
    fareTitle: "票价的重视程度",
    fareLabels: {
      low: "不重视",
      mid: "稍微重视",
      high: "重视",
    },
    submit: "计算中心车站",
    computing: "计算中…",
    stationsError: "无法载入车站数据，请重新载入页面。",
  },

  steps: {
    ariaLabel: "操作步骤",
    origins: "最近车站",
    originsHint: "请输入两个以上参加者的最近车站。",
    compute: "计算",
    computeHint: "车站已齐全，请点击「计算中心车站」。",
    tune: "调整",
    tuneHint: "更改候选范围或优先事项，可重新选择结果。",
  },

  result: {
    emptyLine1: "输入两个以上的车站后，",
    emptyLine2: "请点击「计算」。",
    emptyTitle: "为大家找出中心车站",
    emptyLead: "根据全员的移动时间与票价，推荐容易集合的车站。",
    emptyPoint1: "抑制移动时间的差距，避免某个人特别远",
    emptyPoint2: "显示票价估算，以及能否直达",
    emptyPoint3: "可在选定的车站周边寻找集合地点",
    quickStartLabel: "用示例试试",
    eyebrowBest: "推荐的中心车站",
    eyebrowSelected: "已选择的候选车站",
    majorStation: "主要枢纽车站",
    ridership: "客流约 {man} 万人次/日",
    avgMinutes: "平均所需时间(分)",
    fairness: "时间的离散程度",
    avgFare: "平均票价(估算)",
    distance: "到重心的距离(km)",
    range: "各成员 {min}〜{max} 分钟{transfers} {source}",
    transfers: " ・平均换乘 {count} 次",
    sourceRouted: "（实际路线数据）",
    sourceGraph: "（铁路网路线估算）",
    sourceStraight: "（按距离估算）",
  },

  travel: {
    title: "从各车站出发的所需时间（估算）",
    minutes: "{count} 分钟",
    direct: "直达",
    transfer: "换乘 {count} 次",
  },

  ranking: {
    title: "候选车站排名（点击查看详情）",
    meta: "平均 {minutes} 分 / ±{fairness}",
  },

  actions: {
    copyUrl: "复制链接",
    copied: "已复制",
    copyFailed: "无法复制",
    share: "分享",
    shareTitle: "EkiHub — 大家的中心车站",
    shareText: "推荐的集合车站：{name}",
    qr: "二维码",
    qrAlt: "打开相同条件的分享链接二维码",
    qrPreparing: "正在生成二维码…",
    qrNote: "用手机扫描即可以相同条件打开。",
    copySummary: "复制结果",
    print: "打印",
  },

  spots: {
    title: "周边地点",
    categories: {
      cafe: "咖啡厅",
      restaurant: "餐厅",
      fastfood: "快餐",
      izakaya: "居酒屋・酒吧",
      karaoke: "卡拉OK",
      convenience: "便利店",
      park: "公园",
    },
    radiusLabel: "范围",
    chooseCategory: "请选择类别",
    searching: "搜索中…",
    failed: "无法获取周边地点，请稍后再试。",
    empty: "此范围内没有找到。",
    more: "另有 {count} 处（仅显示前 {limit} 处）",
  },

  trainInfo: {
    title: "铁路运行信息",
    coverage: "仅限首都圈 ODPT 提供的线路（并非全部线路）",
    refresh: "更新运行信息",
    loading: "正在确认最新信息",
    preparing: "运行信息正在准备中。",
    failed: "无法获取运行信息，请稍后更新。",
    none: "所提供的线路没有异常信息。",
    updated: "更新：{time}",
    creditProvider: "公共交通开放数据中心",
    creditBefore: "公共交通数据由 ",
    creditAfter: " 提供。不保证准确性与完整性。",
    contactBefore: "请勿直接联系交通运营商，",
    contactLink: "请向 EkiHub 咨询",
    contactAfter: "。",
  },

  history: {
    button: "历史记录",
    dialogLabel: "计算历史",
    empty: "计算后会在此保留记录。",
    addFavorite: "加入收藏",
    removeFavorite: "取消收藏",
    remove: "删除此记录",
  },

  theme: {
    button: "主题",
    dialogLabel: "主题设置",
    brightness: "明暗",
    color: "颜色",
    modes: {
      light: "浅色",
      dark: "深色",
      auto: "跟随设备",
    },
    colors: {
      default: "天空",
      sakura: "樱",
      forest: "森",
      ocean: "海",
      sunset: "晚霞",
      autumn: "红叶",
      "high-contrast": "高对比度",
    },
  },

  locale: {
    button: "语言",
    dialogLabel: "语言设置",
  },

  loading: {
    text: "正在寻找合适的车站",
  },

  map: {
    ariaLabel: "位置关系地图",
    loading: "正在载入地图",
    origin: "最近车站 {index}",
    originPeople: " ・{count} 人",
    centerBest: "推荐的中心车站",
    centerSelected: "已选择的候选车站",
    centroid: "输入车站的地理重心",
    pinCenter: "中心",
    pinCandidate: "候选",
  },

  footer: {
    text: "EkiHub — 基于重心与移动时间修正算法的中心车站推荐 / 地图数据 © OpenStreetMap contributors",
  },
};
