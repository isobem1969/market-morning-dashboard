import datetime as dt
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import exchange_calendars as xcals
from update_rsi import wilder, weekly, episodes
UTC=dt.timezone.utc
class RsiTests(unittest.TestCase):
 def test_wilder_published_example(self):
  values=[44.34,44.09,44.15,43.61,44.33,44.83,45.10,45.42,45.84,46.08,45.89,46.03,45.61,46.28,46.28]
  self.assertAlmostEqual(wilder(values)[-1],70.4641350211,places=8)
 def test_edges(self):
  self.assertEqual(wilder(list(range(20)))[-1],100)
  self.assertEqual(wilder(list(range(20,0,-1)))[-1],0)
  self.assertEqual(wilder([10]*20)[-1],50)
 def test_friday_before_and_after_close(self):
  cal=xcals.get_calendar('XNYS',start='2025-01-01',end='2027-01-01')
  rows=[{'date':'2026-11-13','value':100}]
  confirmed,p=weekly(rows,dt.datetime(2026,11,13,20,59,tzinfo=UTC),cal)
  self.assertEqual(confirmed,[]);self.assertIsNotNone(p)
  confirmed,p=weekly(rows,dt.datetime(2026,11,13,21,21,tzinfo=UTC),cal)
  self.assertEqual(len(confirmed),1);self.assertIsNone(p)
 def test_good_friday_and_early_close(self):
  cal=xcals.get_calendar('XNYS',start='2025-01-01',end='2027-01-01')
  rows=[{'date':'2026-04-02','value':100}]
  self.assertEqual(len(weekly(rows,dt.datetime(2026,4,2,20,21,tzinfo=UTC),cal)[0]),1)
  rows=[{'date':'2026-11-27','value':100}]
  self.assertEqual(len(weekly(rows,dt.datetime(2026,11,27,18,21,tzinfo=UTC),cal)[0]),1)
 def test_missing_final_session_is_not_confirmed(self):
  cal=xcals.get_calendar('XNYS',start='2025-01-01',end='2027-01-01')
  with self.assertRaises(ValueError):weekly([{'date':'2026-11-12','value':100}],dt.datetime(2026,11,14,tzinfo=UTC),cal)
 def test_strict_threshold_and_completed_episode(self):
  rows=[{'date':str(i),'rsi':v} for i,v in enumerate([40,39,38,40,39])]
  p=episodes(rows,lambda v:v<40)
  self.assertEqual(p['current']['start'],'4');self.assertEqual(p['current']['weeks'],1)
  self.assertEqual(p['events'][0]['end'],'3');self.assertEqual(p['events'][0]['weeks'],2)
  self.assertIsNone(episodes([{'date':'x','rsi':75}],lambda v:v>75)['current'])
if __name__=='__main__':unittest.main()
