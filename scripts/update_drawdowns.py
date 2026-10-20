"""Published daily NAV drawdowns, calculated from inception without annual reset."""
import csv
import datetime as dt
import io
import json
from pathlib import Path
from update_data import fetch, iso_date, parse_mufg_csv, parse_wealthadvisor_xml, nasdaq_page

ROOT = Path(__file__).resolve().parents[1]
FUNDS = {
    'fang': ('3346', 'iFreeNEXT FANG＋'),
    'nasdaq': ('3373', 'iFreeNEXT NASDAQ100'),
}
EXTRA_FUNDS = {
    'sp500_slim': ('eMAXIS Slim 米国株式（S&P500）', 'm00355320'),
    'allcountry_slim': ('eMAXIS Slim 全世界株式（オルカン）', 'm00355920'),
}

def comparison_points(points, name, source_url, source_label):
    points = sorted(points)
    if not points or len({d for d, _ in points}) != len(points):
        raise ValueError('Missing or duplicate NAV dates')
    peak = 0
    all_points = []
    for date, nav in points:
        dt.date.fromisoformat(date)
        if not 0 < nav < float('inf'):
            raise ValueError('Invalid NAV')
        peak = max(peak, nav)
        all_points.append({'date': date, 'value': round((nav / peak - 1) * 100, 6)})
    year = int(points[-1][0][:4])
    return {'name': name, 'sourceUrl': source_url, 'sourceLabel': source_label,
            'startDate': points[0][0], 'asOf': points[-1][0], 'currentYear': year,
            'years': {str(y): [p for p in all_points if p['date'].startswith(str(y))] for y in (year - 1, year)}}

def comparison(text, name, code):
    points = [(iso_date(r['基準日']), float(r['基準価額'])) for r in csv.DictReader(io.StringIO(text))]
    return comparison_points(points, name,
        f'https://www.daiwa-am.co.jp/funds/detail/{code}/detail_top.html', '大和アセットの公表データ')

def extra_comparison(key):
    if key == 'schd':
        nav = parse_wealthadvisor_xml(fetch('https://apl.wealthadvisor.jp/xml/chart/funddata/2024122003.xml', 'cp932'), history_limit=100000)
        points = [(p['date'], p['value']) for p in nav['history']]
        latest = nasdaq_page('schd')
        if latest['asOf'] >= nav['asOf']:
            points = [(date, value) for date, value in points if date != latest['asOf']]
            points.append((latest['asOf'], latest['value']))
        result = comparison_points(points,
            'SBI・SCHD（年4回決算型）',
            'https://apl.wealthadvisor.jp/webasp/sbi_am/pc/basic/sa_2024122003.html',
            'SBIアセット案内の公表データ')
        result['distributionNote'] = '年4回決算型の基準価額で計算。分配金の支払いによる低下を含みます。分配金再投資・受取分配金込みの損益ではありません。'
        return result
    name, code = EXTRA_FUNDS[key]
    nav = parse_mufg_csv(fetch(f'https://fs.bk.mufg.jp/webasp/mufg/fund/detail/chart/csv/{code}.csv', 'cp932'), history_limit=100000)
    return comparison_points([(p['date'], p['value']) for p in nav['history']], name,
        f'https://fs.bk.mufg.jp/webasp/mufg/fund/detail/{code}.html', '三菱UFJ銀行の公表データ')

def main():
    path = ROOT / 'public/data/fund-drawdowns.json'
    output = json.loads(path.read_text()) if path.exists() else {}
    for key in [*FUNDS, *EXTRA_FUNDS, 'schd']:
        try:
            if key in FUNDS:
                code, name = FUNDS[key]
                result = comparison(fetch(f'https://www.daiwa-am.co.jp/funds/detail/csv_out.php?code={code}&type=1', 'cp932'), name, code)
            else:
                result = extra_comparison(key)
            if output.get(key, {}).get('asOf', '') > result['asOf']:
                raise ValueError('Source date moved backwards')
            output[key] = {**result, 'lastSuccess': dt.datetime.now(dt.timezone.utc).isoformat(), 'error': None}
            print(key, result['asOf'])
        except Exception as exc:
            if key in output:
                output[key]['error'] = '更新取得に失敗：保存済みデータを表示'
            print(key, type(exc).__name__, str(exc)[:150])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n')

if __name__ == '__main__':
    main()
