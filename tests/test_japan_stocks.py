import datetime as dt
import json
import pathlib
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'scripts'))
from update_japan_stocks import TOKYO, parse_ratios, collect, parse_ifis_research, collect_japan_research
from update_stocks import price_observation, parse_research, high_observation

class JapanStockTests(unittest.TestCase):
    def test_ratios_use_forecast_per_and_actual_pbr_without_vip_placeholder(self):
        text = '<link rel="canonical" href="https://finance.yahoo.co.jp/quote/9984.T">'
        for key, value in [('per', '---'), ('perave', '000.00'), ('pbr', '1.18')]:
            text += f'<dl><dt><a data-cl-params="_cl_link:{key};_cl_position:0">{key}</a></dt><dd><span class="_StyledNumber__value_x">{value}</span><span class="_DataListItem__date_x">(<!-- -->15:30<!-- -->)</span></dd></dl>'
        result = parse_ratios(text, '9984.T')
        self.assertIsNone(result['ratios']['per']['value'])
        self.assertEqual(result['ratios']['per']['basis'], '会社予想')
        self.assertEqual(result['ratios']['pbr']['value'], 1.18)
        self.assertIn('日付未掲載', result['ratios']['pbr']['sourceDate'])
        with self.assertRaises(ValueError): parse_ratios(text, '4755.T')
        with self.assertRaises(ValueError): parse_ratios('<html>unavailable</html>', '9984.T')

    def test_tokyo_session_after_midnight_utc_is_not_previous_new_york_day(self):
        stamp = lambda s: int(dt.datetime.fromisoformat(s).timestamp())
        daily = {'timestamp': [stamp('2026-11-17T00:00:00+00:00'), stamp('2026-11-18T00:00:00+00:00')], 'indicators': {'quote': [{'close': [100, 105]}]}}
        meta = {'regularMarketPrice': 104, 'regularMarketTime': stamp('2026-11-18T00:05:00+00:00'), 'currentTradingPeriod': {'regular': {'start': stamp('2026-11-18T00:00:00+00:00'), 'end': stamp('2026-11-18T06:30:00+00:00')}}}
        value = price_observation(daily, {'meta': meta}, dt.datetime.fromisoformat('2026-11-18T00:05:30+00:00'), TOKYO)
        self.assertEqual(value['sessionDate'], '2026-11-18')
        self.assertEqual(value['change'], 4)
        self.assertTrue(value['marketOpen'])

    def test_full_history_highs_use_tokyo_record_dates(self):
        stamp = int(dt.datetime(2026, 11, 18, 0, 0, tzinfo=dt.timezone.utc).timestamp())
        data = {'meta': {'dataGranularity': '1d', 'firstTradeDate': stamp}, 'timestamp': [stamp], 'indicators': {'quote': [{'high': [110]}]}}
        value = high_observation(data, '285A.T', dt.datetime(2026, 11, 19, tzinfo=dt.timezone.utc), TOKYO)
        self.assertEqual(value['allTime']['date'], '2026-11-18')
        self.assertEqual(value['week52']['date'], '2026-11-18')
        self.assertEqual(value['historyStart'], '2026-11-18')
        self.assertEqual(value['asOfDate'], '2026-11-18')

    def test_source_failure_preserves_japanese_prices_and_original_dates(self):
        old = {'price': {'value': 100, 'lastSuccess': '2026-11-18T06:30:00Z'}}
        with patch('update_japan_stocks.chart', side_effect=ValueError('offline')), patch('update_japan_stocks.fetch', side_effect=ValueError('offline')), patch('update_japan_stocks.collect_highs', side_effect=ValueError('offline')), patch('update_japan_stocks.collect_research', return_value={'status': 'error'}):
            value = collect('9984.T', 'ソフトバンクグループ', old, dt.datetime(2026, 11, 19, tzinfo=dt.timezone.utc))
        self.assertEqual(value['price']['value'], 100)
        self.assertEqual(value['price']['lastSuccess'], old['price']['lastSuccess'])
        self.assertEqual(value['price']['status'], 'error')
        self.assertEqual(value['currency'], 'JPY')

    def test_analyst_payload_must_match_yen_currency_and_issuer(self):
        result = {'price': {'symbol': '285A.T', 'quoteType': 'EQUITY', 'currency': 'JPY'}, 'financialData': {'targetMeanPrice': {'raw': 5000}, 'recommendationKey': 'buy'}}
        body = json.dumps({'status': 200, 'body': json.dumps({'quoteSummary': {'result': [result]}})})
        text = '<script data-sveltekit-fetched data-url="https://query1.finance.yahoo.com/v10/finance/quoteSummary/285A.T?formatted=true">' + body + '</script>'
        self.assertEqual(parse_research(text, '285A.T', 'JPY')['target'], 5000)
        with self.assertRaises(ValueError): parse_research(text, '285A.T', 'USD')
        with self.assertRaises(ValueError): parse_research(text, '9984.T', 'JPY')

    def ifis_page(self, code='9984', target='8,023円', count='11人'):
        return f'''<title>ソフトバンクＧ({code}) : 目標株価｜株予報Pro</title>
        <section class="brnd_targetprice target"><h1>目標株価</h1><th>目標株価の平均</th>
        <tbody><tr><td><span>{target}</span></td><td>137.15%</td></tr></tbody></section>
        <section class="brnd_targetprice rating"><p class="rating">★★★★☆&nbsp;やや強気</p>
        <tr><th><span>レーティングの平均</span></th><td>4.36</td></tr>
        <tr><th><span>アナリスト数</span></th><td>{count}</td></tr></section>'''

    def test_ifis_target_is_mean_not_theory_or_upside_and_count_is_rating(self):
        value = parse_ifis_research(self.ifis_page(), '9984.T')
        self.assertEqual(value['target'], 8023)
        self.assertEqual(value['recommendationLabel'], 'やや強気')
        self.assertEqual(value['ratingMean'], 4.36)
        self.assertEqual(value['analysts'], 11)
        self.assertEqual(value['analystCountBasis'], 'rating')
        self.assertIsNone(value['publishedAt'])
        self.assertIn('kabuyoho.jp', value['sourceUrl'])

    def test_ifis_rejects_wrong_issuer_missing_target_and_missing_coverage(self):
        for page in [self.ifis_page(code='4755'), self.ifis_page(target='---'), self.ifis_page(count='0人'), '<html>error</html>']:
            with self.subTest(page=page), self.assertRaises(ValueError):
                parse_ifis_research(page, '9984.T')

    def test_japan_fallback_recovers_failed_yahoo_and_preserves_old_on_total_failure(self):
        now = dt.datetime(2026, 11, 19, tzinfo=dt.timezone.utc)
        old = {'target': 7000, 'lastSuccess': '2026-11-17T00:00:00Z', 'source': 'old'}
        with patch('update_japan_stocks.collect_research', return_value={'status':'error'}), patch('update_japan_stocks.fetch', return_value=self.ifis_page()):
            value = collect_japan_research('9984.T', old, now)
        self.assertEqual(value['status'], 'ok')
        self.assertEqual(value['target'], 8023)
        self.assertEqual(value['lastSuccess'], now.isoformat())
        with patch('update_japan_stocks.collect_research', return_value={'status':'error'}), patch('update_japan_stocks.fetch', side_effect=ValueError('offline')):
            value = collect_japan_research('9984.T', old, now)
        self.assertEqual(value['status'], 'error')
        self.assertEqual(value['target'], old['target'])
        self.assertEqual(value['lastSuccess'], old['lastSuccess'])

    def test_successful_yahoo_does_not_fetch_fallback(self):
        with patch('update_japan_stocks.collect_research', return_value={'status':'ok','target':5000}), patch('update_japan_stocks.fetch') as fetcher:
            self.assertEqual(collect_japan_research('285A.T', {}, dt.datetime.now(dt.timezone.utc))['target'], 5000)
            fetcher.assert_not_called()

if __name__ == '__main__': unittest.main()
