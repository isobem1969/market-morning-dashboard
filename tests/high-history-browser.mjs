import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {historyComparison} from '../public/high-history.js';
const engine=process.env.BROWSER||'chromium',base=process.env.TEST_BASE_URL||'http://127.0.0.1:8773/';
const browser=await(engine==='webkit'?webkit:chromium).launch();
await fs.mkdir('screenshots',{recursive:true});
try{
 for(const width of [1440,744,390,320]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#ready-alert-health .health-issues')?.open);
  assert.equal(await page.locator('#ready-alert-health .health-issues>ul').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
  await page.screenshot({path:'screenshots/navigation-history-'+engine+'-'+width+'-expanded-white-alert.png'});
  for(const [file,path]of [['stocks','stocks-reference.html'],['japan-stocks','japan-stocks.html']]){
   const snapshot=JSON.parse(await fs.readFile('public/data/'+file+'.json','utf8'));
   await page.goto(base+path,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__morningHealthState?.issues.some(i=>i.history));
   assert.equal(await page.locator('#data-health-alert .health-issues').evaluate(el=>el.open),true);
   assert.equal(await page.locator('#data-health-alert .health-issues>ul').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
   for(const s of snapshot.stocks.filter(s=>s.highs.allTime.complete!==true)){
    const h=historyComparison(s),card=page.locator('[data-symbol="'+s.symbol+'"].stock-tile [data-high-kind="allTime"]');
    await card.waitFor();assert.equal(await card.locator('h3').innerText(),'取得期間内最高値');
    assert.match(await card.locator('.high-history-coverage').innerText(),new RegExp(h.start+'〜'+h.end));
    assert.equal(await card.locator('.high-percent').innerText(),h.ratio.toFixed(1)+'%');
    assert.match(await card.locator('.high-drop').innerText(),new RegExp(Math.abs(h.drop).toFixed(2).replace('.','\\.')));
    assert.ok((await page.locator('#data-health-alert').innerText()).includes(h.start));
    await card.scrollIntoViewIfNeeded();
    assert.equal(await card.evaluate(el=>el.scrollWidth>el.clientWidth),false,'history card overflow '+s.symbol+' '+width);
   }
   await page.screenshot({path:'screenshots/navigation-history-'+engine+'-'+width+'-'+file+'.png'});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  }
  assert.deepEqual(errors,[]);await context.close();console.log('SIX_ACQUIRED_HISTORY_RANGES_AND_PERCENTAGES_OK',engine,width);
 }
}finally{await browser.close();}
