import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const engine=process.env.BROWSER||'chromium',base=process.env.TEST_BASE_URL||'http://127.0.0.1:8773/';
const browser=await(engine==='webkit'?webkit:chromium).launch();
await fs.mkdir('screenshots',{recursive:true});
const files={};for(const name of ['market','stocks','japan-stocks','heatmap','nasdaq-rsi'])files[name]=JSON.parse(await fs.readFile('public/data/'+name+'.json','utf8'));
const old=new Date(Date.now()-6*3600000).toISOString(),date=old.slice(0,10),time=Date.parse(date+'T14:00:00Z')/1000;
const highs=[60,70,80,100,110,120],offsets=[0,3,20,100,300,500],points=offsets.map((days,i)=>({time:time-days*86400,value:highs[i],high:highs[i]})).reverse(),history=points.map(p=>({date:new Date(p.time*1000).toISOString().slice(0,10),value:p.value}));
for(const name of ['stocks','japan-stocks']){const s=files[name].stocks[0];s.price={...s.price,value:60,lastSuccess:old,status:'ok',daily:points,intraday:points.slice(-2)};s.highs={...s.highs,status:'ok',lastSuccess:old,allTime:{value:1000,date,complete:false}};}
Object.assign(files.market.metrics.find(m=>m.id==='sox'),{value:60,peak:1000,lastSuccess:old,asOf:date,history});
Object.assign(files['nasdaq-rsi'].prices.ndx,{value:60,peak:1000,ratio:6,drawdown:-94,closeHistory:history});
try{for(const width of [1440,744,390,320]){
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/data/*.json',async route=>{const name=new URL(route.request().url()).pathname.split('/').at(-1).replace('.json','');if(files[name])return route.fulfill({json:files[name]});return route.continue();});
 for(const [file,selector]of [['stocks-reference.html','.stock-tile:first-child'],['japan-stocks.html','.stock-tile:first-child'],['funds.html','[data-fund="sox"]'],['nasdaq-rsi.html','#price-ndx']]){
  await page.goto(base+file+'?ready-alert=off',{waitUntil:'domcontentloaded'});const card=page.locator(selector);await card.waitFor();await card.locator('.high-condition').first().waitFor();
  const stock=file.includes('stocks'),fund=file==='funds.html',attr=stock?'data-period':fund?'data-fund-period':'data-price-period',ratioSelector=stock?'.stock-high[data-high-kind="period"] .high-percent':fund?'.fund-high-percent':'.price-details>div:first-child strong';
  for(const [i,range]of ['1d','1w','1m','6m','1y','2y'].entries()){
   await card.locator('button['+attr+'="'+range+'"]').click();
   const hit=i>=2,expectedRatio=60/highs[i]*100;
   const ratio=parseFloat((await card.locator(ratioSelector).innerText()).replaceAll(',',''));
   assert.ok(Math.abs(ratio-expectedRatio)<.11,file+' selected ratio '+range+' '+ratio);
   assert.equal(await card.evaluate(el=>getComputedStyle(el).backgroundColor),hit?'rgb(255, 229, 154)':'rgb(255, 255, 255)',file+' selected color '+range);
   const condition=stock?card.locator('.stock-high[data-high-kind="period"] .high-condition'):fund?card.locator('.high-condition').first():card.locator('.high-condition').first();
   assert.equal((await condition.getAttribute('class')).includes('is-hit'),hit,file+' selected condition '+range);
   if(stock){const symbol=files[file==='japan-stocks.html'?'japan-stocks':'stocks'].stocks[0].symbol;assert.equal(await page.locator('#stock-alert-list a[href="#stock-'+symbol+'"]').count(),hit?1:0,file+' selected overview '+range);assert.match(await card.innerText(),/保存値/);}
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,file+' overflow '+width);
  await card.scrollIntoViewIfNeeded();await page.screenshot({path:'screenshots/navigation-threshold-'+engine+'-'+width+'-'+file+'.png'});
 }
 await page.goto(base+'heatmap.html?ready-alert=off');await page.locator('.tile').first().waitFor();for(const range of ['1d','1w','1m']){await page.locator('#periods [data-period="'+range+'"]').click();assert.match(await page.locator('.tile').first().innerText(),/％|未取得/);}
 await page.goto(base+'?ready-alert=off');await page.locator('.vix-card .high-condition').first().waitFor();assert.match(await page.locator('.vix-card').first().innerText(),/条件到達|VIX < 20|警戒/);
 assert.deepEqual(errors,[]);await context.close();console.log('SIX_RANGES_LINK_RATIO_COLOR_AND_OVERVIEW',engine,width);
}}finally{await browser.close();}
