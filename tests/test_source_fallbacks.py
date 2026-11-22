import datetime as dt
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from source_support import choose_sources, SourcesUnavailable, expected_date, yahoo_fetch
from update_data import parse_sbi_history, collect_one
from update_stocks import parse_current_japan, parse_statistics


class SourceFallbackTests(unittest.TestCase):
    def test_403_and_stale_success_fall_through_to_current_source(self):
        def denied(): raise PermissionError('403 Forbidden')
        result=choose_sources([('issuer','https://issuer/',denied),
            ('old','https://old/',lambda:{'asOf':'2026-10-29','value':98383}),
            ('backup','https://backup/',lambda:{'asOf':'2026-11-20','value':87787})],minimum_date='2026-11-20')
        self.assertEqual(result['value'],87787)
        self.assertEqual(result['source'],'backup')
        self.assertEqual([a['status'] for a in result['sourceAttempts']],['error','error','ok'])

    def test_total_failure_preserves_original_value_and_dates_but_reports_attempts(self):
        now=dt.datetime(2026,11,22,tzinfo=dt.timezone.utc)
        old={'value':98383,'asOf':'2026-10-29','lastSuccess':'2026-10-30T07:15:00Z','history':[]}
        error=SourcesUnavailable([{'name':'issuer','url':'https://issuer/','status':'error','error':'403'}])
        with patch.dict('update_data.ADAPTERS',{'fang':lambda:(_ for _ in ()).throw(error)}):
            result=collect_one('fang',old,now)
        self.assertEqual(result['status'],'error');self.assertEqual(result['value'],98383)
        self.assertEqual(result['lastSuccess'],old['lastSuccess']);self.assertEqual(result['asOf'],old['asOf'])
        self.assertEqual(result['sourceAttempts'][0]['status'],'error')

    def test_sbi_nav_uses_correct_fund_class_and_dated_nav_not_reinvestment(self):
        text='"ファンド名","ｉＦｒｅｅＮＥＸＴ　ＦＡＮＧ＋インデックス"\n"年月日","基準価額（円）","前日比（円）"\n"2026/11/20","87787","-2207"\n"2026/10/29","98383","630"\n'
        result=parse_sbi_history(text,'fang')
        self.assertEqual(result['value'],87787);self.assertEqual(result['asOf'],'2026-11-20')
        self.assertEqual([p['date'] for p in result['history']],['2026-10-29','2026-11-20'])
        for bad in [text.replace('FＡＮＧ','NASDAQ'),text.replace('インデックス','インデックス（毎月決算）'),text.replace('2026/10/29','2026/11/20')]:
            if bad==text:continue
            with self.assertRaises(ValueError):parse_sbi_history(bad,'fang')
        with self.assertRaises(ValueError):parse_sbi_history(text,'nasdaq_ifree')

    def test_japanese_holiday_weekend_and_publication_grace(self):
        utc=dt.timezone.utc
        self.assertEqual(expected_date(now=dt.datetime(2026,11,23,14,tzinfo=utc)),'2026-11-20')
        self.assertEqual(expected_date(now=dt.datetime(2026,11,24,10,tzinfo=utc)),'2026-11-20')
        self.assertEqual(expected_date(now=dt.datetime(2026,11,24,14,tzinfo=utc)),'2026-11-24')
        self.assertEqual(expected_date('XNYS','daily',dt.datetime(2026,11,27,18,30,tzinfo=utc)),'2026-11-25')
        self.assertEqual(expected_date('XNYS','daily',dt.datetime(2026,11,27,19,1,tzinfo=utc)),'2026-11-27')

    def test_secondary_yahoo_host_keeps_exact_issuer_and_query(self):
        seen=[]
        def reader(url):
            seen.append(url)
            if len(seen)==1:raise OSError('unavailable')
            return json.dumps({'chart':{'result':[{'meta':{'symbol':'AAPL'}}]}})
        self.assertIn('AAPL',yahoo_fetch(reader,'https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d'))
        self.assertEqual(seen[1],'https://query2.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d')

    def test_new_japan_html_records_unpublished_without_accepting_masked_or_wrong_issuer(self):
        text='<link rel="canonical" href="https://finance.yahoo.co.jp/quote/AAPL">'
        for name,value in [('PER','---'),('PBR','44.43')]:
            text+=f'<dl><dt><span class="_DataListItem__name_x">{name}</span>（実績）</dt><dd><span class="_StyledNumber__value_x">{value}</span><span class="_DataListItem__date_x">(11/20)</span></dd></dl>'
        result=parse_current_japan(text,'AAPL')
        self.assertEqual(result['ratios']['per']['availability'],'unpublished')
        self.assertEqual(result['ratios']['pbr']['value'],44.43)
        for bad,symbol in [(text,'MSFT'),(text.replace('44.43','000.00'),'AAPL')]:
            with self.assertRaises(ValueError):parse_current_japan(bad,symbol)

if __name__=='__main__':unittest.main()
