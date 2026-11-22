# Public data sources and failure behavior

| Data | Preferred source | Verified alternate path |
| --- | --- | --- |
| Seven Japanese mutual funds | Issuer/NAM/MUFG/Wealth Advisor published price history | SBI Securities public historical-NAV CSV, identified by fund code and fund name |
| VIX | Cboe daily CSV | Yahoo Finance `^VIX` daily chart |
| Fear & Greed | CNN public feed | Fear & Greed Graph public feed |
| Equity, ETF, FX and Brent histories | Yahoo chart `query1` | Yahoo chart `query2`, preserving symbol and query |
| US PER/PBR | Yahoo Japan visible actual-ratio fields | Yahoo Finance key-statistics and quote-page public embedded data; trailing PE and price/book only |
| Japan PER/PBR | Yahoo Japan forecast PER / actual PBR | Yahoo Finance actual ratios; each field's basis is shown explicitly |
| Analyst estimates | Yahoo analysis | Yahoo key-statistics/quote pages; Japanese stocks also retain IFIS fallback |
| Nikkei VI | Nikkei published daily CSV | No independently verified alternative yet; acquisition failure stays visible as a red alert |

An alternate is accepted only after its issuer, currency/price basis, publication date and format have been validated. Successful HTTP delivery of an old file is not a successful current acquisition. Candidate results and errors are retained in `sourceAttempts` for the fund and valuation collectors. Archive coverage is never inferred from a successful fetch.

SBI's CSV date range is requested from the fund's actual inception. Historical prices are not reconstructed from percentages or filled over holidays. The main NAV chart and drawdown comparison use the same validated source series, including its inception peak.

`health-calendar.json` contains actual XTKS/XNYS sessions, holidays, early closes and publication deadlines. The browser compares the raw sections (not just JSON download success) with these deadlines. Failed fields, stale dates, incomplete graphs, failed refreshes, missing or invalid acquired-history ranges and an unavailable calendar remain red. A published `---` is represented as `availability: unpublished`, not a retrieval error. Closed markets do not demand fictitious weekend observations.

The six-page rendering progress remains a separate measure. `6/6 表示準備` never overrides an item-level data-health failure.

## Restore the previous source

The pre-change branch is `backup/before-resilient-data-health-20261122` (commit `3a362006d5dee6ba801c7796fa8d1c0279eb1337`). Prefer reverting the feature commit, preserving later market observations, rather than resetting the public branch and losing collected data.

Unknown original listing coverage alone is accepted as an acquired-period maximum when the displayed start/end dates, peak record date, peak and comparison price are valid. It does not make the global health banner red or create an unchecked all-time error. Collection errors and stale timestamps still do. The original listing-complete flag is retained, and the UI uses the acquired-period label.

TQQQ and SOXL belong to the US stocks page, after the 13 equities. Their existing market and drawdown snapshots remain shared; no parallel quote collector is introduced. The funds page and its condition list contain seven mutual funds. ETF condition summaries, acquisition failures and drawdown failures belong to US stocks. Old root/funds anchors redirect to the moved panels, and NASDAQ100/RSI links use the same page ownership registry.
