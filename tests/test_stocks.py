import datetime as dt
import json
import pathlib
import sys
import unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'scripts'))
from update_stocks import parse_japan, price_observation, section, high_observation, parse_research, collect_research
from unittest.mock import patch

class StockTests(unittest.TestCase):
    def test_highs_separate_52_weeks_and_full_history(self):
        dates=['2020-01-02T14:30:00+00:00','2025-10-07T13:30:00+00:00','2026-10-07T13:30:00+00:00','2026-10-08T13:30:00+00:00']
        stamps=[int(dt.datetime.fromisoformat(d).timestamp()) for d in dates]
        data={'meta':{'dataGranularity':'1d','firstTradeDate':stamps[0]},'timestamp':stamps,'indicators':{'quote':[{'high':[200,180,150,999]}],'adjclose':[{'adjclose':[999,999,999,999]}]}}
        result=high_observation(data,'AAPL',dt.datetime.fromisoformat('2026-10-07T15:00:00+00:00'))
        self.assertEqual(result['week52']['value'],150)
        self.assertEqual(result['allTime']['value'],200)
        self.assertTrue(result['allTime']['complete'])
        self.assertFalse(high_observation(data,'LLY',dt.datetime.fromisoformat('2026-10-07T15:00:00+00:00'))['allTime']['complete'])
        data['meta']['firstTradeDate']=stamps[0]-86400*100
        self.assertFalse(high_observation(data,'AAPL',dt.datetime.fromisoformat('2026-10-07T15:00:00+00:00'))['allTime']['complete'])

    def test_highs_exclude_reused_ticker_history(self):
        stamps=[int(dt.datetime(2020,1,2,tzinfo=dt.timezone.utc).timestamp()),int(dt.datetime(2026,6,12,14,tzinfo=dt.timezone.utc).timestamp())]
        data={'meta':{'dataGranularity':'1d','longName':'SpaceX'},'timestamp':stamps,'indicators':{'quote':[{'high':[9999,100]}]}}
        result=high_observation(data,'SPCX',dt.datetime(2026,10,7,tzinfo=dt.timezone.utc))
        self.assertEqual(result['allTime']['value'],100)
        self.assertTrue(result['allTime']['complete'])
        data['meta']['longName']='Old ETF'
        with self.assertRaises(ValueError):high_observation(data,'SPCX',dt.datetime.now(dt.timezone.utc))

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


    def test_research_reads_issuer_matched_public_yahoo_payload(self):
        result={'price':{'symbol':'GOOGL','quoteType':'EQUITY','currency':'USD'},'financialData':{'targetMeanPrice':{'raw':430.33},'recommendationKey':'strong_buy','numberOfAnalystOpinions':{'raw':54}}}
        payload={'status':200,'body':json.dumps({'quoteSummary':{'result':[result]}})}
        text='<script type="application/json" data-sveltekit-fetched data-url="https://query1.finance.yahoo.com/v10/finance/quoteSummary/GOOGL?formatted=true">'+json.dumps(payload)+'</script>'
        value=parse_research(text,'GOOGL')
        self.assertEqual(value['target'],430.33)
        self.assertEqual(value['recommendation'],'strong_buy')
        self.assertEqual(value['analysts'],54)
        self.assertIsNone(value['publishedAt'])
        with self.assertRaises(ValueError):parse_research(text,'AAPL')
        with self.assertRaises(ValueError):parse_research('<html>Access denied</html>','GOOGL')

    def test_research_caches_recent_success_and_preserves_dates_on_failure(self):
        now=dt.datetime(2026,10,22,tzinfo=dt.timezone.utc)
        old={'target':400,'status':'ok','lastSuccess':(now-dt.timedelta(hours=2)).isoformat()}
        with patch('update_stocks.fetch') as fetch:
            self.assertEqual(collect_research('GOOGL',old,now),old)
            fetch.assert_not_called()
        old['lastSuccess']=(now-dt.timedelta(hours=8)).isoformat()
        with patch('update_stocks.fetch',side_effect=ValueError('blocked')):
            result=collect_research('GOOGL',old,now)
        self.assertEqual(result['status'],'error')
        self.assertEqual(result['target'],400)
        self.assertEqual(result['lastSuccess'],old['lastSuccess'])


if __name__=='__main__':unittest.main()
