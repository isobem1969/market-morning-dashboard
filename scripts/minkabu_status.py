"""Check public-source availability without claiming to have imported research."""
import datetime as dt
import urllib.request
import urllib.error

URL = 'https://us.minkabu.jp/stocks/AAPL/researches'
# Observed once in the same GitHub Actions runner environment, diagnostic run 37533409774.
INITIAL = {'status': 'http_error', 'httpStatus': 403,
           'checkedAt': '2026-10-06T21:22:28+00:00',
           'nextCheckAt': '2026-10-07T21:22:28+00:00',
           'url': URL, 'sampleSymbol': 'AAPL', 'importStatus': 'not_connected'}

def check_access(previous, now, opener=urllib.request.urlopen):
    previous = previous or INITIAL
    try:
        if now < dt.datetime.fromisoformat(previous['nextCheckAt']):
            return previous
    except (KeyError, ValueError, TypeError):
        pass
    result = {'checkedAt': now.isoformat(), 'url': URL, 'sampleSymbol': 'AAPL',
              'importStatus': 'not_connected',
              'nextCheckAt': (now + dt.timedelta(hours=24)).isoformat()}
    try:
        # One ordinary request; no cookies, credentials, proxy switching or retries.
        with opener(URL, timeout=20) as response:
            status = response.status
            result.update(status='reachable' if status == 200 else 'http_error', httpStatus=status)
    except urllib.error.HTTPError as exc:
        result.update(status='http_error', httpStatus=exc.code)
    except Exception:
        result.update(status='network_error', httpStatus=None)
    return result
