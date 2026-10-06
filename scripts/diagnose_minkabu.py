import urllib.request, urllib.error, re, html
url='https://us.minkabu.jp/stocks/AAPL/researches'
try:
    with urllib.request.urlopen(url,timeout=25) as r:
        text=r.read(4000000).decode('utf-8')
        print('STATUS',r.status,'URL',r.url,'BYTES',len(text))
        print('TITLE',re.findall(r'<title>(.*?)</title>',text,re.S))
        plain=html.unescape(re.sub('<[^>]+>',' ',re.sub(r'<(script|style)\\b[^>]*>.*?</\\1>','',text,flags=re.S)))
        plain=re.sub(r'\\s+',' ',plain)
        for word in ['目標株価','株価診断','アナリスト']:
            pos=plain.find(word); print('TEXT',word,plain[max(0,pos-80):pos+600])
        for word in ['目標株価','株価診断']:
            pos=text.find(word); print('MARKUP',word,text[max(0,pos-500):pos+2000])
except urllib.error.HTTPError as e:
    print('HTTP_ERROR',e.code,e.read(500).decode('utf-8','replace'))
except Exception as e:
    print(type(e).__name__,str(e))
