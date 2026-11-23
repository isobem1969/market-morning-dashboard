import {chromium,webkit} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {FUND_IDS} from '../public/asset-pages.js';
import {fundPoints,FUND_PERIODS} from '../public/fund-panel.js';
const ids=FUND_IDS.slice(-2),engine=process.env.BROWSER||'chromium',base=process.env.TEST_BASE_URL||'http://127.0.0.1:8773/';
const original={};
for(const name of ['market','stocks','japan-stocks','fund-drawdowns','nasdaq-rsi','heatmap','health-calendar'])original[name]=JSON.parse(await fs.readFile('public/data/'+name+'.json','utf8'));
const browser=await(engine==='webkit'?webkit:chromium).launch();
await fs.mkdir('screenshots',{recursive:true});
try{
 for(const width of [1440,744,1133,390,320]){
  const files=structuredClone(original),stamp=new Date().toISOString();files.market.generatedAt=stamp;
  for(const m of files.market.metrics)m.lastSuccess=stamp;
  for(const d of Object.values(files['fund-drawdowns']))d.lastSuccess=stamp;
  const context=await browser.newContext({viewport:{width,height:width===1133?744:1133},isMobile:width<1200,hasTouch:width<1200,serviceWorkers:'block'}),page=await context.newPage();let fail=false;
  await page.route('**/data/*.json*',async route=>{
   const key=new URL(route.request().url()).pathname.split('/').at(-1).replace('.json','');if(!files[key])return route.continue();
   const data=structuredClone(files[key]);
   if(fail&&key==='market'){const m=data.metrics.find(m=>m.id===ids[1]);m.status='error';m.error='Both public NAV sources unavailable: 403';}
   if(fail&&key==='fund-drawdowns')data[ids[1]].error='Both public NAV sources unavailable: 403';
   return route.fulfill({json:data});
  });
  await page.goto(base+'funds.html',{waitUntil:'domcontentloaded'});
  await page.locator('#metric-'+ids[1]+' .fund-chart').waitFor();
  await page.waitForFunction(()=>!!window.__morningHealthState?.checkedAt);
  assert.deepEqual(await page.locator('#cards>.fund-card').evaluateAll(a=>a.map(e=>e.dataset.fund)),FUND_IDS);
  assert.equal(await page.locator('#cards [data-fund=tqqq],#cards [data-fund=soxl]').count(),0);
  for(const id of ids){
   const m=files.market.metrics.find(m=>m.id===id),card=page.locator('#metric-'+id);
   const issues=await page.evaluate(id=>window.__morningHealthState.issues.filter(i=>i.href.endsWith('#metric-'+id)),id);assert.deepEqual(issues,[]);
   assert.ok((await card.locator('.fund-price').innerText()).includes(m.value.toLocaleString('ja-JP')));
   assert.ok((await card.locator('.fund-chart-footer').innerText()).includes(m.asOf.replaceAll('-','/')));
   assert.equal(await card.locator('.drawdown-chart').count(),1);
   for(const [period]of FUND_PERIODS){
    await card.locator('[data-fund-period="'+period+'"]').evaluate(el=>el.click());
    const points=fundPoints(m.history,period),ratio=m.value/Math.max(...points.map(p=>p.value))*100,hit=ratio<80;
    assert.equal(await card.locator('.fund-high-percent').innerText(),ratio.toFixed(1)+'%');
    assert.equal(await card.evaluate(el=>el.classList.contains('peak-alert-active')),hit);
    assert.equal(await page.locator('#funds-overview a[href="#metric-'+id+'"]').count(),hit?1:0);
   }
   await card.locator('[data-fund-period="6m"]').evaluate(el=>el.click());
   assert.equal(await card.locator('.fund-chart').count(),1);
   await card.scrollIntoViewIfNeeded();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'page overflow '+width+' '+id);
   await page.screenshot({path:`screenshots/au-funds-${engine}-${width}-${id}.png`});
  }
  const triple=page.locator('#metric-'+ids[1]);
  assert.match(await triple.locator('.drawdown-panel').innerText(),/2026-10-15〜2026-11-20/);
  assert.equal(await triple.locator('[data-ma="75"]').getAttribute('d'),'');
  await page.locator('#funds-overview a[href="#metric-'+ids[1]+'"]').click();
  await page.waitForFunction(id=>Math.abs(document.getElementById('metric-'+id).getBoundingClientRect().top-20)<3,ids[1]);
  fail=true;await page.goto(base+'funds.html?failure=1');
  await page.waitForFunction(id=>window.__morningHealthState?.issues.filter(i=>i.href.endsWith('#metric-'+id)).length===2,ids[1]);
  const fault=await page.evaluate(id=>window.__morningHealthState.issues.filter(i=>i.href.endsWith('#metric-'+id)),ids[1]);
  assert.ok(fault.every(i=>i.page==='funds'));
  assert.equal(await page.locator('#data-health-alert').getAttribute('data-state'),'error');
  assert.match(await page.locator('#funds-overview .funds-pending').innerText(),/auAMトリプル/);
  assert.equal(await page.locator('#funds-overview>.funds-alert-list a[href="#metric-'+ids[1]+'"]').count(),0);
  assert.match(await page.locator('#metric-'+ids[1]).innerText(),/保存値の判定/);
  await context.close();console.log('AU_FUNDS_ORDER_SIX_RANGES_ALERTS_CURRENT_NAV_FAILURE_AND_LAYOUT_OK',engine,width);
 }
}finally{await browser.close();}
