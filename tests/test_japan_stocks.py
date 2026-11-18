import datetime as dt
import json
import pathlib
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'scripts'))
from update_japan_stocks import TOKYO, parse_ratios, collect
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

if __name__ == '__main__': unittest.main()
