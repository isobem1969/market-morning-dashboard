import concurrent.futures,pathlib,time,urllib.request
root=pathlib.Path(__file__).resolve().parents[1]
files=["public/app.js","public/apple-minkabu-popup-trial.html","public/common-header.js","public/data-health.css","public/data-health.js","public/fear-panel.js","public/fund-panel.js","public/funds-overview.js","public/funds.html","public/heatmap.html","public/heatmap.js","public/index.html","public/japan-stocks.html","public/logic.js","public/nasdaq-rsi.html","public/nasdaq-rsi.js","public/page-ready-alert.js","public/page-warm.js","public/stock-alerts.js","public/stocks-reference.html","public/sw.js","public/us-etfs.js","public/vi-panel.js","public/overview-summary.js","public/stocks-reference.js"]
def verify(path):
    req=urllib.request.Request('https://isobem1969.github.io/market-morning-dashboard/'+path.removeprefix('public/')+'?release_check='+str(time.time_ns()),headers={'Cache-Control':'no-cache'})
    try:
        with urllib.request.urlopen(req,timeout=20) as r: return path,r.read()==(root/path).read_bytes()
    except Exception as e:
        print(path,type(e).__name__,flush=True);return path,False
for attempt in range(6):
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: bad=[p for p,ok in pool.map(verify,files) if not ok]
    if not bad: print('PUBLIC_RELEASE_ASSETS_VERIFIED',len(files),flush=True);break
    if attempt==5: raise SystemExit('Mismatched public assets: '+str(bad))
    time.sleep(5)
