import type { Messages } from "./ja";

/** 한국어. 키 구조는 ja.ts와 동일합니다. */
export const ko: Messages = {
  hero: {
    badge: "EkiHub",
    titleBefore: "모두의 ",
    titleAccent: "중심역",
    titleAfter: " 찾기",
    lead: "각자의 가까운 역을 입력하면 모두가 모이기 좋은 역을 제안합니다.",
  },

  nav: {
    howto: "사용 방법",
    home: "← 홈으로 돌아가기",
  },

  form: {
    panelTitle: "가까운 역 입력",
    placeholder: "예) 신주쿠, 요코하마, 오미야…",
    stationLabel: "가까운 역",
    peopleLabel: "인원",
    remove: "이 역 삭제",
    addStation: "＋ 역 추가",
    modeTitle: "후보 범위",
    modeAMain: "주요역만",
    modeASub: "신주쿠·시부야 등 대형역",
    modeBMain: "규모 무관",
    modeBSub: "순수한 지리·시간의 중심",
    weightTitle: "중시할 점",
    weightAriaLabel: "공평함과 가까움의 균형",
    weightNear: "가까움 중시",
    weightFair: "공평함 중시",
    weightLabels: {
      nearest: "가까움 최우선",
      nearer: "가까움에 치우침",
      balanced: "균형",
      fairer: "공평함에 치우침",
      fairest: "공평함 최우선",
    },
    fareTitle: "요금 중시도",
    fareLabels: {
      low: "중시하지 않음",
      mid: "조금 중시",
      high: "중시",
    },
    submit: "중심역 계산하기",
    computing: "계산 중…",
    stationsError: "역 데이터를 불러오지 못했습니다. 페이지를 새로고침해 주세요.",
  },

  steps: {
    ariaLabel: "이용 순서",
    origins: "가까운 역",
    originsHint: "모이는 사람 각자의 가까운 역을 2개 이상 입력해 주세요.",
    compute: "계산",
    computeHint: "역이 모두 입력되었습니다. “중심역 계산하기”를 눌러 주세요.",
    tune: "조정",
    tuneHint: "후보 범위나 중시할 점을 바꾸면 결과를 다시 고를 수 있습니다.",
  },

  result: {
    emptyLine1: "역을 2개 이상 입력한 뒤",
    emptyLine2: "“계산하기”를 눌러 주세요.",
    eyebrowBest: "제안된 중심역",
    eyebrowSelected: "선택한 후보역",
    majorStation: "주요 터미널역",
    ridership: "이용객 약 {man}만 명/일",
    avgMinutes: "평균 소요 시간(분)",
    fairness: "시간의 편차",
    avgFare: "평균 요금(추정)",
    distance: "무게중심까지의 거리(km)",
    range: "각 구성원 {min}〜{max}분{transfers} {source}",
    transfers: " ・평균 환승 {count}회",
    sourceRouted: "(실제 경로 데이터)",
    sourceGraph: "(철도망 경로 추정)",
    sourceStraight: "(거리 기반 추정)",
  },

  travel: {
    title: "각 역에서의 소요 시간(추정)",
    minutes: "{count}분",
    direct: "직통",
    transfer: "환승 {count}회",
  },

  ranking: {
    title: "후보역 순위 (클릭하면 상세 표시)",
    meta: "평균 {minutes}분 / ±{fairness}",
  },

  actions: {
    copyUrl: "URL 복사",
    copied: "복사했습니다",
    copyFailed: "복사할 수 없습니다",
    share: "공유",
    shareTitle: "EkiHub — 모두의 중심역",
    shareText: "추천 집합역: {name}",
    qr: "QR",
    qrAlt: "같은 조건으로 여는 공유 링크 QR 코드",
    qrPreparing: "QR 코드를 준비하고 있습니다…",
    qrNote: "휴대폰으로 읽으면 같은 조건으로 열립니다.",
    copySummary: "결과 복사",
    print: "인쇄",
  },

  spots: {
    title: "주변 장소",
    categories: {
      cafe: "카페",
      restaurant: "레스토랑",
      fastfood: "패스트푸드",
      izakaya: "이자카야·바",
      karaoke: "노래방",
      convenience: "편의점",
      park: "공원",
    },
    radiusLabel: "범위",
    chooseCategory: "카테고리를 선택해 주세요",
    searching: "찾는 중…",
    failed: "주변 장소를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    empty: "이 범위에서는 찾지 못했습니다.",
    more: "그 외 {count}곳 (상위 {limit}곳만 표시)",
  },

  trainInfo: {
    title: "철도 운행 정보",
    coverage: "수도권 ODPT 제공 노선만 (모든 노선을 포함하지 않습니다)",
    refresh: "운행 정보 갱신",
    loading: "최신 정보를 확인하고 있습니다",
    preparing: "운행 정보는 현재 준비 중입니다.",
    failed: "운행 정보를 가져오지 못했습니다. 잠시 후 갱신해 주세요.",
    none: "제공 중인 노선에 운행 정보가 없습니다.",
    updated: "갱신: {time}",
    creditProvider: "공공교통 오픈데이터 센터",
    creditBefore: "대중교통 데이터는 ",
    creditAfter: " 제공. 정확성과 완전성은 보장되지 않습니다.",
    contactBefore: "내용에 대해 교통사업자에게 직접 문의하지 마시고, ",
    contactLink: "EkiHub로 문의해 주세요",
    contactAfter: ".",
  },

  history: {
    button: "기록",
    dialogLabel: "계산 기록",
    empty: "계산하면 여기에 기록이 남습니다.",
    addFavorite: "즐겨찾기에 추가",
    removeFavorite: "즐겨찾기에서 제거",
    remove: "이 기록 삭제",
  },

  theme: {
    button: "테마",
    dialogLabel: "테마 설정",
    brightness: "밝기",
    color: "색",
    modes: {
      light: "라이트",
      dark: "다크",
      auto: "기기 설정에 맞춤",
    },
    colors: {
      default: "하늘색",
      sakura: "벚꽃",
      forest: "숲",
      ocean: "바다",
      sunset: "노을",
      autumn: "단풍",
      "high-contrast": "고대비",
    },
  },

  locale: {
    button: "언어",
    dialogLabel: "언어 설정",
  },

  loading: {
    text: "알맞은 역을 찾고 있습니다",
  },

  map: {
    ariaLabel: "위치 관계 지도",
    loading: "지도를 불러오는 중",
    origin: "가까운 역 {index}",
    originPeople: " ・{count}명",
    centerBest: "제안된 중심역",
    centerSelected: "선택한 후보역",
    centroid: "입력한 역들의 지리적 무게중심",
    pinCenter: "중심",
    pinCandidate: "후보",
  },

  footer: {
    text: "EkiHub — 무게중심과 이동시간 보정 알고리즘에 의한 중심역 제안 / 지도 데이터 © OpenStreetMap contributors",
  },
};
