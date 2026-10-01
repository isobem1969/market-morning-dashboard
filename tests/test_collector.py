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

if __name__=='__main__': unittest.main()
