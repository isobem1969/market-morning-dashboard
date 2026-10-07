"""Collect the user's 12 stocks; preserve dated values on source failures."""
import concurrent.futures
import datetime as dt
import json
import math
import pathlib
import re
from zoneinfo import ZoneInfo
from update_data import fetch

ROOT = pathlib.Path(__file__).resolve().parents[1]
UTC = dt.timezone.utc
NY = ZoneInfo('America/New_York')
STOCKS = [('AAPL', 'アップル'), ('GOOGL', 'アルファベットA'),
          ('MSFT', 'マイクロソフト'), ('AMZN', 'アマゾン'),
          ('META', 'メタ・プラットフォームズA'), ('TSLA', 'テスラ'),
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
        raise ValueError('Yahoo! Japan page structure changed')
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

def chart(symbol, interval, span):
    data = json.loads(fetch(f'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range={span}&interval={interval}&includePrePost=false'))
    results = data.get('chart', {}).get('result')
    if not results or results[0]['meta'].get('symbol') != symbol or results[0]['meta'].get('instrumentType') != 'EQUITY':
        raise ValueError('No matching equity chart')
    return results[0]

def points(result):
    quote = result['indicators']['quote'][0]
    closes = quote['close']
    volumes = quote.get('volume', [])
    clean = {}
    for i, (stamp, value) in enumerate(zip(result.get('timestamp', []), closes)):
        n = number(value)
        if n is not None and n > 0:
            volume = number(volumes[i]) if i < len(volumes) else None
            clean[int(stamp)] = {'time': int(stamp), 'value': n,
                                 'volume': volume if volume is not None and volume >= 0 else None}
    return [clean[t] for t in sorted(clean)]

def price_observation(daily, intraday, now):
    meta = intraday['meta']
    period = meta['currentTradingPeriod']['regular']
    epoch = now.timestamp()
    active = period['start'] <= epoch < period['end']
    daily_points = points(daily)
    if not daily_points:
        raise ValueError('No daily closes')
    today = now.astimezone(NY).date()
    completed = [p for p in daily_points
                 if dt.datetime.fromtimestamp(p['time'], NY).date() < today
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
            'sessionDate': dt.datetime.fromtimestamp(stamp, NY).date().isoformat(),
            'kind': kind, 'marketOpen': active,
            'change': value - previous if previous is not None else None,
            'changePct': (value / previous - 1) * 100 if previous else None}

def section(operation, previous, now):
    try:
        return {**operation(), 'status': 'ok', 'lastSuccess': now.isoformat(), 'error': None}
    except Exception as exc:
        return {**previous, 'status': 'error', 'error': f'{type(exc).__name__}: {exc}'[:160]}

def high_observation(result, symbol, now):
    """Regular-session highs from Yahoo's daily price series, not adjclose."""
    meta = result['meta']
    if meta.get('dataGranularity') != '1d':
        raise ValueError('Daily history required for highs')
    first_trade = number(meta.get('firstTradeDate'))
    if symbol == 'SPCX':
        if 'space' not in str(meta.get('longName', '')).lower():
            raise ValueError('SPCX issuer is not SpaceX')
        first_trade = dt.datetime(2026, 6, 12, tzinfo=NY).timestamp()
    today = now.astimezone(NY).date()
    rows = []
    for stamp, value in zip(result.get('timestamp', []), result['indicators']['quote'][0].get('high', [])):
        value = number(value)
        date = dt.datetime.fromtimestamp(stamp, NY).date()
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
    expected = dt.datetime.fromtimestamp(first_trade, NY).date() if first_trade is not None else None
    complete = expected is not None and abs((rows[0][0] - expected).days) <= 7
    return {'week52': peak([r for r in rows if r[0] >= start]),
            'allTime': {**peak(rows), 'complete': complete},
            'historyStart': rows[0][0].isoformat(), 'asOfDate': end.isoformat(),
            'basis': 'Yahoo Financeの日足高値（通常取引・配当調整なし）'}

def collect_highs(symbol, now):
    url = (f'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}'
           f'?period1=0&period2={int(now.timestamp())}&interval=1d&includePrePost=false')
    results = json.loads(fetch(url)).get('chart', {}).get('result')
    if not results or results[0]['meta'].get('symbol') != symbol or results[0]['meta'].get('instrumentType') != 'EQUITY':
        raise ValueError('No matching equity history')
    return high_observation(results[0], symbol, now)

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
            'japan': section(lambda: parse_japan(fetch(base['quoteUrl']), symbol), old.get('japan', {}), now)}

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
        print(s['symbol'], 'price:', s['price']['status'], 'Japan:', s['japan']['status'], s['price'].get('error') or '', s['japan'].get('error') or '')

if __name__ == '__main__':
    main()
