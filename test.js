import { computeCenterStation } from "./lib/centerLogic.js";
import { stations as embeddedStations } from "./data/stations.js";
import { readFileSync, existsSync } from "fs";

function loadOsmStations() {
  const path = "data/stations-osm.json";
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf-8"));
}

const osmStations = loadOsmStations();

function loadRidershipMap() {
  const path = "data/ridership.json";
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf-8"));
}

const ridershipMap = loadRidershipMap();
const MAJOR_THRESHOLD = 200000;
const EXTRA_MAJOR_STATIONS = new Set([
  "札幌", "青森", "盛岡", "仙台", "秋田", "山形", "福島",
  "新潟", "富山", "金沢", "福井", "甲府", "長野",
  "岐阜", "静岡", "浜松", "名古屋", "豊橋",
  "津", "大津", "京都", "大阪", "新大阪", "天王寺", "難波", "なんば", "京橋",
  "神戸", "三ノ宮", "姫路", "奈良", "和歌山",
  "鳥取", "松江", "岡山", "倉敷", "広島", "福山", "山口", "新山口",
  "徳島", "高松", "松山", "高知",
  "福岡", "博多", "小倉", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島中央", "那覇空港"
]);

function mergeStations(base, extra) {
  const map = new Map();
  for (const s of base) map.set(s.name, s);
  for (const s of extra) {
    if (!map.has(s.name)) map.set(s.name, s);
  }
  return Array.from(map.values());
}

function applyRidership(stations) {
  for (const s of stations) {
    const measured = ridershipMap[s.name];
    if (typeof measured === "number" && measured > 0) s.ridership = measured;
    s.isMajor = s.isMajor === true || s.ridership >= MAJOR_THRESHOLD || EXTRA_MAJOR_STATIONS.has(s.name);
  }
  return stations;
}

const allStations = applyRidership(mergeStations(embeddedStations, osmStations));
const originStations = allStations.filter(s => s.name === "鎌ヶ谷" || s.name === "塚田").map(s => ({ ...s, people: 1 }));

async function run() {
  try {
    const result = await computeCenterStation({
      originStations,
      allStations,
      mode: "A",
      routeProvider: null,
    });
    console.log("BEST:", result.best.name, result.best.score);
    console.log("TOP 5:", result.ranking.slice(0, 5).map(r => r.name));
    console.log(result.ranking.slice(0, 5).map(r => r.travelTimes));
  } catch (err) {
    console.error(err);
  }
}
run();
