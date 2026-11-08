import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
page.on('crash',()=>errors.push('renderer crashed'));
const base='https://isobem1969.github.io/market-morning-dashboard/';
await fs.mkdir('screenshots',{recursive:true});
try {
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>document.querySelector('#page-preload-status')?.textContent==='米国株：準備完了 ／ ヒートマップ：準備完了',null,{timeout:30000});
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:15000});
 console.log('PREFETCH_READY',await page.locator('#page-preload-status').textContent());
 // Hold subsequent data requests. Prefetched data must render before these finish.
 await page.route('**/data/stocks.json*',async route=>{await new Promise(r=>setTimeout(r,8000));await route.continue().catch(()=>{});});
 await page.route('**/data/heatmap.json*',async route=>{await new Promise(r=>setTimeout(r,8000));await route.continue().catch(()=>{});});
 let started=Date.now();
 await page.locator('.morning-pages a[href="./stocks-reference.html"]').click();
 await page.waitForFunction(()=>document.querySelectorAll('.stock-tile').length===13,null,{timeout:15000});
 const stockMs=Date.now()-started;
 console.log('STOCKS_DISPLAYED',13,'NAVIGATION_MS',stockMs,'NETWORK_DELAY_MS',8000);
 await page.screenshot({path:'screenshots/navigation-stocks.png'});
 assert.ok(stockMs<8000,'Stock rendering waited for the delayed network request');
 started=Date.now();
 await page.locator('.morning-pages a[href="./heatmap.html"]').click();
 await page.waitForFunction(()=>document.querySelectorAll('.tile').length>0&&!document.querySelector('.tile .move')?.textContent.includes('未取得'),null,{timeout:15000});
 const heatmapMs=Date.now()-started;
 console.log('HEATMAP_DISPLAYED',await page.locator('.tile').count(),'NAVIGATION_MS',heatmapMs,'NETWORK_DELAY_MS',8000);
 await page.screenshot({path:'screenshots/navigation-heatmap.png'});
 assert.ok(heatmapMs<8000,'Heatmap rendering waited for the delayed network request');
 assert.deepEqual(errors,[]);
 console.log('NAVIGATION_VERIFIED_NO_PAGE_ERRORS');
} finally {await browser.close();}
