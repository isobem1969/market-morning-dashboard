"""Collect only the new Class A record for isolated browser verification."""
import datetime as dt
import json
from update_stocks import ROOT, STOCKS, collect

path = ROOT / 'public/data/stocks.json'
data = json.loads(path.read_text())
now = dt.datetime.now(dt.timezone.utc)
name = dict(STOCKS)['BRK-A']
old = next((s for s in data['stocks'] if s['symbol'] == 'BRK-A'), {})
stock = collect('BRK-A', name, old, now)
for section in ['price', 'highs', 'japan', 'research']:
    if stock[section]['status'] != 'ok':
        raise RuntimeError(section + ': ' + str(stock[section].get('error')))
assert stock['price']['value'] > 100000, 'Unexpected Class A price scale'
assert stock['displaySymbol'] == 'BRK.A' and stock['exchange'] == 'NYSE'
records = {s['symbol']: s for s in data['stocks']}
records['BRK-A'] = stock
data['stocks'] = [records[symbol] for symbol, _ in STOCKS]
data['generatedAt'] = now.isoformat()
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
print('BRKA_CURRENT_SOURCE_VERIFIED', stock['price']['value'], stock['price']['sessionDate'])
