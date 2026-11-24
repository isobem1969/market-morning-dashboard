import {chromium,webkit} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {FUND_IDS} from '../public/asset-pages.js';
const engine=process.env.BROWSER||'chromium',base=process.env.TEST_BASE_URL||'http://127.0.0.1:8773/';
const browser=await(engine==='webkit'?webkit:chromium).launch(),source={};
for(const k of ['market','stocks','japan-stocks','fund-drawdowns','nasdaq-rsi','heatmap','health-calendar'])source[k]=JSON.parse(await fs.readFile('public/data/'+k+'.json','utf8'));
await fs.mkdir('screenshots',{recursive:true});
function fixture(saved){
 const d=structuredClone(source),stamp=new Date().toISOString(),day=stamp.slice(0,10),end=Date.parse(day+'T18:00:00Z')/1000;
 const history=[500,300,100,20,3,0].map((n,i)=>({date:new Date((end-n*86400)*1000).toISOString().slice(0,10),value:[120,110,100,75,65,60][i]}));
 for(const m of d.market.metrics){Object.assign(m,{status:saved?'error':'ok',error:saved?'Acquisition unavailable':null,lastSuccess:stamp,asOf:day});if([...FUND_IDS,'tqqq','soxl'].includes(m.id))Object.assign(m,{value:60,peak:120,history});else {m.value=({vix:40,fear:10,vi:60})[m.id]||60;m.history=[{date:day,value:m.value}];}}
 d.market.generatedAt=stamp;
 for(const k of ['stocks','japan-stocks']){d[k].generatedAt=stamp;for(const s of d[k].stocks){for(const part of ['price','highs','japan','research'])Object.assign(s[part],{lastSuccess:stamp,status:saved?'error':'ok',error:saved?'Acquisition unavailable':null});Object.assign(s.price,{value:60,sessionDate:day,asOf:day,daily:history.map(p=>({time:Date.parse(p.date+(k==='japan-stocks'?'T06:00:00Z':'T18:00:00Z'))/1000,value:p.value,high:p.value})),intraday:[{time:end-(k==='japan-stocks'?12*3600:0),value:60,high:60}]});Object.assign(s.highs,{historyStart:history[0].date,asOfDate:day,allTime:{value:120,date:history[0].date,complete:false}});}}
 for(const dd of Object.values(d['fund-drawdowns'])){dd.lastSuccess=stamp;dd.error=null;}
 const r=d['nasdaq-rsi'];r.generatedAt=stamp;r.status=saved?'error':'ok';r.error=saved?'Acquisition unavailable':null;for(const p of Object.values(r.prices))Object.assign(p,{value:60,asOf:day,closeHistory:history});
 d.heatmap.generatedAt=stamp;d.heatmap.stocks.forEach((s,i)=>Object.assign(s,{status:saved?'error':'ok',error:saved?'Acquisition unavailable':null,lastSuccess:stamp,sessionDate:day,asOf:day,periods:Object.fromEntries(['1d','1w','1m'].map((p,j)=>[p,{changePct:(i+j)%3===0?-5:2,referencePrice:100,referenceDate:day}]))}));
 d['health-calendar']={schemaVersion:1,feeds:Object.fromEntries(['jpFund','jpPrice','jpDaily','usPrice','usDaily'].map(k=>[k,[{date:day,dueAt:day+'T00:00:00Z'},{date:'2099-01-01',dueAt:'2099-01-01T00:00:00Z'}]]))};return d;
}
async function sync(page,panelSelector,topSelector,kind){
 const rows=await page.locator(panelSelector).evaluateAll((els,kind)=>els.map(el=>{const c=el.querySelector(kind==='stock'?'.stock-high[data-high-kind="period"] .high-condition':kind==='rsi'?'.high-condition':'.fund-high .high-condition');return {id:el.id,hit:!!c?.classList.contains('is-hit'),reference:c?.dataset.reference==='true'};}),kind);
 for(const row of rows){const link=page.locator(topSelector+' a[href="#'+row.id+'"]');assert.equal(await link.count(),row.hit?1:0,`${kind} ${row.id} panel/top disagreement`);if(row.hit&&row.reference)assert.match(await link.innerText(),/保存値/);}
}
try{
 for(const width of [1440,744,390,320])for(const saved of [false,true]){
  const files=fixture(saved),context=await browser.newContext({viewport:{width,height:1133},serviceWorkers:'block'}),page=await context.newPage();
  await page.route('**/data/*.json*',route=>{const k=new URL(route.request().url()).pathname.split('/').at(-1).replace('.json','');return files[k]?route.fulfill({json:files[k]}):route.continue();});
  for(const [path,panel,top,kind]of [['funds.html','#cards>.fund-card','#funds-overview','fund'],['stocks-reference.html','#stocks>.stock-tile','#stock-alert-list','stock'],['japan-stocks.html','#stocks>.stock-tile','#stock-alert-list','stock'],['nasdaq-rsi.html','.price-grid>.panel','#rsi-price-overview','rsi']]){
   await page.goto(base+path,{waitUntil:'domcontentloaded'});await page.locator(panel).last().waitFor();await page.waitForFunction(()=>!!window.__morningHealthState?.checkedAt);
   await sync(page,panel,top,kind);if(path==='stocks-reference.html'){await page.locator('#metric-soxl').waitFor();await sync(page,'#us-etfs>.fund-card',top,'fund');assert.equal(await page.locator('#stock-alert-list a[href="#metric-tqqq"],#stock-alert-list a[href="#metric-soxl"]').count(),2);}
   const selectors=kind==='rsi'?'[data-price-period]':kind==='stock'?'[data-period]':'[data-fund-period]';
   const ids=await page.locator(panel).evaluateAll(els=>els.map(e=>e.id));if(path==='stocks-reference.html')ids.push('metric-tqqq','metric-soxl');
   for(const id of ids){
    const etf=id.startsWith('metric-')&&path==='stocks-reference.html',selector=etf?'[data-fund-period]':selectors;
    for(const p of (width===744?['1d','1w','1m','6m','1y','2y']:['1d','6m'])){
     const attr=etf||kind==='fund'?'data-fund-period':kind==='stock'?'data-period':'data-price-period';
     await page.locator('[id="'+id+'"] '+selector+'['+attr+'="'+p+'"]').evaluate(e=>e.click());
     await sync(page,etf?'#us-etfs>.fund-card':panel,top,etf?'fund':kind);
    }
   }
   if(saved)assert.match(await page.locator(top).innerText(),/保存値/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,path+' overflow '+width);
   await page.locator(top).scrollIntoViewIfNeeded();await page.screenshot({path:`screenshots/overview-${engine}-${width}-${saved}-${path}.png`});
  }
  await page.goto(base+'heatmap.html');await page.locator('#heatmap-overview a').first().waitFor();await page.waitForFunction(()=>!!window.__morningHealthState?.checkedAt);
  for(const view of ['both','sp','nas'])for(const p of ['1d','1w','1m']){
   await page.locator('#views [data-view="'+view+'"]').evaluate(e=>e.click());await page.locator('#periods [data-period="'+p+'"]').evaluate(e=>e.click());
   const expected=await page.locator('#panels .tile').evaluateAll(els=>[...new Set(els.filter(e=>e.querySelector('.move').textContent.includes('↓')).map(e=>e.dataset.symbol))].sort());
   const actual=await page.locator('#heatmap-overview [data-overview-item]').evaluateAll(els=>els.map(e=>e.dataset.overviewItem).sort());assert.deepEqual(actual,expected);
  }
  await page.goto(base);await page.locator('.conditions .condition-reached').first().waitFor();await page.waitForFunction(()=>!!window.__morningHealthState?.checkedAt);assert.equal(await page.locator('.conditions .condition-reached').count(),3);if(saved)assert.match(await page.locator('#summary').innerText(),/保存値/);
  await context.close();console.log('ALL_SIX_PAGE_OVERVIEWS_MATCH_PANELS',engine,width,saved?'SAVED':'CURRENT');
 }
 // ETF summaries must not depend on the individual-stock snapshot succeeding.
 {
  const files=fixture(false),context=await browser.newContext({viewport:{width:744,height:1133},serviceWorkers:'block'}),page=await context.newPage();
  await page.route('**/data/*.json*',route=>{const k=new URL(route.request().url()).pathname.split('/').at(-1).replace('.json','');return k==='stocks'?route.abort():files[k]?route.fulfill({json:files[k]}):route.continue();});
  await page.goto(base+'stocks-reference.html');await page.locator('#metric-soxl').waitFor();
  await page.waitForFunction(()=>document.querySelectorAll('#stock-alert-list a[href="#metric-tqqq"],#stock-alert-list a[href="#metric-soxl"]').length===2);
  assert.match(await page.locator('#stock-alert-detail').innerText(),/14銘柄は最新値または/);
  await context.close();console.log('ETFS_REMAIN_IN_OVERVIEW_WHEN_EQUITY_SNAPSHOT_FAILS',engine);
 }
 // Missing numeric values must never become a hit or an all-clear on any page.
 {
  const files=fixture(false);
  for(const m of files.market.metrics){m.value=null;m.lastSuccess=null;}
  for(const k of ['stocks','japan-stocks'])for(const s of files[k].stocks){s.price.value=null;s.price.lastSuccess=null;}
  for(const p of Object.values(files['nasdaq-rsi'].prices))p.value=null;
  for(const s of files.heatmap.stocks)for(const p of Object.values(s.periods))p.changePct=null;
  const context=await browser.newContext({viewport:{width:744,height:1133},serviceWorkers:'block'}),page=await context.newPage();
  await page.route('**/data/*.json*',route=>{const k=new URL(route.request().url()).pathname.split('/').at(-1).replace('.json','');return files[k]?route.fulfill({json:files[k]}):route.continue();});
  for(const [path,top]of [['funds.html','#funds-overview'],['stocks-reference.html','#stock-overview'],['japan-stocks.html','#stock-overview'],['nasdaq-rsi.html','#rsi-price-overview'],['heatmap.html','#heatmap-overview'],['','#summary']]){
   await page.goto(base+path);await page.locator(top).waitFor();await page.waitForFunction(()=>!!window.__morningHealthState?.checkedAt);
   assert.match(await page.locator(top).innerText(),/判定保留/);assert.equal(await page.locator(top+' a[href^="#metric-"],'+top+' a[href^="#stock-"],'+top+' [data-overview-item]').count(),0);
  }
  await context.close();console.log('ALL_SIX_PAGES_HOLD_MISSING_VALUES',engine);
 }
}finally{await browser.close();}
