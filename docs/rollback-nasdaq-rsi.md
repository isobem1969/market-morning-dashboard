# NASDAQ100・RSI 追加の取り消し

変更前のブランチ: `backup/before-nasdaq-rsi-20261113`

必要な場合は、下記の既存ファイルだけをこのブランチから復元し、公開する。

- public/index.html
- public/stocks-reference.html
- public/heatmap.html
- public/page-tabs.css
- public/page-warm.js
- public/page-ready-alert.js
- public/shared-data.js
- public/sw.js
- .github/workflows/update-and-deploy.yml
- tests/ready-alert.test.js
- tests/shared-data.test.js
- tests/navigation-live.mjs

新規ファイル public/nasdaq-rsi.html、nasdaq-rsi.css、nasdaq-rsi.js、scripts/update_rsi.py、tests/test_rsi.py と public/data/nasdaq-rsi.json は削除可能。
既存の市場・個別株・ヒートマップデータは復元せず、最新版を維持する。
復元時も sw.js の CACHE 名は新しい日付に変更し、過去の静的ファイルが残らないようにする。

# データ定義

RSIはNASDAQ100指数（^NDX）の取得可能な全日次終値を週末で集約し、Wilderの14週平均で算出する。確定値と未確定値を混ぜない。確定は米国株式市場カレンダーによる最終取引終了20分後、かつ当該最終日の観測が存在する場合のみ。

価格比較の高値は取得期間の最高終値。日中高値ではない。取得開始日を併記する。TQQQは分割調整済み終値を使用し配当再投資を含まない。

参考: https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/RSI
カレンダー: exchange-calendars 4.13.2 の XNYS（米国株式の共通休場日・短縮取引）。
