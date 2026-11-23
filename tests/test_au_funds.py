import datetime as dt
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import update_data as c
from update_drawdowns import comparison_points

HEADER = '基準日,基準価額,分配金,分配金再投資基準価額,純資産総額\n'
CSV = HEADER + '20261015,10000,,10000,19.51\n20261119,7176,,99999,42.64\n20261120,6713,,99999,40.82\n'

class AuFundTests(unittest.TestCase):
    def test_nav_not_reinvested_value_and_full_history_peak(self):
        r = c.parse_au_history(CSV, 'au_nasdaq_triple', 2)
        self.assertEqual((r['value'], r['change'], r['peak']), (6713, -463, 10000))
        self.assertEqual(r['historyStart'], '2026-10-15')
        self.assertEqual(len(r['history']), 2)

    def test_rejects_schema_duplicates_invalid_dates_and_prices(self):
        for bad in [CSV.replace('基準価額,', '価格,'), CSV + '20261120,6713,,6713,40\n', CSV.replace('20261119', '20260230'), CSV.replace('6713,', 'nan,'), CSV.replace('6713,', '0,'), CSV.replace('20261015', '20261014')]:
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                c.parse_au_history(bad, 'au_nasdaq_triple')

    def test_both_funds_fall_back_on_denied_or_old_issuer(self):
        for key, code in c.AU_FUNDS.items():
            name = c.SOURCES[key][0]
            backup = f'"ファンド名","{name}"\n"年月日","基準価額（円）"\n"2026/11/19","7176"\n"2026/11/20","6713"\n'
            for stale in [False, True]:
                def reader(url, encoding=None):
                    if 'kddi-am.com' in url:
                        if stale: return CSV.replace('20261120', '20261118').replace('20261119', '20261117')
                        raise PermissionError('403 Forbidden')
                    self.assertIn(c.FUND_BACKUPS[key][0], url)
                    return backup
                with patch.object(c, 'fetch', reader), patch.object(c, 'expected_date', return_value='2026-11-20'):
                    r = c.fund_history(key)
                self.assertEqual(r['sourceAttempts'][0]['status'], 'error')
                self.assertEqual(r['sourceAttempts'][1]['status'], 'ok')
                self.assertEqual(r['value'], 6713)
                self.assertIn('取得済み期間 2026-11-19〜2026-11-20', r['historyNote'])
            with self.assertRaises(ValueError):
                c.parse_sbi_history(backup, 'au_nasdaq_leverage' if key == 'au_nasdaq_triple' else 'au_nasdaq_triple')

    def test_total_failure_retains_saved_value_and_original_dates(self):
        old = {'value': 6713, 'asOf': '2026-11-20', 'lastSuccess': '2026-11-20T15:00:00Z', 'history': []}
        with patch.object(c, 'fetch', side_effect=PermissionError('403')), patch.object(c, 'expected_date', return_value='2026-11-20'):
            r = c.collect_one('au_nasdaq_triple', old, dt.datetime.now(dt.timezone.utc))
        self.assertEqual(r['status'], 'error')
        for key in old: self.assertEqual(r[key], old[key])
        self.assertEqual(len(r['sourceAttempts']), 2)

    def test_new_fund_has_only_real_current_year_drawdowns(self):
        nav = c.parse_au_history(CSV, 'au_nasdaq_triple')
        r = comparison_points([(p['date'], p['value']) for p in nav['history']], 'triple', 'https://www.kddi-am.com/funds/4011/', 'issuer')
        self.assertEqual(r['years']['2025'], [])
        self.assertAlmostEqual(r['years']['2026'][-1]['value'], -32.87)
        self.assertEqual(r['startDate'], '2026-10-15')

if __name__ == '__main__': unittest.main()
