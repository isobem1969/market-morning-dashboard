import datetime as dt
import json
import pathlib
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
import update_data as c
import update_drawdowns as d
import update_rsi as r
import exchange_calendars as xcals

class SoxlTest(unittest.TestCase):
 def payload(self,symbol='SOXL',currency='USD',start='2010-03-11'):
  dates=[start,'2024-12-20','2025-01-02','2026-01-02','2026-11-12']
  times=[int(dt.datetime.fromisoformat(day+'T21:00:00+00:00').timestamp()) for day in dates]
  return json.dumps({'chart':{'result':[{'meta':{'symbol':symbol,'currency':currency,'exchangeTimezoneName':'America/New_York'},'timestamp':times,'indicators':{'quote':[{'close':[1,200,100,120,150]}]}}]}})
 def test_collects_soxl_inception_prices_not_tqqq(self):
  with patch.object(c,'fetch',return_value=self.payload()) as fetch:
   value=c.soxl_history()
  self.assertIn('/SOXL?period1=0',fetch.call_args.args[0])
  self.assertEqual(value['value'],150);self.assertEqual(value['change'],30)
  self.assertEqual(value['peak'],200);self.assertEqual(value['history'][0]['date'],'2010-03-11')
  dd=d.comparison_points([(p['date'],p['value']) for p in value['history']],'SOXL','https://example.test','test')
  self.assertEqual(dd['years']['2025'][0]['value'],-50)
  self.assertEqual(dd['years']['2026'][-1]['value'],-25)
 def test_rejects_wrong_symbol_currency_and_truncation(self):
  for payload in [self.payload(symbol='TQQQ'),self.payload(currency='JPY'),self.payload(start='2024-01-01')]:
   with self.subTest(payload=payload),patch.object(c,'fetch',return_value=payload),self.assertRaises(ValueError):c.soxl_history()
 def test_drawdown_source_and_order(self):
  self.assertEqual(list(c.SOURCES)[-2:],['tqqq','soxl'])
  with patch.object(d,'soxl_history',return_value={'history':[{'date':'2024-12-20','value':200},{'date':'2025-01-02','value':100},{'date':'2026-01-02','value':150}]}) as f:
   value=d.extra_comparison('soxl')
  f.assert_called_once();self.assertIn('/SOXL/',value['sourceUrl']);self.assertEqual(value['years']['2026'][0]['value'],-25)
 def test_rsi_keeps_ndx_signal_and_adds_soxl_comparison(self):
  cal=xcals.get_calendar('XNYS',start='2024-01-01',end='2027-12-31')
  dates=[s.date().isoformat() for s in cal.sessions_in_range('2024-01-02','2026-11-06')]
  now=dt.datetime(2026,11,7,12,tzinfo=dt.timezone.utc)
  meta={'currentTradingPeriod':{'regular':{'start':1793975400,'end':1793998800}}}
  calls=[]
  def daily(symbol):
   calls.append(symbol);base={'^NDX':1000,'TQQQ':50,'SOXL':10}[symbol]
   return meta,[{'date':day,'value':base+i*.01} for i,day in enumerate(dates)]
  with patch.object(r,'daily',side_effect=daily):value=r.collect(now)
  self.assertCountEqual(calls,['^NDX','TQQQ','SOXL'])
  self.assertEqual(set(value['prices']),{'ndx','tqqq','soxl'})
  self.assertAlmostEqual(value['prices']['soxl']['value'],10+(len(dates)-1)*.01)
  self.assertEqual(value['confirmed']['rsi'],100)
if __name__=='__main__':unittest.main()
