"""Public-source collector. No estimates or conversation values are used."""
import concurrent.futures
import csv
import datetime as dt
import io
import json
import math
import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
UTC = dt.timezone.utc
SOURCES = {
    'usd': ('ドル円', '円 / 1ドル', 'Yahoo Finance', 'https://finance.yahoo.co.jp/quote/USDJPY=FX'),
    'vix': ('VIX 恐怖指数', '', 'Cboe', 'https://www.cboe.com/tradable_products/vix/'),
    'fear': ('Fear & Greed', '/ 100', 'CNN', 'https://edition.cnn.com/markets/fear-and-greed'),
    'vi': ('日経VI', '', '日本経済新聞社', 'https://indexes.nikkei.co.jp/nkave/index/profile?idx=nk225vi'),
    'brent': ('ブレント原油', 'ドル / バレル', 'Yahoo Finance・Brent先物', 'https://finance.yahoo.com/quote/BZ=F/'),
    'sox': ('ニッセイ SOX', '円 / 1万口', 'ニッセイアセット公式CSV', 'https://www.nam.co.jp/fundinfo/nssifb/data.html'),
    'fang': ('iFreeNEXT FANG+', '円 / 1万口', '大和アセット公式CSV', 'https://www.daiwa-am.co.jp/funds/detail/3346/detail_top.html'),
    'nasdaq': ('SBI NASDAQ100', '円 / 1万口', 'SBI運用会社案内・Wealth Advisor', 'https://apl.wealthadvisor.jp/webasp/sbi_am/pc/basic/sa_2026052101.html'),
}

def fetch(url, encoding=None):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Accept': '*/*'})
    with urllib.request.urlopen(req, timeout=25) as response:
        data = response.read(8_000_000)
    return data.decode(encoding or 'utf-8-sig')

def iso_date(value):
    digits = re.sub(r'\D', '', value)
    return dt.datetime.strptime(digits[:8], '%Y%m%d').date().isoformat()

def series_result(points, kind, peak=False):
    clean = {}
    for date, value in points:
        value = float(value)
        if not math.isfinite(value) or value < 0:
            raise ValueError('Invalid numeric value')
        clean[date] = value
    ordered = sorted(clean.items())
    if not ordered:
        raise ValueError('No dated observations')
    date, value = ordered[-1]
    previous = ordered[-2][1] if len(ordered) > 1 else None
    result = {'value': value, 'asOf': date, 'kind': kind,
              'change': value - previous if previous is not None else None,
              'changePct': (value / previous - 1) * 100 if previous else None,
              'history': [{'date': d, 'value': v} for d, v in ordered[-90:]]}
    if peak:
        result['peak'] = max(v for _, v in ordered)
        result['peakLabel'] = '取得した設定来データの最高値'
    return result

def parse_fund_csv(text, fund):
    rows = csv.DictReader(io.StringIO(text))
    if fund == 'fang':
        return series_result([(iso_date(r['基準日']), r['基準価額']) for r in rows], '基準価額', True)
    return series_result([(iso_date(r['日付']), r['基準価額']) for r in rows], '基準価額', True)

def yahoo(symbol):
    from urllib.parse import quote
    obj = json.loads(fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + quote(symbol, safe='') + '?range=3mo&interval=1d'))['chart']['result'][0]
    meta = obj['meta']
    from zoneinfo import ZoneInfo
    tz = ZoneInfo(meta['exchangeTimezoneName'])
    closes = obj['indicators']['quote'][0]['close']
    points = [(dt.datetime.fromtimestamp(t, tz).date().isoformat(), v) for t, v in zip(obj['timestamp'], closes) if v is not None]
    t = meta['regularMarketTime']
    date = dt.datetime.fromtimestamp(t, tz).date().isoformat()
    points.append((date, meta['regularMarketPrice']))
    result = series_result(points, '市場値（遅延の可能性）')
    result['asOf'] = dt.datetime.fromtimestamp(t, UTC).isoformat()
    # A daily series can include today's partial bar. Compare with the last prior day.
    prev = next((v for d, v in reversed(sorted(dict(points).items())) if d < date), None)
    result['change'] = result['value'] - prev if prev is not None else None
    result['changePct'] = (result['value'] / prev - 1) * 100 if prev else None
    return result

def cboe():
    rows = csv.DictReader(io.StringIO(fetch('https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv')))
    points = [(dt.datetime.strptime(r['DATE'], '%m/%d/%Y').date().isoformat(), r['CLOSE']) for r in rows]
    return series_result(points, '米国市場・日次終値')

def nikkei():
    text = fetch('https://indexes.nikkei.co.jp/nkave/historical/nikkei_stock_average_vi_daily_jp.csv', 'cp932')
    rows = list(csv.reader(io.StringIO(text)))[1:]
    return series_result([(iso_date(r[0]), r[1]) for r in rows if len(r) >= 2 and re.match(r'^\d{4}/', r[0])], '日本市場・日次終値')

def cnn():
    data = json.loads(fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata'))
    current = data['fear_and_greed']
    score = float(current['score'])
    if not 0 <= score <= 100:
        raise ValueError('CNN score out of range')
    points = [(dt.datetime.fromtimestamp(p['x'] / 1000, UTC).date().isoformat(), p['y']) for p in data.get('fear_and_greed_historical', {}).get('data', [])]
    as_of = current['timestamp']
    points.append((as_of[:10], score))
    result = series_result(points, 'CNN公表値')
    result['asOf'] = as_of
    # Historical series may include intraday observations; use CNN's previous_close.
    previous = current.get('previous_close')
    result['change'] = score - float(previous) if previous is not None else None
    result['changePct'] = None
    return result

def nasdaq():
    latest = nasdaq_page()
    try:
        archive = nasdaq_xml()
        if archive['asOf'] > latest['asOf']:
            return archive
        points = [(p['date'], p['value']) for p in archive['history']]
        points.append((latest['asOf'], latest['value']))
        combined = series_result(points, '基準価額')
        latest['history'] = combined['history']
        latest['peak'] = max(archive['peak'], latest['value'])
        latest['peakLabel'] = '取得した設定来データの最高値'
    except Exception:
        # The published price still works when the chart archive is unavailable.
        latest['historyNote'] = 'チャートの取得失敗・保存済み観測値のみ'
    return latest

def nasdaq_xml():
    import xml.etree.ElementTree as ET
    # The chart XML is linked by the SBI-provided fund detail page.
    xml = fetch('https://apl.wealthadvisor.jp/xml/chart/funddata/2026052101.xml', 'cp932')
    root = ET.fromstring(xml)
    points = []
    for year in root.findall('.//year'):
        for month in year.findall('month'):
            for day in month.findall('day'):
                if day.get('price') and day.get('indication') == '1':
                    date = year.get('value') + month.get('value') + day.get('value')
                    points.append((iso_date(date), day.get('price')))
    if points:
        return series_result(points, '基準価額', True)
    raise ValueError('NASDAQ chart has no observations')

def nasdaq_page():
    text = fetch(SOURCES['nasdaq'][3])
    value = re.search(r'<span class="fprice">([\d,]+)</span>', text)
    date = re.search(r'<span class="ptdate">(\d{4}年\d{2}月\d{2}日)</span>', text)
    change = re.search(r'class="fprice (plus|minus)"[^>]*>(.*?)</div>', text, re.S)
    if not value or not date or not change:
        raise ValueError('NASDAQ page structure changed')
    body = re.sub(r'<[^>]+>', '', change[2])
    amount = re.search(r'([\d,]+)円', body)
    percent = re.search(r'([\d.]+)%', body)
    if not amount:
        raise ValueError('NASDAQ change missing')
    result = series_result([(iso_date(date[1]), value[1].replace(',', ''))], '基準価額')
    sign = -1 if change[1] == 'minus' else 1
    result['change'] = sign * float(amount[1].replace(',', ''))
    result['changePct'] = sign * float(percent[1]) if percent else None
    return result

ADAPTERS = {
    'usd': lambda: yahoo('JPY=X'), 'vix': cboe, 'fear': cnn, 'vi': nikkei,
    'brent': lambda: yahoo('BZ=F'),
    'sox': lambda: parse_fund_csv(fetch('https://www.nam.co.jp/fundinfo/data/csv.php?fund_code=122309', 'cp932'), 'sox'),
    'fang': lambda: parse_fund_csv(fetch('https://www.daiwa-am.co.jp/funds/detail/csv_out.php?code=3346&type=1', 'cp932'), 'fang'),
    'nasdaq': nasdaq,
}

def merge_observation(key, observation, previous, now):
    as_of = dt.datetime.fromisoformat(observation['asOf'].replace('Z', '+00:00'))
    as_of = as_of.replace(tzinfo=UTC) if as_of.tzinfo is None else as_of
    if as_of > now + dt.timedelta(hours=24):
        raise ValueError('Source timestamp is in the future')
    if previous.get('asOf') and observation['asOf'][:10] < previous['asOf'][:10]:
        raise ValueError('Source returned an older observation')
    points = {p['date']: p['value'] for p in previous.get('history', [])}
    points.update({p['date']: p['value'] for p in observation['history']})
    observation['history'] = [{'date': d, 'value': v} for d, v in sorted(points.items())[-90:]]
    return {**observation, 'status': 'ok', 'lastSuccess': now.isoformat(), 'attemptedAt': now.isoformat(), 'error': None}

def collect_one(key, previous, now):
    name, unit, source, url = SOURCES[key]
    base = {'id': key, 'name': name, 'unit': unit, 'source': source, 'sourceUrl': url}
    try:
        result = merge_observation(key, ADAPTERS[key](), previous, now)
    except Exception as exc:
        # Keep the previous observation AND its original dates. Never mark it current.
        result = {**previous, 'status': 'error', 'attemptedAt': now.isoformat(),
                  'error': f'{type(exc).__name__}: {exc}'[:200]}
    return {**result, **base}

def main():
    path = ROOT / 'public/data/market.json'
    old = json.loads(path.read_text()) if path.exists() else {}
    previous = {m['id']: m for m in old.get('metrics', [])}
    now = dt.datetime.now(UTC)
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(collect_one, key, previous.get(key, {}), now) for key in SOURCES]
        metrics = [f.result() for f in futures]
    output = {'schemaVersion': 1, 'generatedAt': now.isoformat(), 'metrics': metrics}
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    tmp.replace(path)
    for m in metrics:
        print(m['id'], m['status'], m.get('asOf', '未取得'), m.get('error') or '')

if __name__ == '__main__':
    main()
