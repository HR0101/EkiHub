import type { Messages } from "./ja";

/** English. Keys follow ja.ts — adding a key there surfaces the gap here. */
export const en: Messages = {
  hero: {
    badge: "EkiHub",
    titleBefore: "Find the ",
    titleAccent: "midpoint station",
    titleAfter: " for everyone",
    lead: "Enter everyone's nearest station and we'll suggest where to meet.",
  },

  nav: {
    howto: "How to use",
    home: "← Back to home",
  },

  form: {
    panelTitle: "Enter nearest stations",
    placeholder: "e.g. Shinjuku, Yokohama, Omiya…",
    stationLabel: "Nearest station",
    peopleLabel: "People",
    remove: "Remove this station",
    addStation: "＋ Add a station",
    modeTitle: "Narrow down candidates",
    modeAMain: "Major stations only",
    modeASub: "Large hubs like Shinjuku",
    modeBMain: "Any size",
    modeBSub: "Purely the time-based centre",
    weightTitle: "What matters most",
    weightAriaLabel: "Balance between fairness and closeness",
    weightNear: "Closeness",
    weightFair: "Fairness",
    weightLabels: {
      nearest: "Closeness first",
      nearer: "Leaning closeness",
      balanced: "Balanced",
      fairer: "Leaning fairness",
      fairest: "Fairness first",
    },
    fareTitle: "How much fares matter",
    fareLabels: {
      low: "Not at all",
      mid: "Somewhat",
      high: "A lot",
    },
    submit: "Find the midpoint station",
    computing: "Calculating…",
    stationsError: "Could not load station data. Please reload the page.",
  },

  steps: {
    ariaLabel: "Steps",
    origins: "Stations",
    originsHint: "Enter at least two nearest stations, one per person.",
    compute: "Calculate",
    computeHint: "Stations are ready. Press “Find the midpoint station”.",
    tune: "Adjust",
    tuneHint: "Change the filter or priorities to pick a different result.",
  },

  result: {
    emptyLine1: "Enter at least two stations,",
    emptyLine2: "then press Calculate.",
    emptyTitle: "Find where everyone should meet",
    emptyLead: "We suggest a station based on everyone's travel time and fare.",
    emptyPoint1: "Keeps the travel time even, so nobody is left far away",
    emptyPoint2: "Shows estimated fares and whether a direct train exists",
    emptyPoint3: "Finds places to gather around the chosen station",
    quickStartLabel: "Try an example",
    eyebrowBest: "Suggested midpoint station",
    eyebrowSelected: "Selected candidate",
    majorStation: "Major terminal",
    ridership: "approx. {man}0k passengers/day",
    avgMinutes: "Average travel (min)",
    fairness: "Spread of travel time",
    avgFare: "Average fare (est.)",
    distance: "Distance to centroid (km)",
    range: "Each member {min}–{max} min{transfers} {source}",
    transfers: " · avg. {count} transfers",
    sourceRouted: "(actual route data)",
    sourceGraph: "(rail network estimate)",
    sourceStraight: "(distance-based estimate)",
  },

  travel: {
    title: "Travel time from each station (estimated)",
    minutes: "{count} min",
    direct: "Direct",
    transfer: "{count} transfers",
  },

  ranking: {
    title: "Candidate ranking (click for details)",
    meta: "avg {minutes} min / ±{fairness}",
  },

  actions: {
    copyUrl: "Copy URL",
    copied: "Copied",
    copyFailed: "Could not copy",
    share: "Share",
    shareTitle: "EkiHub — the midpoint station",
    shareText: "Suggested meeting station: {name}",
    qr: "QR",
    qrAlt: "QR code for the shareable link",
    qrPreparing: "Preparing the QR code…",
    qrNote: "Scan with a phone to open the same conditions.",
    copySummary: "Copy result",
    print: "Print",
  },

  spots: {
    title: "Nearby places",
    categories: {
      cafe: "Cafés",
      restaurant: "Restaurants",
      fastfood: "Fast food",
      izakaya: "Bars & izakaya",
      karaoke: "Karaoke",
      convenience: "Convenience stores",
      park: "Parks",
    },
    radiusLabel: "Radius",
    chooseCategory: "Choose a category",
    searching: "Searching…",
    failed: "Could not load nearby places. Please try again later.",
    empty: "Nothing found within this radius.",
    more: "{count} more (showing top {limit})",
  },

  trainInfo: {
    title: "Rail service status",
    coverage: "Only lines provided via ODPT in the Tokyo area (not exhaustive)",
    refresh: "Refresh service status",
    loading: "Checking the latest status",
    preparing: "Service status is not available yet.",
    failed: "Could not load service status. Please refresh later.",
    none: "No disruptions on the covered lines.",
    updated: "Updated: {time}",
    creditProvider: "Public Transportation Open Data Center",
    creditBefore: "Transit data provided by ",
    creditAfter: ". Accuracy and completeness are not guaranteed.",
    contactBefore: "Please do not contact the operators directly — ",
    contactLink: "reach out to EkiHub instead",
    contactAfter: ".",
  },

  history: {
    button: "History",
    dialogLabel: "Calculation history",
    empty: "Your calculations will appear here.",
    addFavorite: "Add to favourites",
    removeFavorite: "Remove from favourites",
    remove: "Delete this entry",
  },

  theme: {
    button: "Theme",
    dialogLabel: "Theme settings",
    brightness: "Brightness",
    color: "Colour",
    modes: {
      light: "Light",
      dark: "Dark",
      auto: "Match device",
    },
    colors: {
      default: "Sky",
      sakura: "Sakura",
      forest: "Forest",
      ocean: "Ocean",
      sunset: "Sunset",
      autumn: "Autumn",
      "high-contrast": "High contrast",
    },
  },

  locale: {
    button: "Language",
    dialogLabel: "Language settings",
  },

  loading: {
    text: "Looking for a good station",
  },

  map: {
    ariaLabel: "Map of relative positions",
    loading: "Loading the map",
    origin: "Station {index}",
    originPeople: " · {count} people",
    centerBest: "Suggested midpoint station",
    centerSelected: "Selected candidate",
    centroid: "Geographic centroid of the entered stations",
    pinCenter: "Mid",
    pinCandidate: "Alt",
  },

  footer: {
    text: "EkiHub — midpoint suggestions from centroid and travel-time correction / Map data © OpenStreetMap contributors",
  },
};
