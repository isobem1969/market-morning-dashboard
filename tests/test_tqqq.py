import datetime as dt
import json
import pathlib
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
import update_data as c
import update_drawdowns as d

class TQQQTest(unittest.TestCase):
    def payload(self, currency='USD', start='2010-02-11'):
        dates=[start,'2025-01-02','2026-01-02','2026-11-03']
        times=[int(dt.datetime.fromisoformat(day+'T21:00:00+00:00').timestamp()) for day in dates]
        return json.dumps({'chart':{'result':[{'meta':{'symbol':'TQQQ','currency':currency,'exchangeTimezoneName':'America/New_York'},'timestamp':times,'indicators':{'quote':[{'close':[100,50,75,80]}]}}]}})

    def test_uses_inception_close_history_and_keeps_peak_across_years(self):
        with patch.object(c,'fetch',return_value=self.payload()) as fetch:
            result=c.tqqq_history()
        self.assertIn('period1=0',fetch.call_args.args[0])
        self.assertEqual(result['value'],80)
        self.assertEqual(result['change'],5)
        self.assertEqual(result['peak'],100)
        dd=d.comparison_points([(p['date'],p['value']) for p in result['history']],'TQQQ','https://example.test','test')
        self.assertEqual(dd['years']['2025'][0]['value'],-50)
        self.assertEqual(dd['years']['2026'][-1]['value'],-20)

    def test_rejects_wrong_currency_or_truncated_history(self):
        for content in [self.payload(currency='JPY'),self.payload(start='2024-01-01')]:
            with patch.object(c,'fetch',return_value=content),self.assertRaises(ValueError):
                c.tqqq_history()

    def test_tqqq_follows_schd(self):
        self.assertEqual(list(c.SOURCES)[-3:],['schd','tqqq','soxl'])

