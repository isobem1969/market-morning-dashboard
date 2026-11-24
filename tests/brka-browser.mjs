import {chromium,webkit} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const engine=process.env.BROWSER||'chromium',base=process.env.TEST_BASE_URL||'http://127.0.0.1:8773/';
const original=JSON.parse(await fs.readFile('public/data/stocks.json','utf8')),brka=original.stocks.find(s=>s.symbol==='BRK-A');
assert.equal(brka.displaySymbol,'BRK.A');assert.ok(brka.price.value>100000);
const browser=await(engine==='webkit'?webkit:chromium).launch();await fs.mkdir('screenshots',{recursive:true});
try{
 for(const width of [1440,1133,744,390,320]){
  const context=await browser.newContext({viewport:{width,height:1133},serviceWorkers:'block'}),page=await context.newPage();let synthetic=false,failed=false;
  await context.route('https://us.minkabu.jp/stocks/BRK-A/researches*',route=>route.fulfill({contentType:'text/html',body:'<title>Class A reference navigation fixture</title>'}));
  await page.route('**/data/stocks.json*',route=>{
   const data=structuredClone(original);
   if(synthetic){const s=data.stocks.find(s=>s.symbol==='BRK-A'),last=s.price.daily.at(-1).time;Object.assign(s.price,{value:60,lastSuccess:new Date().toISOString(),status:failed?'error':'ok',error:failed?'Source unavailable':null,daily:[{time:last-100*86400,value:100,high:100},{time:last,value:60,high:60}],intraday:[{time:last,value:60,high:60}]});data.generatedAt=new Date().toISOString();}
   return route.fulfill({json:data});
  });
  await page.goto(base+'stocks-reference.html');const card=page.locator('#stock-BRK-A');await card.waitFor();await page.waitForFunction(()=>!!window.__morningHealthState?.checkedAt);
  const symbols=await page.locator('#stocks>.stock-tile').evaluateAll(a=>a.map(e=>e.dataset.symbol));assert.equal(symbols.length,14);assert.deepEqual(symbols.slice(-2),['ABBV','BRK-A']);assert.ok(!symbols.includes('BRK-B'));
  assert.equal(await card.locator('h2').innerText(),'バークシャー・ハサウェイA');assert.match(await card.locator('.ticker').innerText(),/BRK\.A · NYSE/);
  assert.equal(await card.locator('.current-value').innerText(),brka.price.value.toLocaleString('ja-JP',{minimumFractionDigits:2,maximumFractionDigits:2}));
  assert.equal(await card.locator('.tile-links a').getAttribute('href'),'https://finance.yahoo.co.jp/quote/BRK-A');assert.equal(await card.locator('.ratios>div').count(),2);assert.equal(await card.locator('.analyst-panel').count(),1);assert.equal(await card.locator('.stock-highs .stock-high').count(),2);
  for(const period of ['1d','1w','1m','6m','1y','2y']){
   await card.locator('button[data-period="'+period+'"]').evaluate(el=>el.click());
   assert.equal(await card.locator('button[data-period="'+period+'"]').getAttribute('aria-pressed'),'true');assert.equal(await card.locator('svg[data-chart="BRK-A"]').count(),1);
   const hit=await card.locator('.stock-high[data-high-kind="period"] .high-condition').evaluate(el=>el.classList.contains('is-hit'));
   assert.equal(await page.locator('#stock-alert-list a[href="#stock-BRK-A"]').count(),hit?1:0);
  }
  await card.scrollIntoViewIfNeeded();await page.evaluate(()=>new Promise(requestAnimationFrame));
  const display=await card.locator('.current-value').evaluate(el=>({font:parseFloat(getComputedStyle(el).fontSize),width:el.getBoundingClientRect().width}));console.log('BRKA_PRICE_LAYOUT',engine,width,display);
  assert.ok(display.font>=18,'Class A quote shrank too small '+width+' '+JSON.stringify(display));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Class A page overflow '+width);
  const next=await page.evaluate(()=>document.getElementById('stocks').getBoundingClientRect().bottom<=document.getElementById('us-etfs').getBoundingClientRect().top);assert.ok(next,'ETFs remain after Class A');
  await page.screenshot({path:`screenshots/brka-${engine}-${width}.png`});
  const popupPromise=page.waitForEvent('popup');await card.locator('[data-minkabu="BRK-A"]').click();const popup=await popupPromise;await popup.waitForURL('**/stocks/BRK-A/researches*');await popup.close();
  synthetic=true;await page.goto(base+'stocks-reference.html?condition-test=1');await page.locator('#stock-alert-list a[href="#stock-BRK-A"]').waitFor();
  await card.locator('button[data-period="1d"]').evaluate(el=>el.click());assert.equal(await page.locator('#stock-alert-list a[href="#stock-BRK-A"]').count(),0);
  await card.locator('button[data-period="6m"]').evaluate(el=>el.click());assert.equal(await page.locator('#stock-alert-list a[href="#stock-BRK-A"]').count(),1);
  failed=true;await page.goto(base+'stocks-reference.html?condition-test=2');await page.waitForFunction(()=>document.querySelector('#stock-alert-list a[href="#stock-BRK-A"]')?.dataset.reference==='true');
  assert.match(await page.locator('#stock-alert-list a[href="#stock-BRK-A"]').innerText(),/保存値/);
  await context.close();console.log('BRKA_AFTER_ABBV_SAME_PANELS_PERIODS_ALERTS_AND_REFERENCE_OK',engine,width);
 }
}finally{await browser.close();}
