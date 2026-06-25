#!/usr/bin/env python3
"""
タスク2 v5: 路線情報補完（ekidata.jp の CSV使用）
----------------------------------------------------------------
Overpass API は不安定なため、有志が公開している「駅データ.jp」互換の
CSVデータを用いて、残りの駅に路線名をマージする。

必要なファイル（/tmp/ekidata_ny/csvs/ 以下にクローン済み前提）:
- line.csv
- station.csv

実行: python3 scripts/enrichLines_v5.py
"""

import csv
import json
from pathlib import Path
from collections import defaultdict

ROOT     = Path(__file__).parent.parent
OSM_PATH = ROOT / "data" / "stations-osm.json"
CSV_DIR  = Path("/tmp/ekidata_ny/csvs")

if not CSV_DIR.exists():
    raise RuntimeError(f"CSVディレクトリが見つかりません: {CSV_DIR}")

def normalize(name: str) -> str:
    # 駅名のブレ吸収（「ケ」や括弧の揺れなど）
    # ekidataの駅名には「駅」は含まれていない
    return name.strip()

# ── 1. 路線名辞書を構築 ───────────────────────────────────────────────────────
line_cd_to_name = {}
with open(CSV_DIR / "line.csv", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        # e_status が 2 (廃止) の場合は除外してもよいが、OSMに残っていることもあるので保持
        # 路線名を正規化（「JR」などのプレフィックスが既についていることが多い）
        line_name = row["line_name"]
        line_cd_to_name[row["line_cd"]] = line_name

# ── 2. 駅名 → 路線名セット辞書を構築 ──────────────────────────────────────────
name_to_lines = defaultdict(set)
with open(CSV_DIR / "station.csv", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        # e_status == 0 が現役
        if row["e_status"] != "0":
            continue
        
        station_name = normalize(row["station_name"])
        line_cd = row["line_cd"]
        line_name = line_cd_to_name.get(line_cd)
        if station_name and line_name:
            name_to_lines[station_name].add(line_name)

print(f"ekidata: {len(name_to_lines)}駅の路線情報を読み込みました")

# ── 3. stations-osm.json にマージ ─────────────────────────────────────────────
with open(OSM_PATH, encoding="utf-8") as f:
    stations = json.load(f)

no_lines_before = sum(1 for s in stations if not s.get("lines"))
print(f"OSM駅データ: {len(stations)}駅  路線情報なし: {no_lines_before}駅")

enriched   = 0
supplement = 0

for s in stations:
    osm_name = s["name"]
    # OSMの駅名は「駅」を含まないのでそのまま比較
    new_lines = name_to_lines.get(osm_name)
    if not new_lines:
        continue
    
    existing = set(s.get("lines") or [])
    before   = len(existing)
    existing.update(new_lines)
    
    if len(existing) > before:
        s["lines"] = sorted(existing)
        if before == 0:
            enriched += 1
        else:
            supplement += 1

print(f"\n路線情報を新規付与: {enriched}駅")
print(f"路線情報を追加補完: {supplement}駅")

# ── 保存 ────────────────────────────────────────────────────────────────────
with open(OSM_PATH, "w", encoding="utf-8") as f:
    json.dump(stations, f, ensure_ascii=False, indent=2)

no_lines_after = sum(1 for s in stations if not s.get("lines"))
print(f"\n✅ stations-osm.json 更新完了 ({len(stations)}駅)")
print(f"路線情報なし(残): {no_lines_after}駅  (改善: {no_lines_before - no_lines_after}駅)")
