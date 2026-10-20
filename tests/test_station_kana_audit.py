"""Checks for the identity and evidence rules used by the offline audit."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location(
    'station_audit', Path(__file__).parents[1] / 'scripts/auditStationKana.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class StationAuditEvidenceTests(unittest.TestCase):
    def fixture(self):
        result = dict(dataset='osm', index=0, name='人吉', lat=32.216, lng=130.754,
                      kana='ひとよし', reference_codes='1191819')
        reference = [dict(code='1191819', prefecture='43')]
        return result, reference

    def test_same_name_requires_the_station_code_matched_by_coordinates(self):
        result, reference = self.fixture()
        source = dict(name='人吉', kana='ひとよしおんせん', reference_codes=['9992001'],
                      source='https://example.test/another-station')
        self.assertEqual(audit.official_checks([result], reference, [source]), [])

    def test_primary_kana_can_confirm_the_current_value_against_a_bad_reference(self):
        result, reference = self.fixture()
        source = dict(name='人吉', kana='ひとよし', operator='JR九州',
                      source='https://example.test/kana')
        check = audit.official_checks([result], reference, [source])[0]
        self.assertEqual(check['verdict'], 'correct')
        self.assertEqual(check['official_kana'], 'ひとよし')

    def test_a_review_annotation_cannot_hide_conflicting_primary_sources(self):
        result, reference = self.fixture()
        common = dict(name='人吉', reference_codes=['1191819'],
                      source='https://example.test/roman', evidence_kind='romanization',
                      reviewed_current_kana='ひとよし', review_verdict='phonetic-match')
        sources = [dict(common, kana='ひとよし'), dict(common, kana='ひとよしおんせん')]
        self.assertEqual(audit.official_checks([result], reference, sources)[0]['verdict'],
                         'source-conflict')

    def test_previous_review_does_not_apply_after_the_current_value_changes(self):
        result, reference = self.fixture()
        result['kana'] = 'まちがい'
        source = dict(name='人吉', kana='ひとよし', reference_codes=['1191819'],
                      source='https://example.test/roman', reviewed_current_kana='ひとよし',
                      review_verdict='phonetic-match')
        self.assertEqual(audit.official_checks([result], reference, [source])[0]['verdict'],
                         'primary-difference')

    def test_kanji_variants_are_name_aliases_not_invented_kana(self):
        self.assertEqual(audit.name_key('苧ヶ瀬'), audit.name_key('苧ケ瀬'))
        self.assertTrue(audit.aliases('飛驒細江') & audit.aliases('飛騨細江'))
        self.assertTrue(audit.aliases('祗園新橋北') & audit.aliases('祇園新橋北'))
        self.assertEqual(audit.normalize('安子ヶ島'), '安子ヶ島')

    def test_manual_classification_expires_when_current_reading_changes(self):
        review = dict(name='仮称駅', lat=35, lng=139, current_kana='かしょうえき',
                      verdict='planned')
        current = {('仮称駅', 35.0, 139.0, 'かしょうえき')}
        self.assertEqual(audit.active_manual_reviews([review], current), [review])
        self.assertEqual(audit.active_manual_reviews(
            [review], {('仮称駅', 35.0, 139.0, 'べつのよみ')}), [])

    def test_unknown_manual_verdict_cannot_remove_a_pending_candidate(self):
        review = dict(name='仮称駅', lat=35, lng=139, current_kana='かしょうえき',
                      verdict='unverified')
        self.assertEqual(audit.active_manual_reviews(
            [review], {('仮称駅', 35.0, 139.0, 'かしょうえき')}), [])

    def test_distant_identical_names_are_not_close(self):
        self.assertGreater(audit.distance(dict(lat=35.7, lng=139.7),
                                          dict(lat=34.7, lng=135.5)), 1000)


if __name__ == '__main__':
    unittest.main()
