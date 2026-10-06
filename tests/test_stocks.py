import datetime as dt
import json
import pathlib
import sys
import unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'scripts'))
from update_stocks import parse_japan, price_observation, section

class StockTests(unittest.TestCase):
    def test_sentiment_keeps_neutral_and_missing_ratios(self):
        state = {'mainUsStocksPriceBoard': {'code': 'AAPL'}, 'mainUsStocksReferenceIndex': {'per': {'value': '44.72', 'updateDate': '10/06'}, 'pbr': {'value': '---'}}, 'feelingGraph': {'feels': [{'type': k, 'percentage': v} for k, v in zip(['strongest','strong','both','weak','weakest'],[40,20,15,10,15])]}}
        result = parse_japan('window.__PRELOADED_STATE__ = '+json.dumps(state)+';', 'AAPL')
        self.assertEqual(result['sentiment'], {'buy':60,'hold':15,'sell':25})
        self.assertIsNone(result['ratios']['pbr']['value'])
        state['feelingGraph']['feels'] = []
        self.assertIsNone(parse_japan('window.__PRELOADED_STATE__ = '+json.dumps(state), 'AAPL')['sentiment'])

    def test_after_close_uses_just_completed_close_before_open_uses_previous_session(self):
        stamp=lambda s:int(dt.datetime.fromisoformat(s).timestamp())
        daily={'timestamp':[stamp('2026-10-05T13:30:00+00:00'),stamp('2026-10-06T13:30:00+00:00')], 'indicators':{'quote':[{'close':[100,105]}]}}
        meta={'regularMarketPrice':104,'regularMarketTime':stamp('2026-10-06T19:59:00+00:00'),'currentTradingPeriod':{'regular':{'start':stamp('2026-10-06T13:30:00+00:00'),'end':stamp('2026-10-06T20:00:00+00:00')}}}
        after=price_observation(daily,{'meta':meta},dt.datetime.fromisoformat('2026-10-06T20:30:00+00:00'))
        self.assertEqual(after['value'],105);self.assertEqual(after['change'],5);self.assertFalse(after['marketOpen'])
        before=price_observation(daily,{'meta':meta},dt.datetime.fromisoformat('2026-10-06T12:00:00+00:00'))
        self.assertEqual(before['value'],100)
        during=price_observation(daily,{'meta':meta},dt.datetime.fromisoformat('2026-10-06T19:59:30+00:00'))
        self.assertEqual(during['value'],104);self.assertEqual(during['change'],4)

    def test_failure_preserves_original_dates(self):
        old={'value':123,'lastSuccess':'2026-10-05T20:00:00Z'}
        def fail():raise ValueError('unavailable')
        result=section(fail,old,dt.datetime.now(dt.timezone.utc))
        self.assertEqual(result['value'],123);self.assertEqual(result['lastSuccess'],old['lastSuccess']);self.assertEqual(result['status'],'error')

if __name__=='__main__':unittest.main()
