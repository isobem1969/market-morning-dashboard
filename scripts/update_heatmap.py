"""Live regular-session prices for the displayed heatmap universe."""
import concurrent.futures
import datetime as dt
import json
from pathlib import Path
from update_data import fetch
from update_stocks import NY, UTC, number, points, price_observation

ROOT = Path(__file__).resolve().parents[1]

def month_before(date):
    year, month = date.year, date.month - 1
    if month == 0:
        year, month = year - 1, 12
    following = dt.date(year + (month == 12), 1 if month == 12 else month + 1, 1)
    last = (following - dt.timedelta(days=1)).day
    return dt.date(year, month, min(date.day, last))

def observation(result, symbol, now):
    meta = result.get('meta', {})
    if meta.get('symbol') != symbol or meta.get('instrumentType') != 'EQUITY' or meta.get('currency') != 'USD' or meta.get('dataGranularity') != '1d':
        raise ValueError('Mismatched stock, currency or chart interval')
    quote = price_observation(result, {'meta': meta}, now)
    session = dt.date.fromisoformat(quote['sessionDate'])
    rows = [(dt.datetime.fromtimestamp(p['time'], NY).date(), p) for p in points(result)]
    rows = [(date, p) for date, p in rows if date <= session and p['time'] <= now.timestamp()]
    previous = [(date, p) for date, p in rows if date < session]
    periods = {}
    for key, cutoff in [('1d', session - dt.timedelta(days=1)), ('1w', session - dt.timedelta(days=7)), ('1m', month_before(session))]:
        candidates = [(date, p) for date, p in previous if date <= cutoff]
        if not candidates:
            periods[key] = None
            continue
        date, base = candidates[-1]
        delta = quote['value'] - base['value']
        periods[key] = {'referenceDate': date.isoformat(), 'referencePrice': base['value'],
                        'change': delta, 'changePct': delta / base['value'] * 100}
    observed = number(meta.get('regularMarketTime'))
    same_session = observed is not None and dt.datetime.fromtimestamp(observed, NY).date() == session and observed <= now.timestamp() + 60
    quoted_at = dt.datetime.fromtimestamp(observed, UTC).isoformat() if same_session else None
    daily = next((p for date, p in reversed(rows) if date == session), {})
    volume = number(meta.get('regularMarketVolume')) if same_session else daily.get('volume')
    return {**quote, 'quotedAt': quoted_at, 'periods': periods,
            'volume': volume if volume is not None and volume >= 0 else None,
            'dayHigh': number(meta.get('regularMarketDayHigh')) if same_session else daily.get('high'),
            'dayLow': number(meta.get('regularMarketDayLow')) if same_session else None,
            'week52High': number(meta.get('fiftyTwoWeekHigh')),
            'week52Low': number(meta.get('fiftyTwoWeekLow')),
            'exchange': meta.get('fullExchangeName') or meta.get('exchangeName'),
            'source': 'Yahoo Finance', 'sourceUrl': f'https://finance.yahoo.com/quote/{symbol}/'}

def collect(symbol, name, previous, now):
    base = {'symbol': symbol, 'name': name}
    try:
        payload = json.loads(fetch(f'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=3mo&interval=1d&includePrePost=false'))
        results = payload.get('chart', {}).get('result')
        if not results:
            raise ValueError('No public price data')
        result = observation(results[0], symbol, now)
        return {**result, **base, 'status': 'ok', 'lastSuccess': now.isoformat(), 'error': None}
    except Exception as exc:
        return {**previous, **base, 'status': 'error', 'error': f'{type(exc).__name__}: {exc}'[:180]}

def main():
    config = json.loads((ROOT / 'public/heatmap-universe.json').read_text())
    universe = {s['symbol']: s['name'] for sectors in config.values() for sector in sectors for s in sector['stocks']}
    path = ROOT / 'public/data/heatmap.json'
    old = json.loads(path.read_text()) if path.exists() else {}
    previous = {s['symbol']: s for s in old.get('stocks', [])}
    now = dt.datetime.now(UTC)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        jobs = [pool.submit(collect, symbol, name, previous.get(symbol, {}), now) for symbol, name in universe.items()]
        stocks = [job.result() for job in jobs]
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps({'schemaVersion': 1, 'generatedAt': now.isoformat(), 'stocks': stocks}, ensure_ascii=False, separators=(',', ':')) + '\n')
    temp.replace(path)
    for s in stocks:
        print('heatmap', s['symbol'], s['status'], s.get('sessionDate', ''), s.get('error') or '')

if __name__ == '__main__':
    main()
