import datetime as dt
import importlib.util
import pathlib
import unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('collector',pathlib.Path(__file__).resolve().parents[1]/'scripts/update_data.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)

class CollectorTest(unittest.TestCase):
    def test_failure_preserves_original_observation_date(self):
        previous={'value':31,'asOf':'2026-09-30','lastSuccess':'2026-09-30T10:00:00Z','history':[]}
        with patch.dict(c.ADAPTERS,{'fear':lambda: (_ for _ in ()).throw(ValueError('blocked'))}):
            result=c.collect_one('fear',previous,dt.datetime(2026,10,1,tzinfo=c.UTC))
        self.assertEqual(result['asOf'],previous['asOf'])
        self.assertEqual(result['lastSuccess'],previous['lastSuccess'])
        self.assertEqual(result['status'],'error')

    def test_csv_sorts_and_uses_real_peak(self):
        result=c.parse_fund_csv('基準日,基準価額\n20261001,11000\n20260929,12000\n20260930,10000\n','fang')
        self.assertEqual(result['value'],11000)
        self.assertEqual(result['change'],1000)
        self.assertEqual(result['peak'],12000)

    def test_nasdaq_zero_change_is_valid(self):
        html='<span class="fprice">10,000</span><span class="ptdate">2026年10月01日</span><div class="fprice">0円（0.00%）</div>'
        with patch.object(c,'fetch',return_value=html):
            result=c.nasdaq_page()
        self.assertEqual(result['value'],10000)
        self.assertEqual(result['change'],0)

    def test_future_and_regressed_observations_rejected(self):
        now=dt.datetime(2026,10,1,tzinfo=c.UTC)
        for new,old in [('2026-10-10',{}),('2026-09-20',{'asOf':'2026-09-30'})]:
            with self.assertRaises(ValueError):
                c.merge_observation('vix',{'asOf':new,'history':[]},old,now)

class FearFeedTest(unittest.TestCase):
    def test_direct_failure_uses_dated_external_feed(self):
        feed={'dates':['2026-09-30','2026-10-01'],'values':[29,28]}
        with patch.object(c, 'cnn_direct', side_effect=ValueError('418')), patch.object(c, 'fetch', return_value=c.json.dumps(feed)):
            result=c.collect_one('fear',{},dt.datetime(2026,10,2,tzinfo=c.UTC))
        self.assertEqual(result['status'],'ok')
        self.assertEqual(result['value'],28)
        self.assertEqual(result['asOf'],'2026-10-01')
        self.assertEqual(result['change'],-1)
        self.assertIn('外部配信',result['source'])
        self.assertEqual(result['sourceUrl'],'https://fearandgreedgraph.com/data')

    def test_direct_source_is_preferred(self):
        with patch.object(c,'cnn_direct',return_value={'value':31}), patch.object(c,'fetch') as fetch:
            self.assertEqual(c.cnn()['value'],31)
            fetch.assert_not_called()

    def test_invalid_external_feed_is_rejected(self):
        for feed in [
            {'dates':[],'values':[]},
            {'dates':['2026-10-01'],'values':[28,29]},
            {'dates':['2026-10-01'],'values':[101]},
            {'dates':['2026-10-01'],'values':[float('nan')]},
            {'dates':['2026-10-01'],'values':[True]},
            {'dates':['2026-02-30'],'values':[28]},
        ]:
            with self.subTest(feed=feed), self.assertRaises(ValueError):
                c.parse_fear_feed(feed)

    def test_both_sources_fail_without_inventing_values(self):
        with patch.object(c,'cnn_direct',side_effect=ValueError('blocked')), patch.object(c,'fetch',side_effect=ValueError('unavailable')):
            result=c.collect_one('fear',{},dt.datetime(2026,10,2,tzinfo=c.UTC))
        self.assertEqual(result['status'],'error')
        self.assertNotIn('value',result)

if __name__=='__main__': unittest.main()

