import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const engine=process.env.BROWSER||'chromium',base=process.env.TEST_BASE_URL||'http://127.0.0.1:8774/';
const browser=await(engine==='webkit'?webkit:chromium).launch();
const original={};for(const name of ['market','fund-drawdowns','stocks','japan-stocks','heatmap','nasdaq-rsi','health-calendar'])original[name]=JSON.parse(await fs.readFile('public/data/'+name+'.json','utf8'));
await fs.mkdir('screenshots',{recursive:true});
try{
 for(const width of [1440,744,390,320]){
  const files=structuredClone(original),stamp=new Date().toISOString(),day=files.market.metrics[0].history.at(-1).date;
  for(const key of ['stocks','japan-stocks'])for(const s of files[key].stocks){s.highs.allTime.complete=true;for(const kind of ['price','highs','japan','research']){s[kind].lastSuccess=stamp;s[kind].status='ok';s[kind].error=null;}s.japan.asOf=day;for(const ratio of Object.values(s.japan.ratios))ratio.availability=ratio.value===null?'unpublished':'published';}
  for(const m of files.market.metrics){m.lastSuccess=stamp;m.status='ok';m.error=null;if(m.asOf.slice(0,10)<day){m.asOf=day;m.history.at(-1).date=day;}}
  for(const d of Object.values(files['fund-drawdowns'])){d.lastSuccess=stamp;d.error=null;d.asOf=day;d.years[d.currentYear].at(-1).date=day;}
  files['nasdaq-rsi'].generatedAt=stamp;for(const s of files.heatmap.stocks)s.lastSuccess=stamp;
  const sox=files.market.metrics.find(m=>m.id==='sox');sox.value=60;sox.peak=1000;sox.asOf=day;sox.history=[{date:day.slice(0,4)+'-06-01',value:100},{date:day,value:60}];
  sox.sourceAttempts=[{status:'error',error:'403'},{status:'ok'}];
  let fail=false;
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/data/*.json',async route=>{const name=new URL(route.request().url()).pathname.split('/').at(-1).replace('.json','');const data=files[name];if(!data)return route.continue();const value=structuredClone(data);if(fail&&name==='market'){const m=value.metrics.find(m=>m.id==='fang');m.status='error';m.error='All sources failed: 403 Forbidden';m.asOf='2026-10-29';m.lastSuccess='2026-10-30T07:15:00Z';}return route.fulfill({json:value});});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__morningHealthState?.kind==='ready',null,{timeout:30000});
  await page.waitForFunction(()=>document.querySelector('#page-ready-alert')?.dataset.state==='ready',null,{timeout:60000});
  const gap=await page.evaluate(()=>{const overview=document.querySelector('.overview').getBoundingClientRect();const first=[...document.querySelectorAll('#cards>.card')].map(e=>e.getBoundingClientRect()).sort((a,b)=>a.top-b.top)[0];return first.top-overview.bottom;});
  assert.ok(Math.abs(gap-(width<=650?16:22))<1,'uniform overview/card gap '+width+' '+gap);
  await page.screenshot({path:'screenshots/navigation-resilient-'+engine+'-'+width+'-healthy.png'});
  await page.goto(base+'funds.html');await page.waitForFunction(()=>window.__morningHealthState?.kind==='ready');
  await page.locator('#funds-overview a[href="#metric-sox"]').waitFor();assert.equal(await page.locator('#metric-sox').count(),1);
  await page.locator('#metric-sox').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
  const periodTop=(await page.locator('#metric-sox').boundingBox()).y;
  await page.locator('#metric-sox [data-fund-period="1d"]').evaluate(el=>el.click());assert.equal(await page.locator('#funds-overview a[href="#metric-sox"]').count(),0);
  assert.ok(Math.abs((await page.locator('#metric-sox').boundingBox()).y-periodTop)<2,'period update preserves the reading position '+width);
  await page.locator('#metric-sox [data-fund-period="6m"]').evaluate(el=>el.click());await page.locator('#funds-overview a[href="#metric-sox"]').waitFor();
  await page.locator('#funds-overview a[href="#metric-sox"]').click();assert.ok((await page.locator('#metric-sox').boundingBox()).y<80,'fund overview native panel link');
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'screenshots/navigation-resilient-'+engine+'-'+width+'-funds.png'});
  await page.locator('#metric-sox').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
  const readingTop=(await page.locator('#metric-sox').boundingBox()).y;
  fail=true;await page.evaluate(()=>document.querySelector('[data-health-retry]').click());
  await page.waitForFunction(()=>window.__morningHealthState?.kind==='error');
  assert.ok(Math.abs((await page.locator('#metric-sox').boundingBox()).y-readingTop)<2,'alert update preserves the reading position '+width);
  await page.goto(base+'?failure-test=1');
  await page.waitForFunction(()=>document.querySelector('#page-ready-alert')?.dataset.state==='error');
  assert.match(await page.locator('#ready-alert-health').innerText(),/FANG|fang/);
  assert.equal(await page.locator('#page-ready-alert').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 240, 241)');
  assert.equal(await page.locator('#ready-alert-health .health-issues').evaluate(el=>el.open),true);assert.equal(await page.locator('#ready-alert-health .health-issues>ul').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');assert.match(await page.locator('#ready-alert-health').innerText(),/403/);assert.match(await page.locator('#ready-alert-health').innerText(),/2026-10-29/);
  await page.screenshot({path:'screenshots/navigation-resilient-'+engine+'-'+width+'-failure.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'no overflow '+width);
  assert.deepEqual(errors,[]);await context.close();console.log('FAILOVER_HEALTH_ALERT_SPACING_AND_FUND_OVERVIEW_OK',engine,width);
 }
}finally{await browser.close();}
