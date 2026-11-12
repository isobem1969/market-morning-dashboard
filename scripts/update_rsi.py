"""NASDAQ100 Wilder weekly RSI, from actual Yahoo daily index closes.

Calendar uses the shared US equity session calendar (XNYS); holidays and early
closes are respected. No TQQQ RSI or proxy ETF replaces the NASDAQ100 index.
"""
import concurrent.futures
import datetime as dt
import json
import math
import pathlib
from urllib.parse import quote
from zoneinfo import ZoneInfo
import exchange_calendars as xcals
from update_data import fetch

ROOT = pathlib.Path(__file__).resolve().parents[1]
UTC = dt.timezone.utc
NY = ZoneInfo('America/New_York')

def wilder(values, period=14):
    result = [None] * len(values)
    if len(values) <= period:
        return result
    changes = [b-a for a,b in zip(values, values[1:])]
    gain = sum(max(v,0) for v in changes[:period])/period
    loss = sum(max(-v,0) for v in changes[:period])/period
    def score(g,l):
        return 50.0 if g == l == 0 else 100.0 if l == 0 else 100-100/(1+g/l)
    result[period] = score(gain,loss)
    for i in range(period+1,len(values)):
        gain = (gain*(period-1)+max(changes[i-1],0))/period
        loss = (loss*(period-1)+max(-changes[i-1],0))/period
        result[i] = score(gain,loss)
    return result

def daily(symbol):
    obj = json.loads(fetch('https://query1.finance.yahoo.com/v8/finance/chart/'+quote(symbol,safe='')+'?period1=0&period2='+str(int(dt.datetime.now(UTC).timestamp()))+'&interval=1d&includePrePost=false'))
    r = obj['chart']['result'][0]
    if r['meta']['symbol'] != symbol or r['meta']['dataGranularity'] != '1d':
        raise ValueError('Unexpected symbol or non-daily series')
    rows = {}
    for stamp,value in zip(r.get('timestamp',[]),r['indicators']['quote'][0]['close']):
        if value is not None and math.isfinite(value) and value>0:
            date = dt.datetime.fromtimestamp(stamp,NY).date().isoformat()
            rows[date] = {'date':date,'value':float(value)}
    if len(rows)<100:
        raise ValueError('Insufficient daily history')
    return r['meta'], [rows[k] for k in sorted(rows)]

def weekly(rows, now, calendar):
    groups = {}
    for row in rows:
        date = dt.date.fromisoformat(row['date'])
        monday = date-dt.timedelta(days=date.weekday())
        groups[monday] = row
    confirmed, provisional = [], None
    for monday,row in sorted(groups.items()):
        friday=monday+dt.timedelta(days=4)
        sessions=calendar.sessions_in_range(monday.isoformat(),friday.isoformat())
        if len(sessions)==0:
            continue
        last=sessions[-1]
        close=calendar.session_close(last).to_pydatetime()
        item={**row,'week':monday.isoformat(),'confirmedAt':close.isoformat()}
        if now >= close+dt.timedelta(minutes=20):
            if row['date'] != last.date().isoformat():
                raise ValueError('Missing final weekly session: '+last.date().isoformat())
            confirmed.append(item)
        elif monday <= now.astimezone(NY).date() <= monday+dt.timedelta(days=6):
            provisional=item
    return confirmed,provisional

def episodes(history, predicate):
    runs=[]
    for p in history:
        if predicate(p['rsi']):
            if not runs or runs[-1].get('end'):
                runs.append({'start':p['date'],'weeks':0,'last':p['date'],'end':None})
            runs[-1]['weeks']+=1
            runs[-1]['last']=p['date']
        elif runs and not runs[-1].get('end'):
            runs[-1]['end']=p['date']
    return {'current':runs[-1] if runs and not runs[-1]['end'] else None,
            'last':runs[-1] if runs else None,'events':runs[-30:]}

def price(meta, rows, now):
    regular=meta['currentTradingPeriod']['regular']
    active=regular['start'] <= now.timestamp() < regular['end']
    today=now.astimezone(NY).date().isoformat()
    completed=[p for p in rows if p['date']<today or now.timestamp()>=regular['end']]
    if not completed:
        raise ValueError('No completed prices')
    current={'date':dt.datetime.fromtimestamp(meta['regularMarketTime'],NY).date().isoformat(),
             'value':float(meta['regularMarketPrice'])} if active else completed[-1]
    peak=max(p['value'] for p in completed+[current])
    previous=completed[-1] if active else completed[-2]
    return {'value':current['value'],'previous':previous['value'],'asOf':current['date'],
            'marketOpen':active,'peak':peak,'ratio':current['value']/peak*100,
            'drawdown':(current['value']/peak-1)*100,'historyStart':rows[0]['date'],
            'peakLabel':'取得期間の最高終値（分割調整済み）'}

def collect(now=None):
    now=now or dt.datetime.now(UTC)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        ndx_task=pool.submit(daily,'^NDX')
        tqqq_task=pool.submit(daily,'TQQQ')
        soxl_task=pool.submit(daily,'SOXL')
        meta,rows=ndx_task.result()
        tmeta,trows=tqqq_task.result()
        smeta,srows=soxl_task.result()
    calendar=xcals.get_calendar('XNYS',start=str(int(rows[0]['date'][:4])-1)+'-01-01',end=str(now.year+1)+'-12-31')
    weeks,provisional=weekly(rows,now,calendar)
    scores=wilder([p['value'] for p in weeks])
    history=[{**p,'rsi':r} for p,r in zip(weeks,scores) if r is not None]
    if len(history)<52:
        raise ValueError('Insufficient confirmed RSI history')
    if provisional:
        provisional={**provisional,'rsi':wilder([p['value'] for p in weeks]+[provisional['value']])[-1]}
    buy=episodes(history,lambda v:v<40)
    sell=episodes(history,lambda v:v>75)
    return {'schemaVersion':1,'generatedAt':now.isoformat(),'status':'ok','error':None,
            'source':'Yahoo Finance / NASDAQ100 (^NDX)・TQQQ・SOXL',
            'period':14,'method':'Wilder RMA・週の最終通常取引終値・米国東部時間',
            'historyStart':rows[0]['date'],'confirmed':history[-1],'previous':history[-2],
            'provisional':provisional,'history':history[-520:], 'buy':buy,'sell':sell,
            'prices':{'ndx':price(meta,rows,now),'tqqq':price(tmeta,trows,now),'soxl':price(smeta,srows,now)}}

def main():
    target=ROOT/'public/data/nasdaq-rsi.json'
    try:
        result=collect()
    except Exception as exc:
        if not target.exists():
            raise
        result=json.loads(target.read_text())
        result.update(status='error',error=str(exc)[:180],attemptedAt=dt.datetime.now(UTC).isoformat())
        print('RSI update failed; preserving dated observations:',str(exc))
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print('NASDAQ100 weekly RSI:',result['confirmed']['date'],round(result['confirmed']['rsi'],4),result['status'])

if __name__=='__main__':
    main()

