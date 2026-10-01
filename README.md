# 毎朝の株式指標 / Market Morning

iPhone・iPad mini向けの8指標ダッシュボード。Safariの「ホーム画面に追加」でアプリのように利用できます。

## 表示

- ドル円・VIX・CNN Fear & Greed・日経VI・ブレント期近先物
- ニッセイSOX（29314233）・iFreeNEXT FANG+（04311181）・SBI NASDAQ100（89311265）の基準価額
- 日時、取得状況、前日比、直近7回／30回のグラフと数値
- VIX ≥30、Fear & Greed <20、日経VI ≥50の赤色アラート

起動時に保存済みサーバーデータを読み込みます。取得はGitHub Actionsで毎時17分（UTC）。実行や公開には遅延があり、リアルタイム取得ではありません。各指標の日時を確認してください。VIX・日経VIは日次終値、投信は日本の公表基準価額です。

## データ取得

`python scripts/update_data.py` はPython標準ライブラリだけで動作します。

| 指標 | 取得元 |
| --- | --- |
| ドル円・Brent | Yahoo Financeの公開チャートデータ |
| VIX | Cboe日次CSV |
| Fear & Greed | CNN公開データ。現在の実行環境ではHTTP 418で取得失敗 |
| 日経VI | 日経公式日次CSV |
| SOX | ニッセイアセット公式CSV |
| FANG+ | 大和アセット公式CSV |
| NASDAQ100 | SBI運用会社が案内するWealth Advisorの公表値・チャートXML |

公開データの取得仕様は保証されたAPI契約ではありません。取得制限や仕様変更がある場合、各指標に失敗を表示します。古い値は取得日時を変更せずに保持し、失敗・4日超・取得処理30時間超・オフラインの値は条件判定から除外します。CNNは端末内の日付付き手入力で補完できます。自動取得に成功し同日以降の値が得られた場合、自動値を優先します。

会話にあった値・推定値・旧設定来高値は初期データに使っていません。最高値は取得できた公表履歴から計算します。チャートは直近の観測回数で、暦日ではありません。

## 公開

1. リポジトリの **Settings → Pages → Source** を **GitHub Actions** に設定します。
2. **Actions → Update market data and publish → Run workflow** で初回取得・公開を実行します。
3. 公開先：`https://isobem1969.github.io/market-morning-dashboard/`

ワークフローは更新データをリポジトリへ保存し、その実行内でPagesを公開します。すべての取得失敗も画面に反映し、前回値を最新と表示しません。定期実行の状態はActions画面で確認できます。

## ローカル検証

```sh
node --test tests/logic.test.js
python -m unittest discover -s tests -p 'test_*.py'
python scripts/update_data.py
python -m http.server 8765 --directory public
```

しきい値は利用者指定の観測ルールです。将来の収益や売買結果を保証しません。売買や通知を自動実行する機能はありません。
