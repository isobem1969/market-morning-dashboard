import datetime as dt
import json
import pathlib
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'scripts'))
import update_heatmap as h

class HeatmapTest(unittest.TestCase):
    def fixture(self):
        dates=['2026-09-18','2026-09-21','2026-10-13','2026-10-16','2026-10-19','2026-10-20']
        stamps=[int(dt.datetime.fromisoformat(d+'T13:30:00+00:00').timestamp()) for d in dates]
        return {'meta':{'symbol':'AAPL','instrumentType':'EQUITY','currency':'USD','dataGranularity':'1d',
            'regularMarketTime':int(dt.datetime.fromisoformat('2026-10-20T20:00:00+00:00').timestamp()),
            'regularMarketPrice':120,'regularMarketVolume':12345,'regularMarketDayHigh':121,'regularMarketDayLow':115,
            'currentTradingPeriod':{'regular':{'start':stamps[-1],'end':int(dt.datetime.fromisoformat('2026-10-20T20:00:00+00:00').timestamp())}}},
            'timestamp':stamps,'indicators':{'quote':[{'close':[80,85,100,108,110,120],'high':[81,86,101,109,111,121],'volume':[100]*6}]}}

    def test_real_periods_have_independent_reference_prices(self):
        r=h.observation(self.fixture(),'AAPL',dt.datetime.fromisoformat('2026-10-20T21:00:00+00:00'))
        self.assertEqual(r['value'],120)
        self.assertEqual(r['periods']['1d']['referencePrice'],110)
        self.assertAlmostEqual(r['periods']['1w']['changePct'],20)
        self.assertEqual(r['periods']['1m']['referenceDate'],'2026-09-18')
        self.assertEqual(r['periods']['1m']['referencePrice'],80)
        self.assertEqual(r['volume'],12345)
        self.assertFalse(r['marketOpen'])

    def test_before_open_does_not_use_current_future_session(self):
        r=h.observation(self.fixture(),'AAPL',dt.datetime.fromisoformat('2026-10-20T12:00:00+00:00'))
        self.assertEqual(r['value'],110)
        self.assertEqual(r['sessionDate'],'2026-10-19')
        self.assertEqual(r['periods']['1d']['referenceDate'],'2026-10-16')

    def test_short_history_and_failed_fetch_do_not_invent_values(self):
        f=self.fixture()
        f['timestamp']=f['timestamp'][-1:]
        f['indicators']['quote'][0]={k:v[-1:] for k,v in f['indicators']['quote'][0].items()}
        now=dt.datetime.fromisoformat('2026-10-20T21:00:00+00:00')
        self.assertIsNone(h.observation(f,'AAPL',now)['periods']['1m'])
        old={'value':100,'lastSuccess':'2026-10-19T20:00:00Z','sessionDate':'2026-10-19'}
        with patch.object(h,'fetch',side_effect=ValueError('unavailable')):
            r=h.collect('AAPL','アップル',old,now)
        self.assertEqual(r['status'],'error')
        self.assertEqual(r['value'],100)
        self.assertEqual(r['lastSuccess'],old['lastSuccess'])

    def test_calendar_month_clamps_and_issuer_is_checked(self):
        self.assertEqual(h.month_before(dt.date(2026,3,31)),dt.date(2026,2,28))
        with self.assertRaises(ValueError):
            h.observation(self.fixture(),'MSFT',dt.datetime.fromisoformat('2026-10-20T21:00:00+00:00'))
