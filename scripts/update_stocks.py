"""Collect the user's 13 stocks; preserve dated values on source failures."""
import concurrent.futures
import datetime as dt
import json
import math
import pathlib
import re
from zoneinfo import ZoneInfo
from update_data import fetch
from source_support import choose_sources, yahoo_fetch, expected_date

ROOT = pathlib.Path(__file__).resolve().parents[1]
UTC = dt.timezone.utc
NY = ZoneInfo('America/New_York')
STOCKS = [('AAPL', 'アップル'), ('GOOGL', 'アルファベットA'),
          ('MSFT', 'マイクロソフト'), ('AMZN', 'アマゾン'),
          ('META', 'メタ・プラットフォームズA'), ('NFLX', 'ネットフリックス'),
          ('TSLA', 'テスラ'),
          ('SPCX', 'スペースX'), ('NVDA', 'エヌビディア'),
          ('LLY', 'イーライリリー'), ('KO', 'コカ・コーラ'),
          ('JNJ', 'ジョンソン・エンド・ジョンソン'), ('ABBV', 'アッヴィ')]

def number(value):
    try:
        if isinstance(value, bool):
            return None
        n = float(str(value).replace(',', ''))
        return n if math.isfinite(n) else None
    except (ValueError, TypeError):
        return None

def parse_japan(text, symbol):
    marker = 'window.__PRELOADED_STATE__ = '
    if marker not in text:
        return parse_current_japan(text, symbol)
    state = json.JSONDecoder().raw_decode(text.split(marker, 1)[1])[0]
    board = state.get('mainUsStocksPriceBoard', {})
    if board.get('code') != symbol:
        raise ValueError('Unexpected stock code')
    refs = state.get('mainUsStocksReferenceIndex', {})
    ratios = {key: {'value': number(refs.get(key, {}).get('value')),
                    'sourceDate': refs.get(key, {}).get('updateDate')}
              for key in ('per', 'pbr')}
    local_date = str(board.get('localUpdateTime', '')).split(' ')[0]
    for ratio in ratios.values():
        if re.fullmatch(r'\d{1,2}:\d{2}', str(ratio['sourceDate'])) and '/' in local_date:
            ratio['sourceDate'] = local_date + ' ' + ratio['sourceDate'] + ' 米国時間'
    feels = state.get('feelingGraph', {}).get('feels', [])
    values = {f.get('type'): number(f.get('percentage')) for f in feels}
    required = ('strongest', 'strong', 'both', 'weak', 'weakest')
    sentiment = None
    if all(values.get(k) is not None and 0 <= values[k] <= 100 for k in required):
        total = sum(values[k] for k in required)
        if total > 0 and abs(total - 100) <= .1:
            sentiment = {'buy': values['strongest'] + values['strong'],
                         'hold': values['both'],
                         'sell': values['weak'] + values['weakest']}
    return {'ratios': ratios, 'sentiment': sentiment}


def parse_current_japan(text, symbol):
    import html
    canonical = re.search(r'<link\b(?=[^>]*\brel="canonical")[^>]*\bhref="([^"]+)"', text)
    if not canonical or canonical[1].rstrip('/') != f'https://finance.yahoo.co.jp/quote/{symbol}':
        raise ValueError('Yahoo Japan issuer mismatch')
    clean = lambda s: html.unescape(re.sub('<[^>]+>', '', re.sub(r'<!--.*?-->', '', s, flags=re.S))).strip()
    ratios = {}
    for key in ('per','pbr'):
        for block in re.findall(r'<dl\b[^>]*>(.*?)</dl>', text, re.S):
            if not re.search(r'<span[^>]*DataListItem__name[^>]*>\s*'+key.upper()+r'\s*</span>', block):
                continue
            term = re.search(r'<dt[^>]*>(.*?)</dt>', block, re.S)
            if not term or '実績' not in clean(term[1]):
                raise ValueError('PER/PBR valuation basis changed')
            dd = re.search(r'<dd\b[^>]*>(.*?)</dd>', block, re.S)
            value = re.search(r'<span[^>]*StyledNumber__value[^>]*>(.*?)</span>', dd[1] if dd else '', re.S)
            date = re.search(r'<span[^>]*DataListItem__date[^>]*>(.*?)</span>', dd[1] if dd else '', re.S)
            if not value:
                raise ValueError('Public ratio value field missing')
            raw = clean(value[1])
            if raw == '000.00':
                raise ValueError('Masked ratio cannot be used')
            n = number(raw)
            if n is None and raw not in ('---','--','—','－','-','N/A',''):
                raise ValueError('Unrecognized ratio value')
            ratios[key] = {'value':n,'sourceDate':clean(date[1]).strip('()（）') if date else None,
                           'basis':'実績','availability':'published' if n is not None else 'unpublished'}
            break
    if len(ratios)!=2:
        raise ValueError('Yahoo Japan PER/PBR fields missing')
    return {'ratios':ratios,'sentiment':None,'asOf':ratio_as_of(ratios)}


def ratio_as_of(ratios, now=None):
    now=now or dt.datetime.now(UTC)
    dates=[]
    for ratio in ratios.values():
        if ratio.get('value') is None:
            continue
        match=re.search(r'(?:(\d{4})/)?(\d{1,2})/(\d{1,2})',str(ratio.get('sourceDate','')))
        if not match:
            return None
        year=int(match[1]) if match[1] else now.year
        date=dt.date(year,int(match[2]),int(match[3]))
        if date>now.date()+dt.timedelta(days=1):
            if match[1]:raise ValueError('Ratio publication date is in the future')
            date=dt.date(year-1,int(match[2]),int(match[3]))
        dates.append(date.isoformat())
    return min(dates) if dates else None


def parse_statistics(text, symbol, currency='USD'):
    import html
    for attrs, body in re.findall(r'<script\b([^>]*)>(.*?)</script>', text, re.S):
        url = re.search(r'data-url="([^"]+)"',attrs)
        if 'data-sveltekit-fetched' not in attrs or not url or f'/quoteSummary/{symbol}?' not in html.unescape(url[1]):
            continue
        envelope = json.loads(body)
        if envelope.get('status')!=200:
            continue
        payload = json.loads(envelope['body'])
        for result in payload.get('quoteSummary',{}).get('result') or []:
            price = result.get('price',{})
            if price.get('symbol')!=symbol or price.get('currency')!=currency or price.get('quoteType')!='EQUITY':
                raise ValueError('Statistics issuer/currency mismatch')
            if not isinstance(result.get('summaryDetail'),dict) or not isinstance(result.get('defaultKeyStatistics'),dict):
                raise ValueError('Statistics modules missing')
            values = {'per':result['summaryDetail'].get('trailingPE',{}),
                      'pbr':result['defaultKeyStatistics'].get('priceToBook',{})}
            timestamp=price.get('regularMarketTime',{})
            timestamp=timestamp.get('raw') if isinstance(timestamp,dict) else timestamp
            as_of=dt.datetime.fromtimestamp(timestamp,NY).date().isoformat() if number(timestamp) else None
            return {'ratios':{key:{'value':number(v.get('raw')),'basis':'実績','sourceDate':as_of,
                                   'availability':'published' if number(v.get('raw')) is not None else 'unpublished'}
                              for key,v in values.items()},'sentiment':None,'asOf':as_of}
    raise ValueError('Published valuation statistics not found')


def collect_ratios(symbol, currency='USD'):
    jp = f'https://finance.yahoo.co.jp/quote/{symbol}'
    us = f'https://finance.yahoo.com/quote/{symbol}/key-statistics/'
    candidates = []
    if currency=='USD':
        candidates.append(('Yahoo!ファイナンス・実績指標',jp,lambda:parse_japan(fetch(jp),symbol)))
    candidates.extend([
        ('Yahoo Finance・実績指標',us,lambda:parse_statistics(fetch(us),symbol,currency)),
        ('Yahoo Finance・実績指標',f'https://finance.yahoo.com/quote/{symbol}/',
         lambda:parse_statistics(fetch(f'https://finance.yahoo.com/quote/{symbol}/'),symbol,currency))])
    return choose_sources(candidates, minimum_date=expected_date('XNYS' if currency=='USD' else 'XTKS','daily'))

def chart(symbol, interval, span):
    data = json.loads(yahoo_fetch(fetch,f'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range={span}&interval={interval}&includePrePost=false'))
    results = data.get('chart', {}).get('result')
    if not results or results[0]['meta'].get('symbol') != symbol or results[0]['meta'].get('instrumentType') != 'EQUITY':
        raise ValueError('No matching equity chart')
    return results[0]

def points(result):
    quote = result['indicators']['quote'][0]
    closes = quote['close']
    volumes = quote.get('volume', [])
    highs = quote.get('high', [])
    clean = {}
    for i, (stamp, value) in enumerate(zip(result.get('timestamp', []), closes)):
        n = number(value)
        if n is not None and n > 0:
            volume = number(volumes[i]) if i < len(volumes) else None
            high = number(highs[i]) if i < len(highs) else None
            clean[int(stamp)] = {'time': int(stamp), 'value': n,
                                 'high': high if high is not None and high > 0 else None,
                                 'volume': volume if volume is not None and volume >= 0 else None}
    return [clean[t] for t in sorted(clean)]

def price_observation(daily, intraday, now, timezone=NY):
    meta = intraday['meta']
    period = meta['currentTradingPeriod']['regular']
    epoch = now.timestamp()
    active = period['start'] <= epoch < period['end']
    daily_points = points(daily)
    if not daily_points:
        raise ValueError('No daily closes')
    today = now.astimezone(timezone).date()
    completed = [p for p in daily_points
                 if dt.datetime.fromtimestamp(p['time'], timezone).date() < today
                 or (dt.datetime.fromtimestamp(p['time'], NY).date() == today and epoch >= period['end'])]
    if active:
        value = number(meta.get('regularMarketPrice'))
        stamp = int(meta['regularMarketTime'])
        previous = completed[-1]['value'] if completed else None
        kind = '通常取引中（遅延あり）'
    else:
        if not completed:
            raise ValueError('No completed session')
        last = completed[-1]
        value, stamp = last['value'], last['time']
        previous = completed[-2]['value'] if len(completed) > 1 else None
        kind = '前日終値・直近通常取引の終値（時間外）'
    if value is None or value <= 0 or stamp > epoch + 60:
        raise ValueError('Invalid price or timestamp')
    return {'value': value, 'asOf': dt.datetime.fromtimestamp(stamp, UTC).isoformat(),
            'sessionDate': dt.datetime.fromtimestamp(stamp, timezone).date().isoformat(),
            'kind': kind, 'marketOpen': active,
            'change': value - previous if previous is not None else None,
            'changePct': (value / previous - 1) * 100 if previous else None}

def section(operation, previous, now):
    try:
        return {**operation(), 'status': 'ok', 'lastSuccess': now.isoformat(), 'attemptedAt':now.isoformat(), 'error': None}
    except Exception as exc:
        return {**previous, 'status': 'error', 'attemptedAt':now.isoformat(),
                **({'sourceAttempts':exc.attempts} if hasattr(exc,'attempts') else {}),
                'error': f'{type(exc).__name__}: {exc}'[:160]}

def high_observation(result, symbol, now, timezone=NY):
    """Regular-session highs from Yahoo's daily price series, not adjclose."""
    meta = result['meta']
    if meta.get('dataGranularity') != '1d':
        raise ValueError('Daily history required for highs')
    first_trade = number(meta.get('firstTradeDate'))
    if symbol == 'SPCX':
        if 'space' not in str(meta.get('longName', '')).lower():
            raise ValueError('SPCX issuer is not SpaceX')
        first_trade = dt.datetime(2026, 6, 12, tzinfo=NY).timestamp()
    today = now.astimezone(timezone).date()
    rows = []
    for stamp, value in zip(result.get('timestamp', []), result['indicators']['quote'][0].get('high', [])):
        value = number(value)
        date = dt.datetime.fromtimestamp(stamp, timezone).date()
        if value is not None and value > 0 and stamp <= now.timestamp() and date <= today:
            if symbol != 'SPCX' or stamp >= first_trade:
                rows.append((date, value))
    if not rows:
        raise ValueError('No daily highs')
    rows.sort()
    end = rows[-1][0]
    start = end - dt.timedelta(weeks=52) + dt.timedelta(days=1)
    def peak(values):
        date, value = max(values, key=lambda r: (r[1], r[0]))
        return {'value': value, 'date': date.isoformat()}
    expected = dt.datetime.fromtimestamp(first_trade, timezone).date() if first_trade is not None else None
    complete = expected is not None and abs((rows[0][0] - expected).days) <= 7
    # For these older issuers, Yahoo's firstTradeDate can be the archive's
    # starting date rather than the original public listing date.
    if symbol in ('KO', 'JNJ', 'LLY'):
        complete = False
    return {'week52': peak([r for r in rows if r[0] >= start]),
            'allTime': {**peak(rows), 'complete': complete},
            'historyStart': rows[0][0].isoformat(), 'asOfDate': end.isoformat(),
            'basis': 'Yahoo Financeの日足高値（通常取引・配当調整なし）'}

def collect_highs(symbol, now, timezone=NY):
    url = (f'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}'
           f'?period1=0&period2={int(now.timestamp())}&interval=1d&includePrePost=false')
    results = json.loads(yahoo_fetch(fetch,url)).get('chart', {}).get('result')
    if not results or results[0]['meta'].get('symbol') != symbol or results[0]['meta'].get('instrumentType') != 'EQUITY':
        raise ValueError('No matching equity history')
    return high_observation(results[0], symbol, now, timezone)


def parse_research(text, symbol, currency='USD'):
    import html
    for attrs, body in re.findall(r'<script\b([^>]*)>(.*?)</script>', text, re.S):
        if 'data-sveltekit-fetched' not in attrs or 'quoteSummary/' not in attrs:
            continue
        url = re.search(r'data-url="([^"]+)"', attrs)
        if not url or f'/quoteSummary/{symbol}?' not in html.unescape(url[1]):
            continue
        envelope = json.loads(body)
        if envelope.get('status') != 200:
            continue
        payload = json.loads(envelope['body'])
        for result in payload.get('quoteSummary', {}).get('result') or []:
            price = result.get('price', {})
            if price.get('symbol') != symbol or price.get('quoteType') != 'EQUITY' or price.get('currency') != currency:
                raise ValueError('Analyst data issuer/currency mismatch')
            info = result.get('financialData', {})
            target = number(info.get('targetMeanPrice', {}).get('raw'))
            recommendation = info.get('recommendationKey')
            if recommendation not in ('strong_buy', 'buy', 'hold', 'underperform', 'sell', 'strong_sell'):
                recommendation = None
            if target is not None and target <= 0:
                target = None
            if target is None and recommendation is None:
                raise ValueError('No published analyst target or recommendation')
            count = number(info.get('numberOfAnalystOpinions', {}).get('raw'))
            return {'target': target, 'recommendation': recommendation,
                    'analysts': int(count) if count is not None and count > 0 else None,
                    'source': 'Yahoo Finance・アナリスト集計',
                    'sourceUrl': f'https://finance.yahoo.com/quote/{symbol}/analysis/',
                    'publishedAt': None}
    raise ValueError('Published analyst data not found')

def collect_research(symbol, previous, now, currency='USD'):
    try:
        age = (now - dt.datetime.fromisoformat(previous['lastSuccess'].replace('Z', '+00:00'))).total_seconds()
        if previous.get('status') == 'ok' and 0 <= age < 6 * 3600:
            return previous
    except (KeyError, TypeError, ValueError):
        pass
    def operation():
        return choose_sources([('Yahoo Finance・アナリスト集計',f'https://finance.yahoo.com/quote/{symbol}/{page}',
                                lambda page=page:parse_research(fetch(f'https://finance.yahoo.com/quote/{symbol}/{page}'),symbol,currency))
                               for page in ('analysis/','key-statistics/','')])
    return section(operation, previous, now)

def collect(symbol, name, old, now):
    base = {'symbol': symbol, 'name': name,
            'quoteUrl': f'https://finance.yahoo.co.jp/quote/{symbol}',
            'forumUrl': f'https://finance.yahoo.co.jp/quote/{symbol}/forum'}
    def prices():
        daily = chart(symbol, '1d', '5y')  # Warm-up history for the 2-year 75-session average.
        intraday = chart(symbol, '5m', '5d')
        # SPCX was reused after the former ETF; never chart that predecessor.
        if symbol == 'SPCX':
            if 'space' not in str(daily['meta'].get('longName', '')).lower():
                raise ValueError('SPCX issuer is not SpaceX')
            cutoff = int(dt.datetime(2026, 6, 12, tzinfo=NY).timestamp())
            for result in (daily, intraday):
                stamps = result.get('timestamp', [])
                quotes = result['indicators']['quote'][0]
                indices = [i for i, t in enumerate(stamps) if t >= cutoff]
                result['timestamp'] = [stamps[i] for i in indices]
                for key, values in quotes.items():
                    quotes[key] = [values[i] for i in indices]
        return {**price_observation(daily, intraday, now),
                'daily': points(daily), 'intraday': points(intraday)}
    return {**base, 'price': section(prices, old.get('price', {}), now),
            'highs': section(lambda: collect_highs(symbol, now), old.get('highs', {}), now),
            'japan': section(lambda: collect_ratios(symbol), old.get('japan', {}), now),
            'research': collect_research(symbol, old.get('research', {}), now)}

def main():
    path = ROOT / 'public/data/stocks.json'
    old = json.loads(path.read_text()) if path.exists() else {}
    previous = {s['symbol']: s for s in old.get('stocks', [])}
    now = dt.datetime.now(UTC)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        jobs = [pool.submit(collect, symbol, name, previous.get(symbol, {}), now) for symbol, name in STOCKS]
        stocks = [job.result() for job in jobs]
    output = {'schemaVersion': 1, 'generatedAt': now.isoformat(), 'stocks': stocks}
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n')
    temp.replace(path)
    for s in stocks:
        print(s['symbol'], 'price:', s['price']['status'], 'highs:', s['highs']['status'], 'Japan:', s['japan']['status'], 'research:', s['research']['status'], s['price'].get('error') or '', s['highs'].get('error') or '', s['japan'].get('error') or '', s['research'].get('error') or '')

if __name__ == '__main__':
    main()
