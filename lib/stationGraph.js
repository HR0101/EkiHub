// 駅ネットワークグラフ
// 役割: 既存の全駅座標から「近接グラフ」を構築し、鉄道網に近い最短経路で
//       駅間の所要時間(分)・距離(m)を近似する.
//
// 設計の要点:
//   - 各駅を「最寄りK駅」かつ「1エッジ最大CAP_M以内」で結ぶ.
//   - CAP_M(=12km)が東京湾横断(約30km)のような水上ショートカットを物理的に排除する.
//     これにより重心が海上に出ても海を渡る経路が生まれず、海上重心問題が根治する.
//   - 駅間距離(haversine)を平均表定速度で時間換算し、ホップ毎に停車オーバーヘッドを足す.
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
// 鉄道のおおよその表定速度(km/h). 各停〜快速混在を想定した概算値.
const DEFAULT_SPEED_KMH = 35;
// ホップ毎(駅間1区間ごと)の停車・加減速オーバーヘッド(分).
const DEFAULT_PER_HOP_MIN = 1.5;

// 構築済みグラフのキャッシュ(駅配列の参照をキーに同一データの再構築を避ける)
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

// 近接グラフを構築する
// stations: [{ name, lat, lng, ... }]
// 返り値: { stations, adjacency, indexByName, count, speedKmh, perHopMin }
//   adjacency[i] = [[隣接駅index, 距離m], ...]
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
  return { stations, adjacency, indexByName, count, speedKmh, perHopMin };
}

// 駅配列をキーにグラフを構築・キャッシュする(同一配列なら再利用)
export function getOrBuildGraph(stations, options = {}) {
  const cached = graphCache.get(stations);
  if (cached) return cached;
  const graph = buildStationGraph(stations, options);
  graphCache.set(stations, graph);
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
  const { adjacency, count, speedKmh, perHopMin } = graph;
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
    for (const [v, distance] of adjacency[u]) {
      const nextMinutes = currentMinutes + edgeMinutes(distance, speedKmh, perHopMin);
      if (nextMinutes < minutes[v]) {
        minutes[v] = nextMinutes;
        meters[v] = meters[u] + distance;
        heap.push([nextMinutes, v]);
      }
    }
  }
  return { minutes, meters };
}
