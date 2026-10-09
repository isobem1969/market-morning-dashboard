"""Official daily NAV drawdowns, calculated from inception without annual reset."""
import csv
import datetime as dt
import io
import json
from pathlib import Path
from update_data import fetch, iso_date

ROOT = Path(__file__).resolve().parents[1]
FUNDS = {'fang': ('3346', 'iFreeNEXT FANG＋'), 'nasdaq': ('3373', 'iFreeNEXT NASDAQ100')}

def comparison(text, name, code):
    points = sorted((iso_date(r['基準日']), float(r['基準価額'])) for r in csv.DictReader(io.StringIO(text)))
    if not points or len({d for d, _ in points}) != len(points):
        raise ValueError('Missing or duplicate NAV dates')
    peak = 0
    all_points = []
    for date, nav in points:
        if not 0 < nav < float('inf'):
            raise ValueError('Invalid NAV')
        peak = max(peak, nav)
        all_points.append({'date': date, 'value': round((nav / peak - 1) * 100, 6)})
    year = int(points[-1][0][:4])
    return {'name': name, 'sourceUrl': f'https://www.daiwa-am.co.jp/funds/detail/{code}/detail_top.html',
            'startDate': points[0][0], 'asOf': points[-1][0], 'currentYear': year,
            'years': {str(y): [p for p in all_points if p['date'].startswith(str(y))] for y in (year - 1, year)}}

def main():
    path = ROOT / 'public/data/fund-drawdowns.json'
    output = json.loads(path.read_text()) if path.exists() else {}
    for key, (code, name) in FUNDS.items():
        try:
            result = comparison(fetch(f'https://www.daiwa-am.co.jp/funds/detail/csv_out.php?code={code}&type=1', 'cp932'), name, code)
            if output.get(key, {}).get('asOf', '') > result['asOf']:
                raise ValueError('Source date moved backwards')
            output[key] = {**result, 'lastSuccess': dt.datetime.now(dt.timezone.utc).isoformat(), 'error': None}
            print(key, result['asOf'])
        except Exception as exc:
            if key in output:
                output[key]['error'] = '更新取得に失敗：保存済みデータを表示'
            print(key, type(exc).__name__, str(exc)[:150])
    path.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n')

if __name__ == '__main__':
    main()
