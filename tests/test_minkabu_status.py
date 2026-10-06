import datetime as dt
import pathlib
import sys
import unittest
import urllib.error
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'scripts'))
from minkabu_status import check_access, INITIAL

class StatusTests(unittest.TestCase):
    def test_rejection_is_recorded_and_not_retried_rapidly(self):
        now=dt.datetime(2026,10,8,tzinfo=dt.timezone.utc)
        calls=[]
        def fail(url,timeout):
            calls.append(url)
            raise urllib.error.HTTPError(url,403,'Forbidden',None,None)
        result=check_access({},now,fail)
        self.assertEqual(result['httpStatus'],403)
        self.assertEqual(result['importStatus'],'not_connected')
        self.assertEqual(check_access(result,now+dt.timedelta(minutes=15),fail),result)
        self.assertEqual(len(calls),1)
    def test_connection_success_does_not_claim_data_import_success(self):
        class Response:
            status=200
            def __enter__(self):return self
            def __exit__(self,*args):pass
        result=check_access({},dt.datetime(2026,10,8,tzinfo=dt.timezone.utc),lambda *a,**k:Response())
        self.assertEqual(result['status'],'reachable')
        self.assertEqual(result['importStatus'],'not_connected')
    def test_network_failure_is_distinct_from_http_refusal(self):
        def fail(*a,**k):raise TimeoutError()
        result=check_access({},dt.datetime(2026,10,8,tzinfo=dt.timezone.utc),fail)
        self.assertEqual(result['status'],'network_error')
        self.assertIsNone(result['httpStatus'])
