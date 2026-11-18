"""Collect the four Japanese equities in JPY using Tokyo trading dates."""
import concurrent.futures
import datetime as dt
import html
import json
import re
from zoneinfo import ZoneInfo
from update_data import fetch
from update_stocks import (ROOT, UTC, chart, points, price_observation, collect_highs,
                           collect_research, number, section)

TOKYO = ZoneInfo('Asia/Tokyo')
STOCKS = [('9984.T', 'ソフトバンクグループ'), ('4755.T', '楽天グループ'),
          ('285A.T', 'キオクシア'), ('8035.T', '東京エレクトロン')]

def plain(text):
    return html.unescape(re.sub(r'<[^>]+>', '', re.sub(r'<!--.*?-->', '', text, flags=re.S))).strip()

def parse_ratios(text, symbol):
    canonical = re.search(r'<link\b(?=[^>]*\brel="canonical")[^>]*\bhref="([^"]+)"', text)
    if not canonical or canonical[1].rstrip('/') != f'https://finance.yahoo.co.jp/quote/{symbol}':
        raise ValueError('Japanese quote issuer mismatch')
    ratios = {}
    for key, basis in [('per', '会社予想'), ('pbr', '実績')]:
        for block in re.findall(r'<dl\b[^>]*>(.*?)</dl>', text, re.S):
            if not re.search(r'_cl_link:' + key + r';', block):
                continue
            dd = re.search(r'<dd\b[^>]*>(.*?)</dd>', block, re.S)
            value = re.search(r'<span\b[^>]*class="[^"]*StyledNumber__value[^\"]*"[^>]*>(.*?)</span>', dd[1] if dd else '', re.S)
            date = re.search(r'<span\b[^>]*class="[^"]*DataListItem__date[^\"]*"[^>]*>(.*?)</span>', dd[1] if dd else '', re.S)
            label = plain(date[1]).strip('()（）') if date else None
            if label and re.fullmatch(r'\d{1,2}:\d{2}', label):
                label += '（配信元表示・日付未掲載）'
            ratios[key] = {'value': number(plain(value[1])) if value else None,
                           'sourceDate': label, 'basis': basis}
            break
    if len(ratios) != 2:
        raise ValueError('Japanese PER/PBR page structure changed')
    return {'ratios': ratios, 'sentiment': None}

def collect(symbol, name, old, now):
    code = symbol.removesuffix('.T')
    base = {'symbol': symbol, 'code': code, 'name': name, 'currency': 'JPY',
            'timeZone': 'Asia/Tokyo', 'quoteUrl': f'https://finance.yahoo.co.jp/quote/{symbol}',
            'forumUrl': f'https://finance.yahoo.co.jp/quote/{symbol}/forum',
            'minkabuUrl': f'https://minkabu.jp/stock/{code}'}
    def prices():
        daily, intraday = chart(symbol, '1d', '5y'), chart(symbol, '5m', '5d')
        for result in (daily, intraday):
            if result['meta'].get('currency') != 'JPY' or result['meta'].get('exchangeTimezoneName') != 'Asia/Tokyo':
                raise ValueError('Japanese quote currency/timezone mismatch')
        return {**price_observation(daily, intraday, now, TOKYO), 'timeZone': 'Asia/Tokyo',
                'daily': points(daily), 'intraday': points(intraday)}
    def highs():
        result = collect_highs(symbol, now, TOKYO)
        # Archive availability alone does not verify these issuers' original listing dates.
        if symbol != '285A.T':
            result['allTime']['complete'] = False
        return result
    return {**base, 'price': section(prices, old.get('price', {}), now),
            'highs': section(highs, old.get('highs', {}), now),
            'japan': section(lambda: parse_ratios(fetch(base['quoteUrl']), symbol), old.get('japan', {}), now),
            'research': collect_research(symbol, old.get('research', {}), now, 'JPY')}

def main():
    path = ROOT / 'public/data/japan-stocks.json'
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
    for stock in stocks:
        print(stock['symbol'], {key: (stock[key]['status'], stock[key].get('error')) for key in ('price', 'highs', 'japan', 'research')})

if __name__ == '__main__':
    main()
