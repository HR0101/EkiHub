#!/usr/bin/env python3
"""
タスク2 v3: 路線情報の補完（OSMノードタグ直接取得方式）
-------------------------------------------------------
railway=station ノードの operator/network タグは
各駅ノード自体に付いていることが多い。
fetchKantoStations.js がすでに lines=[network, operator] で取得済み。

今回の戦略:
  1. 路線情報が空の駅を洗い出す
  2. Overpass で「同じ駅名の station ノード」を小さいBBOX分割で再取得
  3. operator / network / railway:line タグを lines に付与
  4. stations-osm.json を上書き保存

実行: python3 scripts/enrichLines_v3.py
"""

import json, time, urllib.request, urllib.parse
from pathlib import Path
from collections import defaultdict

ROOT     = Path(__file__).parent.parent
OSM_PATH = ROOT / "data" / "stations-osm.json"
TMP_DIR  = ROOT / "data" / ".tmp"
TMP_DIR.mkdir(parents=True, exist_ok=True)

ENDPOINTS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
HEADERS = {
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent":   "EkiHub/1.0 (line enrichment v3)",
    "Accept":       "application/json",
}

# 日本を8分割したBBOX（小クエリで負荷分散）
# (south, west, north, east)
BBOXES = [
    # 北海道
    (41.5, 139.3, 45.6, 145.9),
    # 東北
    (36.5, 139.5, 41.5, 141.9),
    # 関東
    (34.9, 138.8, 36.9, 140.9),
    # 中部・北陸
    (34.5, 136.0, 37.5, 139.5),
    # 近畿
    (33.8, 134.5, 35.5, 136.5),
    # 中国・四国
    (32.9, 130.5, 35.0, 134.5),
    # 九州
    (30.9, 129.5, 34.0, 131.5),
    # 沖縄・離島
    (24.0, 122.9, 31.5, 131.5),
]

def overpass(query: str, label: str = "", timeout: int = 120) -> dict:
    encoded = urllib.parse.urlencode({"data": query}).encode("utf-8")
    for ep in ENDPOINTS:
        try:
            req = urllib.request.Request(ep, data=encoded, headers=HEADERS, method="POST")
            with urllib.request.urlopen(req, timeout=timeout + 10) as r:
                body = r.read().decode("utf-8")
            if '"elements"' not in body:
                print(f"    ⚠ {ep}: elements なし ({body[:80]})")
                continue
            d = json.loads(body)
            print(f"    ✅ {ep} ({len(d.get('elements',[]))} elements)")
            return d
        except Exception as e:
            print(f"    ❌ {ep}: {e}")
        time.sleep(3)
    return {"elements": []}   # 失敗しても続行


def normalize(name: str) -> str:
    return name.rstrip("駅").strip() if name else ""


# ── データ読み込み ──────────────────────────────────────────────────────────
print("=== タスク2 v3: 路線情報補完（ノードタグ再取得） ===\n")
with open(OSM_PATH, encoding="utf-8") as f:
    stations = json.load(f)

no_lines = [s for s in stations if not s.get("lines")]
print(f"駅データ: {len(stations)}駅  路線情報なし: {len(no_lines)}駅\n")

# 補完対象駅名セット
target_names = {s["name"] for s in no_lines}

# 駅名→インデックスのマップ
name_to_station = defaultdict(list)
for s in stations:
    name_to_station[s["name"]].append(s)

# ── BBOX分割でstation nodeのoperator/networkを取得 ──────────────────────────
print("=== Overpass: BBOX分割でstation node取得 ===")

# 取得した 駅名→路線名セット
extra_lines: dict[str, set] = defaultdict(set)

for i, (s, w, n, e) in enumerate(BBOXES, 1):
    cache_file = TMP_DIR / f"bbox_{i}.json"
    print(f"\n[BBOX {i}/{len(BBOXES)}] ({s},{w},{n},{e})")

    if cache_file.exists():
        print("  キャッシュ使用")
        with open(cache_file, encoding="utf-8") as f:
            data = json.load(f)
    else:
        query = (
            f'[out:json][timeout:90];'
            f'node["railway"="station"]({s},{w},{n},{e});'
            f'out tags;'
        )
        data = overpass(query, f"bbox{i}", timeout=90)
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        time.sleep(3)

    elements = data.get("elements", [])
    print(f"  取得ノード数: {len(elements)}")

    for el in elements:
        tags = el.get("tags", {})
        raw_name = tags.get("name")
        if not raw_name:
            continue
        name = normalize(raw_name)
        if name not in target_names:
            continue

        # 路線名候補を収集（複数タグ）
        candidates = []
        for key in ("network", "operator", "railway:line", "line", "name:line"):
            val = tags.get(key)
            if val:
                # セミコロン区切りに対応
                for v in val.split(";"):
                    v = v.strip()
                    if v:
                        candidates.append(v)

        for c in candidates:
            extra_lines[name].add(c)

print(f"\n路線情報を得られた駅名: {len(extra_lines)}件")

# ── マージ ──────────────────────────────────────────────────────────────────
print("\n=== マージ ===")
enriched   = 0
supplement = 0

for s in stations:
    new = extra_lines.get(s["name"])
    if not new:
        continue
    existing = set(s.get("lines") or [])
    before   = len(existing)
    existing.update(new)
    if len(existing) > before:
        s["lines"] = sorted(existing)
        if before == 0:
            enriched += 1
        else:
            supplement += 1

print(f"路線情報を新規付与: {enriched}駅")
print(f"路線情報を追加補完: {supplement}駅")

# ── 保存 ────────────────────────────────────────────────────────────────────
with open(OSM_PATH, "w", encoding="utf-8") as f:
    json.dump(stations, f, ensure_ascii=False, indent=2)

no_lines_after = sum(1 for s in stations if not s.get("lines"))
print(f"\n✅ stations-osm.json 更新完了 ({len(stations)}駅)")
print(f"路線情報なし(残): {no_lines_after}駅  (改善: {len(no_lines) - no_lines_after}駅)")
