import type { Locale } from "@/i18n";

interface TourStep {
  title: string;
  description: string;
  tip: string;
}
interface TourCopy {
  title: string;
  lead: string;
  demo: string;
  sample: string;
  navigation: string;
  play: string;
  pause: string;
  replay: string;
  next: string;
  previous: string;
  reducedMotion: string;
  details: string;
  start: string;
  ready: string;
  suggestion: string;
  stationNames: [string, string, string, string];
  copyHint: string;
  steps: [TourStep, TourStep, TourStep, TourStep, TourStep];
}

export const HOWTO_TOUR: Record<Locale, TourCopy> = {
  ja: {
    title: "集合駅が決まるまで",
    lead: "駅を入れて、比べて、みんなに共有。操作の流れを見てみましょう。",
    demo: "操作イメージ",
    sample: "説明用のサンプルです。所要時間・運賃は検索条件によって変わります。",
    navigation: "説明するステップ",
    play: "再生する",
    pause: "一時停止",
    replay: "もう一度見る",
    next: "次へ",
    previous: "前へ",
    reducedMotion: "動きを抑えて表示しています。ステップを選んで進められます。",
    details: "文章で詳しく読む",
    start: "自分の駅で探す",
    ready: "次は、集まるみんなの駅で。",
    suggestion: "駅名を選んで確定",
    stationNames: ["新宿", "横浜", "武蔵小杉", "田園調布"],
    copyHint: "リンクをグループに送って、集合駅を相談できます",
    steps: [
      { title: "最寄駅を入力", description: "集まる人の最寄駅を、2駅以上入力します。", tip: "ひらがな・ローマ字でも検索できます。同じ駅から来る人は人数をまとめて指定。" },
      { title: "候補にする駅を選ぶ", description: "大きな駅だけで探すか、小さな駅も含めるかを選びます。", tip: "お店が多い駅で集まりたいときは「主要駅だけ」。近所の駅も候補にするなら「すべての駅」。" },
      { title: "重視ポイントを調整", description: "近さと公平さのバランスを変えられます。", tip: "特定の人だけ遠くなるのを避けたいときは公平さ寄りに。運賃の重視度も調整できます。" },
      { title: "集合駅の候補を比べる", description: "検索したら、移動時間と時間のばらつきを確認。別の候補も選べます。", tip: "候補駅を選ぶと、駅の詳細と地図が一緒に切り替わります。表示時間は概算です。" },
      { title: "リンクで共有", description: "「URLをコピー」で、選んだ駅と検索条件をまとめて共有できます。", tip: "リンクを開くと同じ条件で検索します。「その他」からQRコードも表示できます。" },
    ],
  },
  en: {
    title: "From stations to a meeting place",
    lead: "Enter your stations, compare the options and share a link. See how it works.",
    demo: "How it works", sample: "Illustrative example. Travel times and fares depend on your search.",
    navigation: "Guide steps", play: "Play", pause: "Pause", replay: "Watch again", next: "Next", previous: "Back",
    reducedMotion: "Reduced motion is on. Select a step to continue.", details: "Read the full guide", start: "Find your meeting station", ready: "Now try everyone's stations.", suggestion: "Select the station to confirm",
    stationNames: ["Shinjuku", "Yokohama", "Musashi-Kosugi", "Den-en-chofu"],
    copyHint: "Send the link to your group to discuss where to meet",
    steps: [
      { title: "Enter nearest stations", description: "Enter at least two stations, one for each starting point.", tip: "Kana and romaji work too. Set the number of people coming from the same station." },
      { title: "Choose the candidate stations", description: "Choose major stations, or include smaller local stations.", tip: "Major stations are useful for places with more shops. Choose all stations to include local options." },
      { title: "Set your priorities", description: "Adjust the balance between closeness and fairness.", tip: "Lean toward fairness to avoid one person travelling much further. You can also give fares more weight." },
      { title: "Compare meeting stations", description: "Search, check travel times and their spread, then compare other candidates.", tip: "Selecting a candidate updates its details and the map together. Times are estimates." },
      { title: "Share a link", description: "Copy the URL to share the selected station and search conditions.", tip: "Opening the link runs the same search. A QR code is available under More options." },
    ],
  },
  zh: {
    title: "一起选好集合车站",
    lead: "输入车站、比较候选，再分享给大家。看看具体如何操作。",
    demo: "操作演示", sample: "此为说明示例，时间和票价会随搜索条件而变化。", navigation: "使用步骤",
    play: "播放", pause: "暂停", replay: "重新观看", next: "下一步", previous: "上一步",
    reducedMotion: "已减少动态效果，请选择步骤继续。", details: "阅读详细说明", start: "用自己的车站搜索", ready: "接下来，用大家的车站试试。", suggestion: "选择车站以确认",
    stationNames: ["新宿", "横滨", "武藏小杉", "田园调布"], copyHint: "把链接发到群聊，一起商量集合车站",
    steps: [
      { title: "输入最近车站", description: "输入大家各自的出发车站，至少两个。", tip: "支持平假名和罗马字。同站出发的成员可以一起设置人数。" },
      { title: "选择候选范围", description: "可以只搜索主要车站，也可以包含小车站。", tip: "想在商店较多的车站集合，可选「仅主要车站」；想包含附近的小站，可选「所有车站」。" },
      { title: "调整优先事项", description: "调整距离与公平之间的平衡。", tip: "不想让某个人路途特别远时，可更重视公平；也可以调整票价的重视程度。" },
      { title: "比较集合车站", description: "搜索后查看时间和时间差，也可以选择其他候选车站。", tip: "选择候选车站时，详细信息和地图会同时更新。显示时间为估算值。" },
      { title: "分享链接", description: "复制链接即可分享选定车站和搜索条件。", tip: "打开链接时会按相同条件搜索。「更多操作」中还可以显示二维码。" },
    ],
  },
  ko: {
    title: "모일 역을 정하기까지",
    lead: "역을 입력하고, 후보를 비교하고, 모두에게 공유하세요. 이용 흐름을 살펴보세요.",
    demo: "이용 예시", sample: "설명용 예시입니다. 시간과 요금은 검색 조건에 따라 달라집니다.", navigation: "이용 단계",
    play: "재생", pause: "일시 정지", replay: "다시 보기", next: "다음", previous: "이전",
    reducedMotion: "동작을 줄여 표시합니다. 단계를 선택해 진행하세요.", details: "자세한 설명 읽기", start: "내 역으로 검색", ready: "이제 모두의 역으로 찾아보세요.", suggestion: "역을 선택해 확정",
    stationNames: ["신주쿠", "요코하마", "무사시코스기", "덴엔초후"], copyHint: "링크를 모임에 보내 만나기 좋은 역을 의논하세요",
    steps: [
      { title: "가까운 역 입력", description: "각자 출발할 역을 2개 이상 입력합니다.", tip: "히라가나와 로마자로도 검색할 수 있습니다. 같은 역에서 오는 사람은 인원을 함께 지정하세요." },
      { title: "후보 역 범위 선택", description: "주요 역만 찾거나 작은 역도 포함할 수 있습니다.", tip: "가게가 많은 곳에서 모이려면 주요 역만, 동네 역도 비교하려면 모든 역을 선택하세요." },
      { title: "중시할 점 조정", description: "가까움과 공평함의 균형을 조절합니다.", tip: "특정 사람만 멀어지는 것을 피하려면 공평함을 더 중시하세요. 요금의 비중도 조절할 수 있습니다." },
      { title: "모일 역 비교", description: "검색 후 이동 시간과 시간 차이를 보고 다른 후보도 선택하세요.", tip: "후보를 선택하면 역 정보와 지도가 함께 바뀝니다. 표시 시간은 추정치입니다." },
      { title: "링크로 공유", description: "URL을 복사해 선택한 역과 검색 조건을 공유합니다.", tip: "링크를 열면 같은 조건으로 검색합니다. 더 보기에서 QR 코드도 표시할 수 있습니다." },
    ],
  },
};
