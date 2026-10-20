import datetime as dt
import pathlib
import sys
import unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'scripts'))
import update_data as c
import update_drawdowns as d

class DrawdownTest(unittest.TestCase):
    def test_peak_is_not_reset_at_year_boundary(self):
        result=d.comparison_points([('2024-12-20',200),('2025-01-06',100),('2026-01-05',150),('2026-10-19',200)],'test','https://example.test','test')
        self.assertEqual(result['years']['2025'][0]['value'],-50)
        self.assertEqual(result['years']['2026'][0]['value'],-25)
        self.assertEqual(result['years']['2026'][-1]['value'],0)

    def test_full_inception_history_keeps_early_peak(self):
        start=dt.date(2022,1,1)
        text='日付,基準価額\n'+str(start)+',20000\n'+''.join(str(start+dt.timedelta(days=i))+',10000\n' for i in range(1,1400))
        nav=c.parse_mufg_csv(text,history_limit=100000)
        self.assertEqual(len(nav['history']),1400)
        result=d.comparison_points([(p['date'],p['value']) for p in nav['history']],'test','https://example.test','test')
        self.assertEqual(result['years'][str(result['currentYear'])][-1]['value'],-50)

    def test_schd_xml_uses_published_nav_and_skips_non_business_days(self):
        xml='<root><year value="2026"><month value="10"><day value="16" price="12685" indication="1"/><day value="17" price="" indication="0"/><day value="19" price="12758" indication="1" return_value="1.5"/></month></year></root>'
        nav=c.parse_wealthadvisor_xml(xml)
        self.assertEqual(nav['value'],12758)
        self.assertEqual(nav['change'],73)
        self.assertEqual(len(nav['history']),2)
        self.assertIn('schd',c.SOURCES)
        self.assertEqual(list(c.SOURCES)[-1],'schd')

    def test_invalid_or_duplicate_nav_rejected(self):
        for points in [[],[('2025-01-01',100),('2025-01-01',100)],[('2026-01-01',float('nan'))]]:
            with self.assertRaises(ValueError):
                d.comparison_points(points,'test','https://example.test','test')
