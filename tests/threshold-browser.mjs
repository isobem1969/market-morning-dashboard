import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const engine=process.env.BROWSER||'chromium',base=process.env.TEST_BASE_URL||'http://127.0.0.1:8773/';
const browser=await(engine==='webkit'?webkit:chromium).launch();
const files={};for(const name of ['market','stocks','japan-stocks','heatmap','nasdaq-rsi'])files[name]=JSON.parse(await fs.readFile('public/data/'+name+'.json','utf8'));
const old=new Date(Date.now()-6*3600000).toISOString(),date=old.slice(0,10),time=Date.parse(date+'T18:00:00Z')/1000;
for(const name of ['stocks','japan-stocks']){const s=files[name].stocks[0];s.price={...s.price,value:49,lastSuccess:old,status:'ok',daily:[{time:time-60*86400,value:100,high:100},{time,value:49,high:50}],intraday:[{time,value:49,high:100}]};s.highs={...s.highs,status:'ok',lastSuccess:old,allTime:{value:100,date,complete:false}};}
const m=files.market.metrics.find(m=>m.id==='sox');Object.assign(m,{value:49,peak:100,lastSuccess:old,asOf:date,history:[{date:new Date(time*1000-60*86400000).toISOString().slice(0,10),value:100},{date,value:49}]});
Object.assign(files.heatmap.stocks.find(s=>s.symbol==='AAPL'),{value:49,week52High:100,lastSuccess:old});
Object.assign(files['nasdaq-rsi'].prices.ndx,{value:49,peak:100,ratio:49,drawdown:-51});
try{for(const width of [1440,744,390,320]){
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/data/*.json',async route=>{const name=new URL(route.request().url()).pathname.split('/').at(-1).replace('.json','');if(files[name])return route.fulfill({json:files[name]});return route.continue();});
 for(const [file,selector]of [['stocks-reference.html','.stock-tile:first-child'],['japan-stocks.html','.stock-tile:first-child'],['funds.html','[data-fund="sox"]'],['nasdaq-rsi.html','#price-ndx']]){
  await page.goto(base+file+'?ready-alert=off',{waitUntil:'domcontentloaded'});const card=page.locator(selector);await card.waitFor();
  await card.locator('.high-condition.is-hit').first().waitFor();
  assert.match(await card.innerText(),/50％未満/);assert.equal(await card.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 229, 154)',file+' yellow panel');
  if(file.includes('stocks'))assert.match(await card.innerText(),/保存値/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,file+' overflow '+width);
  await card.scrollIntoViewIfNeeded();await page.screenshot({path:'screenshots/navigation-threshold-'+engine+'-'+width+'-'+file+'.png'});
 }
 await page.goto(base+'heatmap.html?ready-alert=off');await page.locator('.tile[data-symbol="AAPL"]').first().waitFor();const tile=page.locator('.tile[data-symbol="AAPL"]').first();assert.match(await tile.innerText(),/52週高値の50％未満/);await tile.click();await page.locator('#detail-high-condition .is-hit').waitFor();assert.match(await page.locator('#detail-high-condition').innerText(),/50％未満/);
 await page.goto(base+'?ready-alert=off');await page.locator('.vix-card .high-condition').first().waitFor();assert.match(await page.locator('.vix-card').first().innerText(),/条件到達|VIX < 20|警戒/);
 assert.deepEqual(errors,[]);await context.close();console.log('THRESHOLD_PANELS_AND_COLORS_OK',engine,width);
}}finally{await browser.close();}
