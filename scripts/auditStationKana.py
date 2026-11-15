"""Read-only kana comparison; differences are candidates, not proven errors.

Usage: python3 scripts/auditStationKana.py reference.csv output-directory
Reference: Seo-4d696b75/station_database out/main/station.csv (CC BY 4.0).
"""
import csv
import hashlib
import json
import math
import re
from pathlib import Path
import subprocess
import sys
import unicodedata
from collections import Counter, defaultdict

ROOT = Path(__file__).resolve().parent.parent
PREFECTURES = ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
               '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
               '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県']


def active_manual_reviews(reviews, current):
    """A review expires if the name, coordinates, or current reading changes."""
    return [r for r in reviews
            if (r['name'], float(r['lat']), float(r['lng']), r['current_kana']) in current
            and r['verdict'] in {'renamed', 'non-station', 'correct', 'closed', 'planned',
                                'park-attraction'}]


def normalize(value):
    value = unicodedata.normalize('NFKC', value).strip()
    return ''.join(chr(ord(c)-0x60) if 'ァ' <= c <= 'ヴ' else c for c in value)


def name_key(value):
    return normalize(value).translate(str.maketrans({
        'ヶ': 'け', '驒': '騨', '祗': '祇', '鴬': '鶯', '遥': '遙',
        '⻑': '長', '⻄': '西', '⻘': '青', '⻲': '亀'}))


def distance(a, b):
    lat1, lat2 = map(math.radians, (float(a['lat']), float(b['lat'])))
    delta = math.radians(float(a['lng'])-float(b['lng']))
    x = math.sin((lat1-lat2)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(delta/2)**2
    return 6371000*2*math.asin(min(1, math.sqrt(x)))


def aliases(name):
    # Candidate matching only; never use these substitutions on kana.
    name = unicodedata.normalize('NFKC', name).translate(str.maketrans({
        'ヶ': 'ケ', '驒': '騨', '祗': '祇', '鴬': '鶯', '遥': '遙',
        '〈': '(', '〉': ')', '《': '(', '》': ')'}))
    name = re.sub(r'\s+', '', name)
    return {normalize(n) for n in [name, re.sub(r'\([^)]*\)', '', name),
            *re.findall(r'\(([^)]*)\)', name)] if n}


def official_checks(results, reference, official):
    by_code = {r['code']: r for r in reference}
    by_name = defaultdict(list)
    for row in official:
        # Official station names are not reduced to text inside parentheses.
        by_name[name_key(row['name'])].append(row)
    checks = []
    for row in results:
        candidates = by_name[name_key(row['name'])]
        matches = []
        for candidate in candidates:
            codes = [by_code[c] for c in row['reference_codes'].split(' | ') if c in by_code]
            operator = candidate.get('operator')
            prefix = {'JR四国': '118', 'JR九州': '119', '近畿日本鉄道': '310',
                      '名古屋鉄道': '300', '阪急電鉄': '340', '京阪電気鉄道': '330',
                      '南海電気鉄道': '320', 'JR北海道': '111', '東武鉄道': '210',
                      '秋田内陸縦貫鉄道': '99209', '一畑電車': ('99702', '99703'),
                      '筑豊電気鉄道': '99909'}.get(operator)
            if candidate.get('reference_codes'):
                applicable = bool(set(candidate['reference_codes']) & set(row['reference_codes'].split(' | ')))
            elif prefix:
                applicable = any(r['code'].startswith(prefix) for r in codes)
            else:
                region = candidate.get('region')
                applicable = any(r['code'].startswith(('111', '112', '113', '114'))
                    and 0 < int(r.get('prefecture', 0)) <= len(PREFECTURES)
                    and PREFECTURES[int(r['prefecture'])-1] == region for r in codes)
            if applicable:
                matches.append(candidate)
        if not matches:
            continue
        readings = sorted({normalize(r['kana']) for r in matches})
        current = normalize(row['kana'])
        verdict = ('source-conflict' if len(readings) > 1 else
                   'correct' if current == readings[0] else 'primary-difference')
        if len(readings) == 1 and re.sub(r'\s+', '', current) == readings[0] and current != readings[0]:
            verdict = 'spacing-only'
        notation_pairs = {
            ('ファミリー公園前', 'ふぁみりーこうえんまえ', 'ふぁみりいこうえんまえ'),
            ('恩智', 'おんじ', 'おんぢ'),
            ('家地川', 'いえじがわ', 'いえぢがわ'),
            ('手力', 'てじから', 'てぢから'),
            ('郡津', 'こおづ', 'こうづ'),
            ('志都美', 'しづみ', 'しずみ'),
            ('保津峡', 'ほずきょう', 'ほづきょう'),
            ('近江今津', 'おおみいまず', 'おうみいまづ'),
            ('穴生', 'あのう', 'あのお'),
        }
        if len(readings) == 1 and (row['name'], current, readings[0]) in notation_pairs:
            verdict = 'official-spelling-difference'
        for match in matches:
            if len(readings) == 1 and match.get('reviewed_current_kana') == row['kana'] and match.get('review_verdict') in {
                'spelling-unverified', 'name-scope-difference', 'punctuation-only', 'phonetic-match',
                'official-spelling-difference'}:
                if match['review_verdict'] == 'phonetic-match' and any(
                    r.get('evidence_kind', 'kana-text') == 'kana-text' for r in matches):
                    continue
                verdict = match['review_verdict']
        checks.append(dict(dataset=row['dataset'], index=row['index'], name=row['name'],
            lat=row['lat'], lng=row['lng'], current_kana=row['kana'],
            official_kana=' | '.join(readings), verdict=verdict,
            evidence_kinds=' | '.join(sorted({r.get('evidence_kind', 'kana-text') for r in matches})),
            evidence=' | '.join(sorted({r['evidence'] for r in matches if r.get('evidence')})),
            sources=' | '.join(sorted({r['source'] for r in matches}))))
    return checks


def main():
    source, output = Path(sys.argv[1]), Path(sys.argv[2])
    output.mkdir(parents=True, exist_ok=True)
    reference = (json.loads(source.read_text()) if source.suffix == '.json'
                 else list(csv.DictReader(source.open(encoding='utf-8-sig'))))
    by_name = defaultdict(list)
    by_alias = defaultdict(list)
    for row in reference:
        for name in {row['name'], row['original_name']}:
            by_name[normalize(name)].append(row)
        for alias in aliases(row['name']) | aliases(row['original_name']):
            by_alias[alias].append(row)
    osm = json.loads((ROOT/'data/stations-osm.json').read_text())
    curated = json.loads(subprocess.check_output(
        ['node', '--input-type=module', '-e',
         "import {stations} from './data/stations.js'; console.log(JSON.stringify(stations))"],
        cwd=ROOT, text=True))
    results = []
    for kind, stations in [('osm', osm), ('curated', curated)]:
        for index, station in enumerate(stations):
            nearby = [(distance(station, r), r) for r in by_name[normalize(station['name'])]]
            nearby = sorted(((d, r) for d, r in nearby if d <= 1000), key=lambda pair: pair[0])
            method = 'exact'
            if not nearby:
                candidates = {r['code']: r for alias in aliases(station['name']) for r in by_alias[alias]}
                nearby = sorted(((distance(station, r), r) for r in candidates.values()
                                 if distance(station, r) <= 1000), key=lambda pair: pair[0])
                method = 'name-variant' if nearby else ''
            readings = sorted(set(normalize(r['name_kana']) for _, r in nearby))
            current = normalize(station.get('kana', ''))
            status = ('unmatched' if not nearby else 'ambiguous' if len(readings) != 1
                      else 'match' if current == readings[0] else 'different')
            results.append(dict(dataset=kind, index=index, name=station['name'],
                kana=station.get('kana', ''), lat=station['lat'], lng=station['lng'],
                status=status, match_method=method, reference_kana=' | '.join(readings),
                distance_m=round(nearby[0][0]) if nearby else '',
                reference_codes=' | '.join(r['code'] for _, r in nearby),
                reference_closed=' | '.join(sorted(set(r['closed'] for _, r in nearby)))))
    with (output/'all.csv').open('w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(results[0]))
        writer.writeheader()
        writer.writerows(results)
    for status in ['different', 'unmatched', 'ambiguous']:
        with (output/f'{status}.csv').open('w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=list(results[0]))
            writer.writeheader()
            writer.writerows(r for r in results if r['status'] == status)
    summary = dict(reference_rows=len(reference), reference_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                   counts={kind: dict(Counter(r['status'] for r in results if r['dataset']==kind))
                           for kind in ['osm', 'curated']})
    official_path = output/'official-reference.json'
    if official_path.exists():
        checks = official_checks(results, reference, json.loads(official_path.read_text()))
        with (output/'official-checks.csv').open('w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=list(checks[0]))
            writer.writeheader()
            writer.writerows(checks)
        summary['official_counts'] = dict(Counter(r['verdict'] for r in checks))
        checked = {(r['dataset'], r['index']) for r in checks
                   if r['verdict'] not in {'source-conflict', 'spelling-unverified'}}
        verified_path = output/'verified.json'
        verified = json.loads(verified_path.read_text()) if verified_path.exists() else []
        confirmed = {(r['name'], float(r['lat']), float(r['lng']), r['current_kana']) for r in verified}
        current = {(r['name'], float(r['lat']), float(r['lng']), r['kana']) for r in results}
        active_verified = [r for r in verified
            if (r['name'], float(r['lat']), float(r['lng']), r['current_kana']) in current]
        summary['verified_errors'] = len(active_verified)
        summary['stale_verified_records'] = len(verified) - len(active_verified)
        review_path = output/'manual-reviews.json'
        reviews = json.loads(review_path.read_text()) if review_path.exists() else []
        active_reviews = active_manual_reviews(reviews, current)
        reviewed = {(r['name'], float(r['lat']), float(r['lng']), r['current_kana'])
                    for r in active_reviews}
        summary['manual_review_counts'] = dict(Counter(r['verdict'] for r in active_reviews))
        summary['stale_manual_reviews'] = len(reviews) - len(active_reviews)
        if active_verified:
            with (output/'verified.csv').open('w', encoding='utf-8', newline='') as f:
                fields = list(dict.fromkeys(k for r in active_verified for k in r))
                writer = csv.DictWriter(f, fieldnames=fields)
                writer.writeheader()
                writer.writerows(active_verified)
        pending = [r for r in results if r['status'] != 'match'
            and (r['dataset'], r['index']) not in checked
            and (r['name'], float(r['lat']), float(r['lng']), r['kana']) not in confirmed
            and (r['name'], float(r['lat']), float(r['lng']), r['kana']) not in reviewed]
        with (output/'pending.csv').open('w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=list(results[0]))
            writer.writeheader()
            writer.writerows(pending)
        summary['pending_candidates'] = len(pending)
    (output/'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
