#!/usr/bin/env python3
"""
タスク2 v4: 路線情報補完（オフライン辞書 + stations.js マージ）
----------------------------------------------------------------
Overpass API が不安定なため、確実に動く2ステップで補完する:

Step 1: stations.js の103駅分の詳細路線情報を stations-osm.json へマージ
Step 2: 既存の lines=[operator名] を 運行会社→路線名辞書 で補完
        （「東日本旅客鉄道」→「JR東日本」など読みやすく正規化）

実行: python3 scripts/enrichLines_v4.py
"""

import json, re
from pathlib import Path
from collections import defaultdict

ROOT     = Path(__file__).parent.parent
OSM_PATH = ROOT / "data" / "stations-osm.json"
JS_PATH  = ROOT / "data" / "stations.js"

# ── stations.js をパース ─────────────────────────────────────────────────────
print("=== Step 1: stations.js から路線情報をマージ ===")

js_text = JS_PATH.read_text(encoding="utf-8")
# JSON部分を抽出: { name: "...", ... } の配列
# JSコメントと export const stations = [...] を除去してJSONとして解釈
# 正規表現でオブジェクト配列を取り出す
array_match = re.search(r'export const stations\s*=\s*(\[.*?\]);', js_text, re.DOTALL)
if not array_match:
    # フォールバック: [ から ] まで取り出す
    start = js_text.index('[')
    end   = js_text.rindex(']') + 1
    array_text = js_text[start:end]
else:
    array_text = array_match.group(1)

# JSオブジェクトキーをクォートに変換して JSON化
# name: → "name":  などの変換
def js_to_json(text):
    # 行コメント除去
    text = re.sub(r'//[^\n]*', '', text)
    # トレイリングカンマ除去
    text = re.sub(r',\s*([\]}])', r'\1', text)
    # 非クォートキーをクォート
    text = re.sub(r'(\b)([a-zA-Z_][a-zA-Z0-9_]*)(\s*):', r'"\2"\3:', text)
    return text

try:
    js_stations = json.loads(js_to_json(array_text))
    print(f"  stations.js パース成功: {len(js_stations)}駅")
except json.JSONDecodeError as e:
    print(f"  ⚠ パース失敗: {e} → 手動マッピングのみ使用")
    js_stations = []

# 駅名→路線リストのマップ（stations.js）
js_lines_map = {s["name"]: s.get("lines", []) for s in js_stations if s.get("lines")}

# ── stations-osm.json 読み込み ──────────────────────────────────────────────
with open(OSM_PATH, encoding="utf-8") as f:
    stations = json.load(f)
print(f"\n駅データ: {len(stations)}駅")
no_lines_before = sum(1 for s in stations if not s.get("lines"))
print(f"路線情報なし: {no_lines_before}駅\n")

# Step 1: stations.js からマージ
merged_from_js = 0
for s in stations:
    js_info = js_lines_map.get(s["name"])
    if not js_info:
        continue
    existing = set(s.get("lines") or [])
    new_set  = existing | set(js_info)
    if len(new_set) > len(existing):
        s["lines"] = sorted(new_set)
        if not existing:
            merged_from_js += 1
        else:
            merged_from_js += 1

print(f"  stations.js からマージ: {merged_from_js}駅")

# ── Step 2: operator 辞書で正規化・補完 ──────────────────────────────────────
print("\n=== Step 2: operator辞書で補完 ===")

# 運行会社名 → 路線表記辞書
# OSMの operator タグに入っている会社正式名 → 一般的な路線表記
OPERATOR_TO_LINES = {
    # JR
    "東日本旅客鉄道":         ["JR東日本"],
    "西日本旅客鉄道":         ["JR西日本"],
    "東海旅客鉄道":           ["JR東海"],
    "九州旅客鉄道":           ["JR九州"],
    "北海道旅客鉄道":         ["JR北海道"],
    "四国旅客鉄道":           ["JR四国"],
    "日本貨物鉄道":           ["JR貨物"],
    "JR東日本":               ["JR東日本"],
    "JR西日本":               ["JR西日本"],
    "JR東海":                 ["JR東海"],
    "JR九州":                 ["JR九州"],
    "JR北海道":               ["JR北海道"],
    "JR四国":                 ["JR四国"],
    # 東京メトロ
    "東京地下鉄":             ["東京メトロ"],
    "Tokyo Metro":            ["東京メトロ"],
    # 都営
    "東京都交通局":           ["都営地下鉄"],
    # 大手私鉄
    "東京急行電鉄":           ["東急"],
    "東急電鉄":               ["東急"],
    "京浜急行電鉄":           ["京急"],
    "小田急電鉄":             ["小田急"],
    "京王電鉄":               ["京王"],
    "東武鉄道":               ["東武"],
    "西武鉄道":               ["西武"],
    "相模鉄道":               ["相鉄"],
    "京成電鉄":               ["京成"],
    "新京成電鉄":             ["新京成"],
    "京浜急行":               ["京急"],
    "東京臨海高速鉄道":       ["りんかい線"],
    "東京モノレール":         ["東京モノレール"],
    "ゆりかもめ":             ["ゆりかもめ"],
    "首都圏新都市鉄道":       ["つくばエクスプレス"],
    "多摩都市モノレール":     ["多摩モノレール"],
    "横浜市交通局":           ["横浜市営地下鉄"],
    "横浜高速鉄道":           ["みなとみらい線"],
    "湘南モノレール":         ["湘南モノレール"],
    "江ノ島電鉄":             ["江ノ電"],
    "箱根登山鉄道":           ["箱根登山鉄道"],
    "伊豆急行":               ["伊豆急行"],
    "富士急行":               ["富士急行"],
    "岳南電車":               ["岳南電車"],
    "静岡鉄道":               ["静岡鉄道"],
    "遠州鉄道":               ["遠州鉄道"],
    "天竜浜名湖鉄道":         ["天竜浜名湖鉄道"],
    "名古屋鉄道":             ["名鉄"],
    "近畿日本鉄道":           ["近鉄"],
    "南海電気鉄道":           ["南海"],
    "阪急電鉄":               ["阪急"],
    "阪神電気鉄道":           ["阪神"],
    "京阪電気鉄道":           ["京阪"],
    "大阪市高速電気軌道":     ["Osaka Metro"],
    "大阪市交通局":           ["Osaka Metro"],
    "神戸電鉄":               ["神戸電鉄"],
    "山陽電気鉄道":           ["山陽電車"],
    "西日本鉄道":             ["西鉄"],
    "福岡市交通局":           ["福岡市地下鉄"],
    "札幌市交通局":           ["札幌市営地下鉄"],
    "仙台市交通局":           ["仙台市地下鉄"],
    "名古屋市交通局":         ["名古屋市営地下鉄"],
    "京都市交通局":           ["京都市営地下鉄"],
    "神戸市交通局":           ["神戸市営地下鉄"],
    "広島電鉄":               ["広島電鉄"],
    "熊本電気鉄道":           ["熊本電鉄"],
    "鹿児島市交通局":         ["鹿児島市電"],
    # 第3セクター
    "東葉高速鉄道":           ["東葉高速線"],
    "北総鉄道":               ["北総線"],
    "埼玉高速鉄道":           ["埼玉高速鉄道線"],
    "東京都島しょ振興公社":   [],
    "ニューシャトル":         ["埼玉新都市交通"],
    "上毛電気鉄道":           ["上毛電鉄"],
    "上信電鉄":               ["上信電鉄"],
    "わたらせ渓谷鐵道":       ["わたらせ渓谷鉄道"],
    "秩父鉄道":               ["秩父鉄道"],
    "真岡鐵道":               ["真岡鉄道"],
    "関東鉄道":               ["関東鉄道"],
    "ひたちなか海浜鉄道":     ["ひたちなか海浜鉄道"],
    "銚子電気鉄道":           ["銚子電鉄"],
    "小湊鐵道":               ["小湊鉄道"],
    "いすみ鉄道":             ["いすみ鉄道"],
    "流鉄":                   ["流鉄"],
    "芝山鉄道":               ["芝山鉄道"],
    "千葉都市モノレール":     ["千葉都市モノレール"],
    "東京都荒川線":           ["都電荒川線"],
    "日暮里・舎人ライナー":   ["日暮里舎人ライナー"],
    "ゴールドコースト":       [],
}

# linesに含まれるoperator名を正規化
enriched_dict = 0
for s in stations:
    lines = s.get("lines") or []
    if not lines:
        continue
    new_lines = set()
    for line in lines:
        # operator辞書にあれば変換
        if line in OPERATOR_TO_LINES:
            mapped = OPERATOR_TO_LINES[line]
            if mapped:
                new_lines.update(mapped)
            # 元のoperator名は残さない（会社名ではなく路線名に統一）
        else:
            new_lines.add(line)  # 辞書にないものはそのまま
    if new_lines != set(lines):
        s["lines"] = sorted(new_lines)
        enriched_dict += 1

print(f"  operator名を路線名に正規化: {enriched_dict}駅")

# ── 統計 ─────────────────────────────────────────────────────────────────────
no_lines_after = sum(1 for s in stations if not s.get("lines"))
print(f"\n路線情報なし(残): {no_lines_after}駅  (改善: {no_lines_before - no_lines_after}駅)")

# lines の上位内容確認
from collections import Counter
all_lines = []
for s in stations:
    all_lines.extend(s.get("lines") or [])
top_lines = Counter(all_lines).most_common(20)
print("\n路線名 上位20:")
for name, cnt in top_lines:
    print(f"  {name}: {cnt}駅")

# ── 保存 ────────────────────────────────────────────────────────────────────
with open(OSM_PATH, "w", encoding="utf-8") as f:
    json.dump(stations, f, ensure_ascii=False, indent=2)
print(f"\n✅ stations-osm.json 更新完了 ({len(stations)}駅)")
print("\n※ Overpass APIが現在不安定なため、全国路線情報のオンライン補完は")
print("   後でネットワーク環境が安定した際に enrichLines_v3.py を再実行してください。")
print("   （キャッシュ機能付きのため途中から再開できます）")
