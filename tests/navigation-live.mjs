import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await (process.env.BROWSER==='webkit'?webkit:chromium).launch();
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
page.on('crash',()=>errors.push('renderer crashed'));
const base='https://isobem1969.github.io/market-morning-dashboard/';
await fs.mkdir('screenshots',{recursive:true});
try {
 for(let attempt=0;attempt<90;attempt++){const response=await fetch(base+'sw.js?t='+Date.now());if((await response.text()).includes('shell-fresh-soxl-20261114'))break;await new Promise(r=>setTimeout(r,3000));}
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>document.querySelector('#page-preload-status')?.textContent==='米国株：準備完了 ／ ヒートマップ：準備完了 ／ NASDAQ100・RSI：準備完了',null,{timeout:30000});
 await page.waitForFunction(()=>document.querySelector('#page-ready-alert')?.dataset.state==='ready',null,{timeout:30000});
 assert.equal(await page.locator('#ready-alert-title').textContent(),'全4ページの準備ができました');
 await page.screenshot({path:'screenshots/navigation-ready-alert.png'});
 const soxl=page.locator('.fund-card[data-fund="soxl"]');
 assert.equal(await soxl.count(),1);
 assert.equal(await page.locator('.fund-card[data-fund="tqqq"]').evaluate(e=>e.nextElementSibling?.dataset.fund),'soxl');
 await soxl.locator('.drawdown-chart').waitFor({timeout:15000});
 assert.equal(await soxl.locator('.drawdown-chart').count(),1);
 assert.equal(await soxl.locator('[data-ma]').count(),2);
 assert.equal(await soxl.locator('[data-fund-minkabu="soxl"]').getAttribute('href'),'https://us.minkabu.jp/stocks/SOXL');
 await soxl.locator('[data-fund-period="1y"]').click();
 assert.equal(await soxl.locator('[data-fund-high-period="1y"]').count(),1);
 const soxlWidth=await soxl.evaluate(e=>({right:e.getBoundingClientRect().right,width:innerWidth}));
 assert.ok(soxlWidth.right<=soxlWidth.width+1,'SOXL indicator panel overflows phone width');
 await soxl.screenshot({path:'screenshots/navigation-soxl-indicator.png'});
 console.log('SOXL_INDICATOR_REAL_CHART_DRAWDOWN_ORDER_VERIFIED');
 console.log('READY_ALERT_GREEN_VERIFIED' ,process.env.BROWSER||'chromium');
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:15000});
 console.log('PREFETCH_READY',await page.locator('#page-preload-status').textContent());
 // Hold subsequent data requests. Prefetched data must render before these finish.
 await page.route('**/data/stocks.json*',async route=>{await new Promise(r=>setTimeout(r,8000));await route.continue().catch(()=>{});});
 await page.route('**/data/heatmap.json*',async route=>{await new Promise(r=>setTimeout(r,8000));await route.continue().catch(()=>{});});
 let started=Date.now();
 await page.locator('.morning-pages a[href="./stocks-reference.html"]').click();
 await page.waitForFunction(()=>{const f=document.querySelector('iframe[data-morning-page="stocks"]');return f?.style.visibility==='visible'&&f.contentDocument.querySelectorAll('.stock-tile').length===13;},null,{timeout:15000});
 const stockMs=Date.now()-started;
 console.log('STOCKS_DISPLAYED',13,'NAVIGATION_MS',stockMs,'NETWORK_DELAY_MS',8000);
 await page.screenshot({path:'screenshots/navigation-stocks.png'});
 assert.ok(stockMs<1500,'Stock rendering waited for the delayed network request');

 // Alert summaries must scroll inside the prepared stocks frame.
 const stockFrame=page.frameLocator('iframe[data-morning-page="stocks"]');
 const alertLinks=stockFrame.locator('#stock-alert-list a');
 const alertCount=await alertLinks.count();assert.ok(alertCount>0,'Expected current alert summaries');
 for(let i=0;i<alertCount;i++){
  const href=await alertLinks.nth(i).getAttribute('href');await alertLinks.nth(i).click();
  await page.waitForFunction(id=>{const doc=document.querySelector('iframe[data-morning-page="stocks"]').contentDocument;const el=doc.querySelector(id);return el&&Math.abs(el.getBoundingClientRect().top-16)<3;},href);
 }
 assert.equal(await stockFrame.locator('header .subtitle').count(),0);
 console.log('ALL_ALERT_SUMMARY_PANEL_JUMPS_VERIFIED',alertCount);

 started=Date.now();
 await page.frameLocator('iframe[data-morning-page="stocks"]').locator('.morning-pages a[href="./heatmap.html"]').click();
 await page.waitForFunction(()=>document.querySelector('iframe[data-morning-page="heatmap"]')?.style.visibility==='visible',null,{timeout:15000});
 const heatmapMs=Date.now()-started;
 console.log('HEATMAP_DISPLAYED',await page.frameLocator('iframe[data-morning-page="heatmap"]').locator('.tile').count(),'NAVIGATION_MS',heatmapMs,'NETWORK_DELAY_MS',8000);
 await page.screenshot({path:'screenshots/navigation-heatmap.png'});
 assert.ok(heatmapMs<1500,'Heatmap rendering waited for the delayed network request');
 started=Date.now();
 await page.frameLocator('iframe[data-morning-page="heatmap"]').locator('.morning-pages a[href="./nasdaq-rsi.html"]').click();
 await page.waitForFunction(()=>document.querySelector('iframe[data-morning-page="rsi"]')?.style.visibility==='visible',null,{timeout:15000});
 const rsiMs=Date.now()-started;
 const rsi=page.frameLocator('iframe[data-morning-page="rsi"]');
 assert.equal(await rsi.locator('.rsi-ready').count(),1);
 assert.equal(await rsi.locator('.price-grid>.panel').count(),3);
 assert.equal(await rsi.locator('.price-grid a[href="https://finance.yahoo.com/quote/SOXL/"]').count(),1);
 assert.equal(await rsi.locator('.morning-pages a').count(),4);
 assert.ok(rsiMs<1500,'RSI navigation waited for network');
 await rsi.getByRole('button',{name:'5年',exact:true}).click();
 assert.equal(await rsi.getByRole('button',{name:'5年',exact:true}).getAttribute('aria-pressed'),'true');
 const overflows=await rsi.locator('body').evaluate(el=>el.scrollWidth>innerWidth+1);
 if(overflows){console.log('OVERFLOW_ELEMENTS',await rsi.locator('body').evaluate(()=>[...document.querySelectorAll('body *')].map(e=>({tag:e.tagName,cls:e.className,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width,text:e.textContent.slice(0,60)})).filter(e=>e.right>innerWidth+1||e.left< -1).slice(0,25)));await page.screenshot({path:'screenshots/navigation-rsi-overflow.png'});}
 assert.equal(overflows,false,'RSI page overflows phone viewport');
 console.log('RSI_REAL_DATA_VERIFIED_NAVIGATION_MS',rsiMs);
 await page.screenshot({path:'screenshots/navigation-rsi-mobile.png'});
 await page.setViewportSize({width:1440,height:1000});
 await page.screenshot({path:'screenshots/navigation-rsi-desktop.png'});

 // Verify the bottom-left blue button beside the original orange reference.
 await rsi.locator('.morning-pages a[href="./"]').click();
 assert.equal(await page.locator('header .subtitle').count(),0);
 assert.equal(await page.getByRole('heading',{name:'14の指標',exact:true}).count(),0);
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  const row=page.locator('[data-fund="soxl"] .fund-reference-row');
  await row.scrollIntoViewIfNeeded();
  const blue=row.locator('.fund-rsi-link'),orange=row.locator('[data-fund-minkabu="soxl"]');
  await blue.waitFor({state:'visible'});await orange.waitFor({state:'visible'});
  const b=await blue.boundingBox(),o=await orange.boundingBox();
  assert.ok(Math.abs(b.y-o.y)<2,'Buttons must share the same top edge');
  assert.ok(Math.abs(b.height-o.height)<2,'Buttons must have the same height');
  assert.ok(b.x+b.width<o.x,'Blue button must be left of the orange button');
  assert.ok(b.x>=0&&o.x+o.width<=viewport.width,'Both buttons must fit the viewport');
  assert.notEqual(await blue.evaluate(e=>getComputedStyle(e).backgroundColor),await orange.evaluate(e=>getComputedStyle(e).backgroundColor));
  await row.screenshot({path:'screenshots/navigation-soxl-buttons-'+viewport.width+'.png'});
 }
 await page.locator('[data-fund="soxl"] .fund-rsi-link').click();
 await page.waitForURL('**/nasdaq-rsi.html#price-soxl');
 await page.waitForFunction(()=>{const el=document.querySelector('#price-soxl');if(!el)return false;const r=el.querySelector('h2').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;});
 await page.screenshot({path:'screenshots/navigation-soxl-rsi-destination.png'});
 console.log('SOXL_BLUE_BUTTON_VISIBLE_ALIGNED_AND_DESTINATION_VERIFIED');
 // A stale saved script must never override an available network response.
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await page.evaluate(async()=>{
  await navigator.serviceWorker.ready;
  const name=(await caches.keys()).find(k=>k.startsWith('market-morning-')&&k!=='market-morning-snapshots-v1');
  const cache=await caches.open(name);
  await cache.put(new URL('./fund-panel.js',location.href).href,new Response('STALE_TEST_SCRIPT',{headers:{'Content-Type':'text/javascript'}}));
 });
 const moduleText=await page.evaluate(async()=>await (await fetch('./fund-panel.js')).text());
 assert.ok(moduleText.includes('fund-rsi-link'),'Fresh module must override stale saved module');
 console.log('STALE_SHELL_RECOVERY_VERIFIED');

 assert.deepEqual(errors,[]);
 console.log('NAVIGATION_VERIFIED_NO_PAGE_ERRORS');
 const failureContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true});
 const failurePage=await failureContext.newPage();
 await failurePage.route('**/data/stocks.json*',route=>route.abort());
 await failurePage.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
 await failurePage.waitForFunction(()=>document.querySelector('#page-ready-alert')?.dataset.state==='partial',null,{timeout:30000});
 assert.equal(await failurePage.locator('#ready-alert-title').textContent(),'一部のページが未完了です');
 await failurePage.screenshot({path:'screenshots/navigation-partial-alert.png'});
 console.log('READY_ALERT_FETCH_FAILURE_VERIFIED');
 await failureContext.close();
 const rsiFailureContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true});
 const rsiFailurePage=await rsiFailureContext.newPage();
 await rsiFailurePage.route('**/data/nasdaq-rsi.json*',route=>route.abort());
 await rsiFailurePage.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
 await rsiFailurePage.waitForFunction(()=>document.querySelector('#page-ready-alert')?.dataset.state==='partial',null,{timeout:30000});
 assert.ok((await rsiFailurePage.locator('#ready-alert-pages').textContent()).includes('! NASDAQ100・RSI'));
 console.log('RSI_FAILURE_FOUR_PAGE_BANNER_VERIFIED');
 await rsiFailureContext.close();
} finally {await browser.close();}


