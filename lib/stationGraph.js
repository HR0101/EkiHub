// 駅ネットワークグラフ
// 役割: 既存の全駅座標から「近接グラフ」を構築し、鉄道網に近い最短経路で
//       駅間の所要時間(分)・距離(m)を近似する.
//
// 設計の要点:
//   - 各駅を「最寄りK駅」かつ「1エッジ最大CAP_M以内」で結ぶ.
//   - CAP_M(=12km)が東京湾横断(約30km)のような水上ショートカットを物理的に排除する.
//     これにより重心が海上に出ても海を渡る経路が生まれず、海上重心問題が根治する.
//   - 駅間距離(haversine)を走行速度で時間換算し、ホップ毎に停車オーバーヘッドを足す.
//     2つの係数は乗換案内の代表区間に合わせて決めている(tests/travelTimeEstimate.test.ts).
//   - 新快速が走る関西・名古屋の区間だけは、路線データ(data/rail-lines.json)から停車駅どうしを
//     直接結ぶ「快速の辺」を足し、各停を辿るより速い経路を表す. 線路のある区間だけを結ぶので、
//     海を渡るショートカットは生まれない.
//
// 経路API(OTP)が無くても自己完結で動き、OTPがあれば centerLogic 側で finalists のみ
// 実データへ精緻化する(本モジュールは概算ネットワークの土台を担う).

// 地球半径(メートル)
const EARTH_RADIUS_M = 6371000;
// 各駅が接続する近傍駅数. 路線の連続性を保ちつつ過剰な近道を避ける既定値.
const DEFAULT_NEIGHBOR_COUNT = 6;
// 1エッジの最大距離(メートル). これを超える駅間は接続しない.
// 久里浜-浜金谷(約12.7km)など水上を跨ぐ誤接続を防ぐ閾値.
const DEFAULT_EDGE_CAP_M = 12000;
// 駅間の走行速度(km/h). 停車時間は下の PER_HOP_MIN で別に足すため、表定速度より速い値になる.
// 実際の最速経路は快速・直通を使うので、各停の表定速度(約35km/h)に合わせると長く出すぎる.
const DEFAULT_SPEED_KMH = 56;
// ホップ毎(駅間1区間ごと)の停車・加減速オーバーヘッド(分).
// 近接グラフは各停の駅を1つずつ辿るため、この値は区間数の分だけ積み上がる.
// 1.5分では都心を横切る経路(20区間前後)で30分近く上乗せされていた.
const DEFAULT_PER_HOP_MIN = 0.4;

// 新快速が走る区間(station_database の路線名). この区間だけ、停車駅どうしを「快速の辺」で直接結ぶ.
// 近接グラフは各停の駅を1駅ずつ辿るため、表定速度が約90km/hの新快速が走る関西・名古屋では
// 所要時間が実際の約1.9倍に出ていた. 関東は乗換案内の代表区間で係数を合わせ済みのため対象にしない
// (関東の路線を足すと、乗換の多い区間が短く出すぎる).
const RAPID_SERVICE_LINES = new Set([
  "JR東海道本線(浜松～岐阜)",
  "JR東海道本線(岐阜～美濃赤坂・米原)",
  "JR北陸本線(米原～敦賀)",
  "JR東海道本線(琵琶湖線)(米原～京都)",
  "JR湖西線",
  "JR東海道本線(京都線)(京都～大阪)",
  "JR東海道本線(神戸線)(大阪～神戸)",
  "JR山陽本線(神戸線)(神戸～姫路)",
]);
// 快速の辺の表定速度(km/h). 新快速の京都-大阪(42.8km・約29分)などに合わせた値.
const RAPID_SPEED_KMH = 90;
// 快速の辺1本(=1回の乗車)ごとの待ち・乗り降りの上乗せ(分).
const RAPID_BOARDING_MIN = 2;
// 停車駅間の直線距離を線路の距離へ換算する係数.
const RAPID_DETOUR_FACTOR = 1.1;
// 快速の辺を張る最短の直線距離(メートル). これより近い停車駅どうしは近接グラフで足りる.
const RAPID_MIN_SPAN_M = 10000;
// 快速の停車駅とみなす乗り入れ路線数(主要駅はこれに関わらず停車駅とする).
const RAPID_STOP_MIN_LINES = 2;

// 構築済みグラフのキャッシュ(駅配列 → 路線データ → グラフ). 同一データの再構築を避ける
const graphCache = new WeakMap();

// 度をラジアンに変換する
function toRadians(degree) {
  return (degree * Math.PI) / 180;
}

// 2地点間のハバーサイン距離(メートル)を返す
function haversineMeters(aLat, aLng, bLat, bLng) {
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(aLat)) * Math.cos(toRadians(bLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// 駅間距離(メートル)を所要時間(分)へ換算する
function edgeMinutes(meters, speedKmh, perHopMin) {
  return (meters / 1000 / speedKmh) * 60 + perHopMin;
}

// 快速の停車駅か(主要駅、または乗換駅)
function isRapidStop(station) {
  return station.isMajor === true || (station.lines?.length ?? 0) >= RAPID_STOP_MIN_LINES;
}

// 新快速が走る区間の停車駅どうしを結ぶ「快速の辺」を作る.
// 1回の乗車を1本の辺で表すので、途中の停車駅を経由しない組み合わせもすべて結ぶ.
// railLines: [{ name, stations: [駅名, ...] }](data/rail-lines.json). 無ければ辺を作らない.
// 返り値: rapidAdjacency[i] = [[隣接駅index, 直線距離m, 所要時間分], ...]
function buildRapidAdjacency(stations, indexByName, railLines) {
  /** @type {Array<Array<[number, number, number]>>} */
  const rapidAdjacency = Array.from({ length: stations.length }, () => []);
  if (!Array.isArray(railLines)) return rapidAdjacency;

  const edgeSeen = new Set();
  for (const line of railLines) {
    if (!RAPID_SERVICE_LINES.has(line?.name) || !Array.isArray(line.stations)) continue;
    const stops = line.stations
      .map((name) => indexByName.get(name))
      .filter((index) => index !== undefined && isRapidStop(stations[index]));
    for (let i = 0; i < stops.length; i++) {
      for (let j = i + 1; j < stops.length; j++) {
        const a = stops[i];
        const b = stops[j];
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        if (edgeSeen.has(key)) continue;
        const distance = haversineMeters(stations[a].lat, stations[a].lng, stations[b].lat, stations[b].lng);
        if (distance < RAPID_MIN_SPAN_M) continue;
        edgeSeen.add(key);
        const minutes =
          RAPID_BOARDING_MIN + ((distance * RAPID_DETOUR_FACTOR) / 1000 / RAPID_SPEED_KMH) * 60;
        rapidAdjacency[a].push([b, distance, minutes]);
        rapidAdjacency[b].push([a, distance, minutes]);
      }
    }
  }
  return rapidAdjacency;
}

// 近接グラフを構築する
// stations: [{ name, lat, lng, ... }]
// options.railLines: 路線ごとの駅の並び. 渡すと新快速の区間に「快速の辺」を足す
// 返り値: { stations, adjacency, rapidAdjacency, indexByName, count, speedKmh, perHopMin }
//   adjacency[i] = [[隣接駅index, 距離m], ...]
//   rapidAdjacency[i] = [[隣接駅index, 距離m, 所要時間分], ...]
export function buildStationGraph(stations, options = {}) {
  const neighborCount = options.neighborCount ?? DEFAULT_NEIGHBOR_COUNT;
  const edgeCapM = options.edgeCapM ?? DEFAULT_EDGE_CAP_M;
  const speedKmh = options.speedKmh ?? DEFAULT_SPEED_KMH;
  const perHopMin = options.perHopMin ?? DEFAULT_PER_HOP_MIN;

  const count = stations.length;
  const adjacency = Array.from({ length: count }, () => []);
  // 多重辺を避けるための既存エッジ集合(キー: "小index_大index")
  const edgeSeen = new Set();

  const addEdge = (a, b, distance) => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    if (edgeSeen.has(key)) return;
    edgeSeen.add(key);
    adjacency[a].push([b, distance]);
    adjacency[b].push([a, distance]);
  };

  // 各駅についてCAP以内の駅を集め、近い順にK駅を接続する.
  // 総当たりO(n^2)だが2000駅規模なら起動時に一度だけで十分高速.
  for (let i = 0; i < count; i++) {
    const si = stations[i];
    const nearby = [];
    for (let j = 0; j < count; j++) {
      if (i === j) continue;
      const distance = haversineMeters(si.lat, si.lng, stations[j].lat, stations[j].lng);
      if (distance <= edgeCapM) nearby.push([distance, j]);
    }
    nearby.sort((a, b) => a[0] - b[0]);
    const limit = Math.min(neighborCount, nearby.length);
    for (let k = 0; k < limit; k++) {
      const [distance, j] = nearby[k];
      addEdge(i, j, distance);
    }
  }

  const indexByName = new Map(stations.map((s, i) => [s.name, i]));
  const rapidAdjacency = buildRapidAdjacency(stations, indexByName, options.railLines);
  return { stations, adjacency, rapidAdjacency, indexByName, count, speedKmh, perHopMin };
}

// 駅配列と路線データをキーにグラフを構築・キャッシュする(同一データなら再利用).
// 路線データの有無で快速の辺が変わるため、両方をキーにする.
export function getOrBuildGraph(stations, options = {}) {
  const railLinesKey = options.railLines ?? null;
  let byRailLines = graphCache.get(stations);
  if (!byRailLines) {
    byRailLines = new Map();
    graphCache.set(stations, byRailLines);
  }
  const cached = byRailLines.get(railLinesKey);
  if (cached) return cached;
  const graph = buildStationGraph(stations, options);
  byRailLines.set(railLinesKey, graph);
  return graph;
}

// 最小ヒープ(キー = 所要時間分). ダイクストラ用の軽量実装.
function createMinHeap() {
  const heap = [];
  const swap = (a, b) => {
    const tmp = heap[a];
    heap[a] = heap[b];
    heap[b] = tmp;
  };
  return {
    get size() {
      return heap.length;
    },
    push(item) {
      heap.push(item);
      let child = heap.length - 1;
      while (child > 0) {
        const parent = (child - 1) >> 1;
        if (heap[parent][0] <= heap[child][0]) break;
        swap(parent, child);
        child = parent;
      }
    },
    pop() {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length > 0) {
        heap[0] = last;
        let parent = 0;
        for (;;) {
          const left = 2 * parent + 1;
          const right = 2 * parent + 2;
          let smallest = parent;
          if (left < heap.length && heap[left][0] < heap[smallest][0]) smallest = left;
          if (right < heap.length && heap[right][0] < heap[smallest][0]) smallest = right;
          if (smallest === parent) break;
          swap(smallest, parent);
          parent = smallest;
        }
      }
      return top;
    }
  };
}

// 始点駅(index)から全駅への最短「所要時間(分)」と、その経路に沿った「累積距離(m)」を返す.
// 返り値: { minutes: number[], meters: number[] }(到達不能はInfinity)
export function shortestFrom(graph, originIndex) {
  const { adjacency, rapidAdjacency, count, speedKmh, perHopMin } = graph;
  const minutes = new Array(count).fill(Infinity);
  const meters = new Array(count).fill(Infinity);

  if (originIndex < 0 || originIndex >= count) {
    return { minutes, meters };
  }

  minutes[originIndex] = 0;
  meters[originIndex] = 0;
  const heap = createMinHeap();
  heap.push([0, originIndex]);

  while (heap.size > 0) {
    const [currentMinutes, u] = heap.pop();
    // 取り出した値が既知の最短より大きければ古いエントリなので捨てる
    if (currentMinutes > minutes[u]) continue;
    const relax = (v, distance, edgeMin) => {
      const nextMinutes = currentMinutes + edgeMin;
      if (nextMinutes < minutes[v]) {
        minutes[v] = nextMinutes;
        meters[v] = meters[u] + distance;
        heap.push([nextMinutes, v]);
      }
    };
    for (const [v, distance] of adjacency[u]) {
      relax(v, distance, edgeMinutes(distance, speedKmh, perHopMin));
    }
    // 新快速の区間の快速の辺(所要時間は構築時に計算済み)
    for (const [v, distance, edgeMin] of rapidAdjacency?.[u] ?? []) {
      relax(v, distance, edgeMin);
    }
  }
  return { minutes, meters };
}
