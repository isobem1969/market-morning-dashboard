import datetime as dt
import json
import pathlib
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'scripts'))
import update_stocks as c

class BerkshireClassATests(unittest.TestCase):
    def test_chart_and_analysis_never_accept_class_b(self):
        wrong = {'chart': {'result': [{'meta': {'symbol': 'BRK-B', 'instrumentType': 'EQUITY'}}]}}
        with patch.object(c, 'yahoo_fetch', return_value=json.dumps(wrong)):
            with self.assertRaises(ValueError): c.chart('BRK-A', '1d', '5y')
        payload = {'quoteSummary': {'result': [{'price': {'symbol': 'BRK-B', 'quoteType': 'EQUITY', 'currency': 'USD'}, 'financialData': {'targetMeanPrice': {'raw': 600}}}]}}
        html = '<script data-sveltekit-fetched data-url="/quoteSummary/BRK-A?modules=price">' + json.dumps({'status': 200, 'body': json.dumps(payload)}) + '</script>'
        with self.assertRaises(ValueError): c.parse_research(html, 'BRK-A')

    def test_failed_refresh_keeps_class_a_values_and_display_identity(self):
        stamp = '2026-11-23T21:00:00Z'
        saved = {'status': 'ok', 'value': 859191, 'lastSuccess': stamp}
        old = {k: dict(saved) for k in ['price', 'highs', 'japan', 'research']}
        now = dt.datetime(2026, 11, 24, tzinfo=dt.timezone.utc)
        with patch.object(c, 'fetch', side_effect=OSError('unavailable')):
            stock = c.collect('BRK-A', 'バークシャー・ハサウェイA', old, now)
        self.assertEqual(stock['displaySymbol'], 'BRK.A')
        self.assertEqual(stock['exchange'], 'NYSE')
        self.assertEqual(stock['price']['value'], 859191)
        self.assertEqual(stock['price']['lastSuccess'], stamp)
        self.assertEqual(stock['price']['status'], 'error')

if __name__ == '__main__': unittest.main()
