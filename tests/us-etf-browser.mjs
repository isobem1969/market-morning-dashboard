import {chromium,webkit} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const engine=process.env.BROWSER||'chromium',base=process.env.TEST_BASE_URL||'http://127.0.0.1:8773/';
const browser=await(engine==='webkit'?webkit:chromium).launch(),original={};
for(const k of ['market','stocks','japan-stocks','fund-drawdowns','nasdaq-rsi','heatmap','health-calendar'])original[k]=JSON.parse(await fs.readFile('public/data/'+k+'.json','utf8'));
await fs.mkdir('screenshots',{recursive:true});
try{
 for(const width of [1440,744,390,320]){
  const files=structuredClone(original),stamp=new Date().toISOString(),day=files.market.metrics[0].history.at(-1).date;
  for(const f of ['stocks','japan-stocks']){files[f].generatedAt=stamp;for(const s of files[f].stocks){for(const key of ['price','highs','japan','research']){s[key].status='ok';s[key].error=null;s[key].lastSuccess=stamp;}s.japan.asOf=day;}}
  files.market.generatedAt=stamp;for(const m of files.market.metrics){m.status='ok';m.error=null;m.lastSuccess=stamp;}
  for(const id of ['tqqq','soxl']){const m=files.market.metrics.find(m=>m.id===id);Object.assign(m,{value:60,peak:100,asOf:day,change:-40,changePct:-40,history:[{date:day.slice(0,4)+'-06-01',value:100},{date:day,value:60}]});}
  for(const d of Object.values(files['fund-drawdowns'])){d.error=null;d.lastSuccess=stamp;}
  files['nasdaq-rsi'].generatedAt=stamp;for(const s of files.heatmap.stocks)s.lastSuccess=stamp;
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('ETF_PAGE_ERROR',e.stack||e.message);});let fail=false;
  await page.route('**/data/*.json*',async route=>{const k=new URL(route.request().url()).pathname.split('/').at(-1).replace('.json','');if(!files[k])return route.continue();const d=structuredClone(files[k]);if(fail&&k==='market'){const m=d.metrics.find(m=>m.id==='tqqq');m.status='error';m.error='ETF source 403 Forbidden';}return route.fulfill({json:d});});
  await page.goto(base);await page.waitForFunction(()=>document.querySelector('#page-ready-alert')?.dataset.phase==='complete');
  assert.equal(await page.locator('#ready-alert-progress').getAttribute('aria-valuenow'),'18');
  assert.equal(await page.locator('[data-fund]').count(),0);
  await page.goto(base+'funds.html');await page.waitForFunction(()=>window.__morningHealthState?.kind==='ready');
  assert.deepEqual(await page.locator('#cards>.fund-card').evaluateAll(a=>a.map(e=>e.dataset.fund)),['sox','fang','nasdaq','nasdaq_ifree','sp500_slim','allcountry_slim','schd']);
  assert.doesNotMatch(await page.locator('#funds-overview').innerText(),/TQQQ|SOXL/);
  await page.goto(base+'stocks-reference.html');await page.waitForFunction(()=>window.__morningRenderState?.stocks?.etfsReady&&window.__morningHealthState?.kind==='ready');
  assert.equal(await page.locator('#stocks>.stock-tile').count(),13);assert.deepEqual(await page.locator('#us-etfs>.fund-card').evaluateAll(a=>a.map(e=>e.dataset.fund)),['tqqq','soxl']);
  assert.ok(await page.evaluate(()=>document.querySelector('#stocks').getBoundingClientRect().bottom<=document.querySelector('#us-etfs').getBoundingClientRect().top));
  for(const id of ['tqqq','soxl']){assert.equal(await page.locator('#stock-alert-list a[href="#metric-'+id+'"]').count(),1);assert.equal(await page.locator('#metric-'+id+' .fund-chart').count(),1);assert.equal(await page.locator('#metric-'+id+' .drawdown-panel').count(),1);assert.equal(await page.locator('#metric-'+id+' .fund-rsi-link').getAttribute('href'),'./nasdaq-rsi.html#price-'+id);}
  const count=Number((await page.locator('#stock-alert-title').innerText()).match(/(\d+)銘柄/)[1]);
  await page.locator('#metric-tqqq').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));const top=(await page.locator('#metric-tqqq').boundingBox()).y;
  await page.locator('#metric-tqqq [data-fund-period="1d"]').evaluate(el=>el.click());
  assert.equal(await page.locator('#stock-alert-list a[href="#metric-tqqq"]').count(),0);assert.equal(await page.locator('#stock-alert-list a[href="#metric-soxl"]').count(),1);
  assert.equal(Number((await page.locator('#stock-alert-title').innerText()).match(/(\d+)銘柄/)[1]),count-1);assert.ok(Math.abs((await page.locator('#metric-tqqq').boundingBox()).y-top)<2,'range switch preserves ETF position');
  assert.equal(await page.locator('#metric-soxl [data-fund-period="6m"]').getAttribute('aria-pressed'),'true');
  await page.locator('#metric-tqqq [data-fund-period="6m"]').evaluate(el=>el.click());await page.locator('#stock-alert-list a[href="#metric-tqqq"]').click();
  await page.waitForFunction(()=>Math.abs(document.getElementById('metric-tqqq').getBoundingClientRect().top-20)<3);
  for(const id of ['tqqq','soxl']){await page.locator('#metric-'+id).scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:'screenshots/navigation-us-etf-'+engine+'-'+width+'-'+id+'.png'});}
  await page.goto(base+'nasdaq-rsi.html');await page.locator('#price-soxl .indicator-panel-link').waitFor();
  for(const id of ['tqqq','soxl'])assert.equal(await page.locator('#price-'+id+' .indicator-panel-link').getAttribute('href'),'./stocks-reference.html#metric-'+id);
  assert.equal(await page.locator('#price-ndx .indicator-panel-link').getAttribute('href'),'./funds.html#metric-nasdaq');
  for(const [path,id]of [['funds.html','tqqq'],['','soxl']]){await page.goto(base+path+'#metric-'+id);await page.waitForURL('**/stocks-reference.html#metric-'+id);await page.waitForFunction(id=>{const e=document.getElementById('metric-'+id);return !!e&&Math.abs(e.getBoundingClientRect().top-20)<3;},id);}
  fail=true;await page.goto(base+'?etf-failure=1');await page.waitForFunction(()=>document.querySelector('#page-ready-alert')?.dataset.state==='error'&&document.querySelector('#page-ready-alert')?.dataset.phase==='complete');
  const fault=await page.evaluate(()=>window.__morningHealthState.issues.filter(i=>/TQQQ/.test(i.label)));assert.ok(fault.length&&fault.every(i=>i.page==='stocks'&&i.href.endsWith('stocks-reference.html#metric-tqqq')));
  assert.equal(await page.locator('.ready-page[data-page="funds"]').getAttribute('data-health'),'ok');assert.equal(await page.locator('.ready-page[data-page="stocks"]').getAttribute('data-health'),'error');
  assert.deepEqual(errors,[]);await context.close();console.log('ETF_ORDER_RANGES_ALERT_OWNERSHIP_LEGACY_AND_RSI_LINKS_OK',engine,width);
 }
}finally{await browser.close();}
