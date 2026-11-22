import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {historyComparison} from '../public/high-history.js';
const engine=process.env.BROWSER||'chromium',base=process.env.TEST_BASE_URL||'http://127.0.0.1:8773/';
const browser=await(engine==='webkit'?webkit:chromium).launch();
await fs.mkdir('screenshots',{recursive:true});
try{
 for(const width of [1440,744,390,320]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>{console.log('HISTORY_BROWSER_ERROR',engine,width,e.stack||e.message);errors.push(e.message);});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__morningHealthState?.kind==='ready');
  await page.waitForFunction(()=>document.querySelector('#page-ready-alert')?.dataset.phase==='complete');
  assert.equal(await page.locator('#page-ready-alert').getAttribute('data-state'),'ready');
  assert.equal(await page.locator('#ready-alert-health .health-issues').count(),0);
  await page.screenshot({path:'screenshots/navigation-history-'+engine+'-'+width+'-accepted-history.png'});
  for(const [file,path]of [['stocks','stocks-reference.html'],['japan-stocks','japan-stocks.html']]){
   const snapshot=JSON.parse(await fs.readFile('public/data/'+file+'.json','utf8'));
   await page.goto(base+path,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__morningHealthState?.kind==='ready');
   assert.equal(await page.locator('#data-health-alert').getAttribute('data-state'),'ready');
   for(const s of snapshot.stocks.filter(s=>s.highs.allTime.complete!==true)){
    const h=historyComparison(s),card=page.locator('[data-symbol="'+s.symbol+'"].stock-tile [data-high-kind="allTime"]');
    await card.waitFor();assert.equal(await card.locator('h3').innerText(),'取得期間内最高値');
    assert.match(await card.locator('.high-history-coverage').innerText(),new RegExp(h.start+'〜'+h.end));
    assert.equal(await card.locator('.high-percent').innerText(),h.ratio.toFixed(1)+'%');
    assert.match(await card.locator('.high-drop').innerText(),new RegExp(Math.abs(h.drop).toFixed(2).replace('.','\\.')));
    assert.equal(await page.locator('[data-symbol="'+s.symbol+'"].stock-tile').innerText().then(t=>t.includes('全履歴が未確認')),false);
    await card.scrollIntoViewIfNeeded();
    assert.equal(await card.evaluate(el=>el.scrollWidth>el.clientWidth),false,'history card overflow '+s.symbol+' '+width);
   }
   await page.screenshot({path:'screenshots/navigation-history-'+engine+'-'+width+'-'+file+'.png'});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  }
  const missing=JSON.parse(await fs.readFile('public/data/stocks.json','utf8'));
  missing.stocks.find(s=>s.highs.allTime.complete!==true).highs.historyStart=null;
  await page.route('**/data/stocks.json*',route=>route.fulfill({json:missing}));
  await page.goto(base+'?missing-history-start=1');
  await page.waitForFunction(()=>document.querySelector('#page-ready-alert')?.dataset.state==='error');
  assert.equal(await page.locator('#ready-alert-health .health-issues').evaluate(el=>el.open),true);
  assert.equal(await page.locator('#ready-alert-health .health-issues>ul').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
  assert.match(await page.locator('#ready-alert-health').innerText(),/取得済み期間|高値記録日/);
  await page.waitForFunction(()=>document.querySelector('#page-ready-alert')?.dataset.phase==='complete');
  await page.screenshot({path:'screenshots/navigation-history-'+engine+'-'+width+'-missing-range-error.png'});
  assert.deepEqual(errors,[]);await context.close();console.log('SIX_ACQUIRED_HISTORY_RANGES_AND_PERCENTAGES_OK',engine,width);
 }
}finally{await browser.close();}
