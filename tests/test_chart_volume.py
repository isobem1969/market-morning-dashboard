import pathlib
import sys
import unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'scripts'))
from update_stocks import points

class ChartVolumeTests(unittest.TestCase):
    def test_volume_remains_aligned_when_bad_closes_are_removed(self):
        result={'timestamp':[1,2,3,4], 'indicators':{'quote':[{'close':[10,None,12,13], 'volume':[100,200,0,-10]}]}}
        self.assertEqual(points(result),[{'time':1,'value':10,'volume':100}, {'time':3,'value':12,'volume':0}, {'time':4,'value':13,'volume':None}])
    def test_missing_volume_is_not_invented(self):
        result={'timestamp':[1], 'indicators':{'quote':[{'close':[10]}]}}
        self.assertIsNone(points(result)[0]['volume'])
