#!/usr/bin/env python3
"""
タスク2: 路線情報の補完
Overpass API (route relation) から 駅名→路線名 マッピングを構築し
stations-osm.json の lines フィールドを補完する。

実行: python3 scripts/enrichLines.py
"""

import json, time, urllib.request, urllib.parse, sys
from pathlib import Path

ROOT     = Path(__file__).parent.parent
OSM_PATH = ROOT / "data" / "stations-osm.json"
TMP_DIR  = ROOT / "data" / ".tmp"
TMP_DIR.mkdir(parents=True, exist_ok=True)

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

HEADERS = {
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent":   "EkiHub/1.0 (line enrichment; python)",
    "Accept":       "application/json",
}

def overpass_query(query: str, label: str = "") -> dict:
    """Overpassにクエリを投げてJSONを返す。複数エンドポイントを試す。"""
    encoded = urllib.parse.urlencode({"data": query}).encode("utf-8")
    for ep in ENDPOINTS:
        try:
            print(f"  → {ep} {label}")
            req = urllib.request.Request(ep, data=encoded, headers=HEADERS, method="POST")
            with urllib.request.urlopen(req, timeout=310) as resp:
                body = resp.read().decode("utf-8")
            data = json.loads(body)
            if "elements" in data:
                print(f"     ✅ 取得成功 ({len(data['elements'])} elements)")
                return data
            print(f"     ⚠ elements なし")
        except Exception as e:
            print(f"     ❌ 失敗: {e}")
        time.sleep(3)
    raise RuntimeError("全Overpassエンドポイント失敗")


def normalize(name: str) -> str:
    return name.rstrip("駅").strip() if name else ""


# ── 路線種別ごとに分割クエリ（1回のクエリを小さくする） ──────────────────────
ROUTE_TYPES = ["railway", "subway", "light_rail", "tram", "monorail"]

BBOX = "24.0,122.9,46.0,149.0"

def build_relation_query(route_type: str) -> str:
    return (
        f'[out:json][timeout:300];'
        f'relation["route"="{route_type}"]({BBOX});'
        f'out tags members;'
    )


def build_node_query(refs: list[int]) -> str:
    return (
        f'[out:json][timeout:120];'
        f'node(id:{",".join(map(str, refs))});'
        f'out tags;'
    )


# ── 駅データ読み込み ──────────────────────────────────────────────────────────
print("=== タスク2: 路線情報補完 ===\n")
with open(OSM_PATH, encoding="utf-8") as f:
    stations = json.load(f)

no_lines_before = sum(1 for s in stations if not s.get("lines"))
print(f"駅データ: {len(stations)}駅  路線情報なし: {no_lines_before}駅\n")

# ── Step1: routeリレーションを種別ごとに取得 ──────────────────────────────────
print("=== Step1: routeリレーション取得 ===")
node_ref_to_lines: dict[int, set] = {}   # node OSM id → {路線名}

for rtype in ROUTE_TYPES:
    print(f"\n[{rtype}]")
    cache_file = TMP_DIR / f"relations_{rtype}.json"
    if cache_file.exists():
        print(f"  キャッシュ使用: {cache_file}")
        with open(cache_file, encoding="utf-8") as f:
            rel_data = json.load(f)
    else:
        try:
            rel_data = overpass_query(build_relation_query(rtype), f"[{rtype}]")
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(rel_data, f, ensure_ascii=False)
        except RuntimeError as e:
            print(f"  スキップ: {e}")
            continue

    relations = [e for e in rel_data.get("elements", []) if e["type"] == "relation"]
    print(f"  リレーション数: {len(relations)}")

    for rel in relations:
        tags = rel.get("tags", {})
        line_name = tags.get("name:ja") or tags.get("name") or tags.get("ref")
        if not line_name:
            continue
        for m in rel.get("members", []):
            if m["type"] != "node":
                continue
            role = m.get("role", "")
            if role in ("", "stop", "station", "stop_entry_only",
                        "stop_exit_only", "platform"):
                ref = m["ref"]
                if ref not in node_ref_to_lines:
                    node_ref_to_lines[ref] = set()
                node_ref_to_lines[ref].add(line_name)

print(f"\nstop/station ノード総数: {len(node_ref_to_lines)}")

# ── Step2: node id → 駅名 を取得（分割クエリ） ───────────────────────────────
print("\n=== Step2: nodeタグ取得 ===")
all_refs   = list(node_ref_to_lines.keys())
CHUNK_SIZE = 2000
name_to_lines: dict[str, set] = {}   # 駅名 → {路線名}

total_chunks = (len(all_refs) + CHUNK_SIZE - 1) // CHUNK_SIZE
for ci, start in enumerate(range(0, len(all_refs), CHUNK_SIZE), 1):
    chunk = all_refs[start : start + CHUNK_SIZE]
    print(f"  chunk {ci}/{total_chunks} ({len(chunk)} nodes)...", end=" ", flush=True)
    cache_file = TMP_DIR / f"nodes_{ci}.json"

    if cache_file.exists():
        print("キャッシュ")
        with open(cache_file, encoding="utf-8") as f:
            node_data = json.load(f)
    else:
        try:
            node_data = overpass_query(build_node_query(chunk), f"chunk{ci}")
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(node_data, f, ensure_ascii=False)
        except RuntimeError as e:
            print(f"スキップ: {e}")
            time.sleep(5)
            continue
        time.sleep(2)

    for node in node_data.get("elements", []):
        raw_name = node.get("tags", {}).get("name")
        if not raw_name:
            continue
        name = normalize(raw_name)
        if not name:
            continue
        node_id = node["id"]
        lines   = node_ref_to_lines.get(node_id, set())
        if name not in name_to_lines:
            name_to_lines[name] = set()
        name_to_lines[name].update(lines)

print(f"\n路線情報を得られた駅名: {len(name_to_lines)}件")

# ── Step3: 駅データにマージ ──────────────────────────────────────────────────
print("\n=== Step3: 駅データにマージ ===")
enriched   = 0
supplement = 0

for s in stations:
    new_lines = name_to_lines.get(s["name"])
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

print(f"路線情報を新規付与: {enriched}駅")
print(f"路線情報を追加補完: {supplement}駅")

# ── 保存 ────────────────────────────────────────────────────────────────────
with open(OSM_PATH, "w", encoding="utf-8") as f:
    json.dump(stations, f, ensure_ascii=False, indent=2)
print(f"\n✅ stations-osm.json 更新完了 ({len(stations)}駅)")

no_lines_after = sum(1 for s in stations if not s.get("lines"))
print(f"路線情報なし(残): {no_lines_after}駅  (改善: {no_lines_before - no_lines_after}駅)")
