"""Validated public-source failover. A successful HTTP response alone is not success."""
import datetime as dt
import json
from functools import lru_cache
from zoneinfo import ZoneInfo

UTC = dt.timezone.utc


@lru_cache(maxsize=8)
def calendar(name, year):
    import exchange_calendars as xcals
    return xcals.get_calendar(name, start=f'{year-1}-01-01', end=f'{year+1}-12-31')


def publication_events(name, now, mode):
    """Actual exchange holidays and early closes, with a publication grace period."""
    cal = calendar(name, now.year)
    start, end = (now-dt.timedelta(days=20)).date(), (now+dt.timedelta(days=30)).date()
    result = []
    for session in cal.sessions_in_range(str(start), str(end)):
        date = session.date().isoformat()
        if mode == 'fund':
            due = dt.datetime.combine(session.date(), dt.time(21, 30), ZoneInfo('Asia/Tokyo'))
        elif mode == 'daily':
            due = cal.session_close(session).to_pydatetime()+dt.timedelta(minutes=60)
        else:
            due = cal.session_open(session).to_pydatetime()+dt.timedelta(minutes=30)
        result.append({'date': date, 'dueAt': due.astimezone(UTC).isoformat()})
    return result


def expected_date(name='XTKS', mode='fund', now=None):
    now = now or dt.datetime.now(UTC)
    return max(e['date'] for e in publication_events(name, now, mode)
               if dt.datetime.fromisoformat(e['dueAt']) <= now)


class SourcesUnavailable(ValueError):
    def __init__(self, attempts):
        self.attempts = attempts
        super().__init__('; '.join(a['name']+': '+a['error'] for a in attempts))


def choose_sources(candidates, minimum_date=None):
    attempts = []
    for name, url, operation in candidates:
        try:
            result = operation()
            if minimum_date:
                published=dt.date.fromisoformat(str(result.get('asOf',''))[:10])
                if published>dt.datetime.now(UTC).date()+dt.timedelta(days=1):
                    raise ValueError('公表日が未来です')
                if published.isoformat()<minimum_date:
                    raise ValueError('公表日が古い: '+str(result.get('asOf'))+' / 必要 '+minimum_date)
            attempts.append({'name': name, 'url': url, 'status': 'ok', 'asOf': result.get('asOf')})
            return {**result, 'source': name, 'sourceUrl': url, 'sourceAttempts': attempts,
                    'sourceCandidates': [{'name': n, 'url': u} for n, u, _ in candidates]}
        except Exception as exc:
            attempts.append({'name': name, 'url': url, 'status': 'error',
                             'error': f'{type(exc).__name__}: {exc}'[:240]})
    raise SourcesUnavailable(attempts)


def yahoo_fetch(reader, url):
    """Two public Yahoo chart hosts; never change issuer or valuation basis."""
    from urllib.parse import unquote, urlparse
    attempts=[]
    for candidate in dict.fromkeys([url,url.replace('query1.finance.yahoo.com','query2.finance.yahoo.com')]):
        try:
            text=reader(candidate)
            result=json.loads(text).get('chart',{}).get('result')
            symbol=unquote(urlparse(candidate).path.rsplit('/',1)[-1])
            if not result or result[0].get('meta',{}).get('symbol')!=symbol:
                raise ValueError('Yahoo chart identity/response mismatch')
            return text
        except Exception as exc:
            attempts.append({'name':'Yahoo Finance','url':candidate,'status':'error',
                             'error':f'{type(exc).__name__}: {exc}'[:200]})
    raise SourcesUnavailable(attempts)
