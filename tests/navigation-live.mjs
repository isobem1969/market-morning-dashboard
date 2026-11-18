import {chromium,webkit} from 'playwright';
import {PNG} from 'pngjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const engine=process.env.BROWSER||'chromium',browser=await(engine==='webkit'?webkit:chromium).launch();
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const base=process.env.TEST_BASE_URL||'https://isobem1969.github.io/market-morning-dashboard/';
const watchdog=setTimeout(()=>{console.error('Navigation test exceeded four minutes');process.exit(1);},240000);watchdog.unref();
await fs.mkdir('screenshots',{recursive:true});
async function navigate(path,selector){
 const start=Date.now();
 await page.goto(base+path,{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator(selector).first().waitFor({timeout:30000});
 assert.equal(await page.evaluate(()=>window===top),true);
 assert.equal(await page.locator('main').isVisible(),true);
 assert.equal(await page.locator('iframe[data-morning-page]').evaluateAll(frames=>frames.some(f=>getComputedStyle(f).visibility!=='hidden')),false,'Prepared frames must never cover the page');
 console.log('REAL_DOCUMENT_VISIBLE',engine,path||'indicators',Date.now()-start);
}
async function inspectPaint(selector,label){
 if(await page.locator('#page-ready-alert').count())await page.waitForFunction(()=>document.querySelector('#page-ready-alert')?.dataset.phase==='complete',null,{timeout:60000});
 const card=page.locator(selector).first();
 await card.evaluate(e=>window.scrollTo({top:e.getBoundingClientRect().top+scrollY-20,behavior:'instant'}));
 await page.waitForFunction(selector=>{
  const e=document.querySelector(selector),r=e?.getBoundingClientRect();
  return r&&r.top>=-1&&r.top<80;
 },selector);
 const box=await card.boundingBox();
 const shot=await page.screenshot({path:'screenshots/navigation-native-'+engine+'-'+label+'.png'});
 const png=PNG.sync.read(shot);
 const region={left:Math.ceil(box.x+12),right:Math.floor(Math.min(png.width,box.x+box.width-12)),top:Math.max(25,Math.ceil(box.y+10)),bottom:Math.floor(Math.min(png.height-30,box.y+box.height-10))};
 let painted=0,total=0;
 for(let y=region.top;y<region.bottom;y+=6)for(let x=region.left;x<region.right;x+=6){
  const i=(y*png.width+x)*4,d=Math.abs(png.data[i]-245)+Math.abs(png.data[i+1]-244)+Math.abs(png.data[i+2]-239);
  total++;if(d>12)painted++;
 }
 assert.ok(total>100&&painted/total>.5,'Panel is blank or clipped: '+label+' painted='+(painted/total));
 const hit=await card.evaluate(e=>{
  const r=e.getBoundingClientRect(),x=Math.min(innerWidth-30,r.right-20),y=Math.min(innerHeight-40,r.bottom-20);
  return e.contains(document.elementFromPoint(x,y));
 });
 assert.ok(hit,'Panel is covered: '+label);
 console.log('SCROLLED_PANEL_PAINTED',engine,label,painted/total);
}
async function scrollControls(label){
 const down=page.locator('#go-to-bottom'),up=page.locator('#back-to-top');
 if(await down.isEnabled())await down.click();
 await page.waitForFunction(()=>Math.abs(Math.max(document.documentElement.scrollHeight,document.body.scrollHeight)-innerHeight-scrollY)<4&&document.getElementById('go-to-bottom').disabled,null,{timeout:10000});
 assert.equal(await down.isDisabled(),true,'Bottom control '+label);
 if(await up.isEnabled())await up.click();
 await page.waitForFunction(()=>scrollY<=1&&document.getElementById('back-to-top').disabled,null,{timeout:10000});
 assert.equal(await up.isDisabled(),true,'Top control '+label);
 console.log('SCROLL_CONTROLS_OK',engine,label);
}
try{
 if(!process.env.TEST_BASE_URL)for(let attempt=0;attempt<110;attempt++){
  const response=await fetch(base+'sw.js?t='+Date.now());
  if((await response.text()).includes('six-pages-20261119-v1'))break;
  if(attempt===109)throw Error('Release not deployed');
  await new Promise(r=>setTimeout(r,3000));
 }
 await navigate('','#cards>.card');
 await page.waitForFunction(()=>document.querySelector('#page-ready-alert')?.dataset.phase==='complete',null,{timeout:60000});
 // A completed page must render its saved snapshot even while the next data request is held.
 await page.route('**/data/stocks.json*',route=>route.abort());
 const navigationStarted=Date.now();
 console.log('OPENING_PREPARED_STOCKS',engine);
 await page.locator('.ready-page[data-page="stocks"] a').click();
 await page.waitForURL('**/stocks-reference.html',{waitUntil:'domcontentloaded'});
 await page.locator('.stock-tile').first().waitFor({timeout:30000});
 assert.equal(await page.evaluate(()=>window===top&&location.pathname.endsWith('/stocks-reference.html')),true);
 assert.equal(await page.locator('.stock-tile').count(),13);
 console.log('SAVED_CONTENT_WITH_NETWORK_UNAVAILABLE',engine,Date.now()-navigationStarted);
 await page.unroute('**/data/stocks.json*');
 const alerts=page.locator('#stock-alert-list a'),count=await alerts.count();
 for(let i=0;i<count;i++){
  const href=await alerts.nth(i).getAttribute('href');await alerts.nth(i).click();
  await page.waitForFunction(id=>Math.abs(document.querySelector(id)?.getBoundingClientRect().top-16)<4,href);
 }
 console.log('ALERT_PANEL_LINKS_OK',engine,count);
 await scrollControls('stocks');
 for(const [path,selector,label]of [['heatmap.html','.tile','heatmap'],['nasdaq-rsi.html','#rsi-chart svg','rsi'],['','#cards>.card','indicators']]){
  console.log('OPENING_NATIVE_PAGE',engine,label);
  await page.locator('.morning-pages a[href="./'+path+'"]').click();
  await page.waitForURL(base+path,{waitUntil:'domcontentloaded'});
  await page.locator(selector).first().waitFor({timeout:30000});
  assert.equal(await page.evaluate(()=>window===top),true);
  await scrollControls(label);
 }
 for(const viewport of [{width:1440,height:1000},{width:744,height:1133},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  await navigate('','.vi-card');
  await inspectPaint('.vi-card','vi-'+viewport.width);
  await navigate('funds.html','.fund-card');
  await inspectPaint('[data-fund="soxl"]','soxl-'+viewport.width);
 }
 for(const [fund,target]of [['nasdaq','ndx'],['tqqq','tqqq'],['soxl','soxl']]){
  const link=page.locator('[data-fund="'+fund+'"] .fund-rsi-link');assert.equal(await link.getAttribute('href'),'./nasdaq-rsi.html#price-'+target);
  await link.click();await page.waitForURL('**/nasdaq-rsi.html#price-'+target,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(id=>{const e=document.getElementById(id),r=e?.querySelector('h2')?.getBoundingClientRect();return r&&r.top>=0&&r.bottom<=innerHeight;},'price-'+target);
  await page.goBack({waitUntil:'domcontentloaded'});await page.locator('[data-fund="'+fund+'"]').waitFor();
  await inspectPaint('.fund-card','after-back-'+fund);
 }
 // Returning from a bottom scrolled page must not leave the root page clipped.
 await page.locator('.morning-pages a[href="./stocks-reference.html"]').click();
 await page.waitForURL('**/stocks-reference.html',{waitUntil:'domcontentloaded'});await page.locator('.stock-tile').first().waitFor();
 await scrollControls('stocks-repeat');
 await page.locator('.morning-pages a[href="./"]').click();
 await page.waitForURL(base,{waitUntil:'domcontentloaded'});await page.locator('.vi-card').waitFor();
 await inspectPaint('.vi-card','returned-from-stocks');
 const failedContext=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),failedPage=await failedContext.newPage();
 await failedPage.route('**/data/stocks.json*',route=>route.abort());
 await failedPage.goto(base,{waitUntil:'domcontentloaded'});
 await failedPage.waitForFunction(()=>document.querySelector('#page-ready-alert')?.dataset.phase==='failed',null,{timeout:30000});
 await failedContext.close();

 // Verify the actual installed release cache separately from the offline-data case.
 const warmContext=await browser.newContext({viewport:{width:1440,height:1000}}),warmPage=await warmContext.newPage();
 await warmPage.goto(base,{waitUntil:'domcontentloaded'});
 await warmPage.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:45000});
 await warmPage.waitForFunction(()=>document.querySelector('#page-ready-alert')?.dataset.phase==='complete',null,{timeout:60000});
 const warmStart=Date.now();
 await warmPage.locator('.ready-page[data-page="stocks"] a').click();
 await warmPage.waitForURL('**/stocks-reference.html',{waitUntil:'domcontentloaded'});
 await warmPage.locator('.stock-tile').first().waitFor({timeout:30000});
 const warmMs=Date.now()-warmStart;
 console.log('INSTALLED_RELEASE_CACHE_NAVIGATION_MS',engine,warmMs);
 assert.ok(warmMs<5000,'Prepared page was delayed despite the installed release cache: '+warmMs);
 await warmPage.screenshot({path:'screenshots/navigation-native-'+engine+'-cached-stocks.png'});
 await warmContext.close();
 assert.deepEqual(errors,[]);console.log('NATIVE_NAVIGATION_SCROLL_PAINT_AND_FAILURE_OK',engine);
}finally{
 console.log('FINAL_NATIVE_PAGE_ERRORS',engine,errors);
 await page.screenshot({path:'screenshots/navigation-native-'+engine+'-final.png'}).catch(()=>{});
 clearTimeout(watchdog);await context.close();await browser.close();
}
