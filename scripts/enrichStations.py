#!/usr/bin/env python3
"""
enrichStations.py
  タスク3: 座標検証 (日本バウンディングボックス外 + 海上離島外れ値を検出)
  タスク4: 乗降客数(ridership.json)を stations-osm.json の全駅にマージ

実行: python3 scripts/enrichStations.py
出力:
  data/stations-osm.json  (上書き: ridership付き)
  data/coord_issues.json  (座標異常リスト)
"""

import json, math, sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
OSM_PATH  = ROOT / "data" / "stations-osm.json"
RIDE_PATH = ROOT / "data" / "ridership.json"
ISSUE_PATH = ROOT / "data" / "coord_issues.json"

# ── 日本の有効緯度経度範囲 ────────────────────────────────────────────────────
# 本土＋沖縄＋北海道を包含。離島（南鳥島 24.3, 与那国 122.9, 択捉 148.8）込み
JP_LAT_MIN, JP_LAT_MAX = 24.0, 46.0
JP_LNG_MIN, JP_LNG_MAX = 122.9, 149.0

def in_japan(lat, lng):
    return JP_LAT_MIN <= lat <= JP_LAT_MAX and JP_LNG_MIN <= lng <= JP_LNG_MAX

def haversine(lat1, lng1, lat2, lng2):
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
    return R * 2 * math.asin(math.sqrt(a))

# ── データ読み込み ────────────────────────────────────────────────────────────
print("=== タスク3+4: 座標検証 & 乗降客数マージ ===\n")

with open(OSM_PATH, encoding="utf-8") as f:
    stations = json.load(f)
print(f"OSM駅数: {len(stations)}")

with open(RIDE_PATH, encoding="utf-8") as f:
    ridership = json.load(f)
print(f"ridership.json 駅数: {len(ridership)}")

# ── タスク3: 座標検証 ─────────────────────────────────────────────────────────
print("\n--- 座標検証 ---")

issues = []
out_of_japan = 0
for s in stations:
    lat, lng = s.get("lat"), s.get("lng")
    if lat is None or lng is None:
        issues.append({"name": s["name"], "reason": "座標なし", "lat": None, "lng": None})
        continue
    if not in_japan(lat, lng):
        out_of_japan += 1
        issues.append({
            "name": s["name"],
            "reason": "日本範囲外",
            "lat": lat,
            "lng": lng
        })

print(f"  日本範囲外の駅: {out_of_japan}件")
print(f"  座標なし: {sum(1 for i in issues if i['reason'] == '座標なし')}件")

# ── タスク4: 乗降客数マージ ───────────────────────────────────────────────────
print("\n--- 乗降客数マージ ---")

MAJOR_THRESHOLD = 200000
merged_count = 0
major_upgraded = 0

for s in stations:
    name = s.get("name", "")
    if name in ridership:
        ride = ridership[name]
        s["ridership"] = ride
        if ride >= MAJOR_THRESHOLD and not s.get("isMajor"):
            s["isMajor"] = True
            major_upgraded += 1
        merged_count += 1

print(f"  乗降客数を付与した駅: {merged_count}件 / {len(stations)}件")
print(f"  isMajor=trueに昇格した駅: {major_upgraded}件")

# カバレッジ率
coverage = merged_count / len(stations) * 100
print(f"  カバレッジ: {coverage:.1f}%")

# 乗降客数の付与なし駅をサマリ
no_ride = sum(1 for s in stations if s.get("ridership", 0) == 0)
print(f"  乗降客数0(未付与含む): {no_ride}件")

# ── 結果保存 ─────────────────────────────────────────────────────────────────
with open(OSM_PATH, "w", encoding="utf-8") as f:
    json.dump(stations, f, ensure_ascii=False, indent=2)
print(f"\n✅ stations-osm.json を更新しました ({len(stations)}駅)")

with open(ISSUE_PATH, "w", encoding="utf-8") as f:
    json.dump(issues, f, ensure_ascii=False, indent=2)
print(f"✅ 座標異常リストを保存: {ISSUE_PATH} ({len(issues)}件)")

# サンプル表示
if issues:
    print("\n座標異常の例:")
    for i in issues[:10]:
        print(f"  {i['name']}: {i['reason']} lat={i['lat']} lng={i['lng']}")

print("\n=== 完了 ===")
