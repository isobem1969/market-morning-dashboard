import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PAGES} from '../public/page-registry.js';
const engine=process.env.BROWSER||'chromium',base=process.env.TEST_BASE_URL||'https://isobem1969.github.io/market-morning-dashboard/';
const browser=await(engine==='webkit'?webkit:chromium).launch();
await fs.mkdir('screenshots',{recursive:true});
try{
 for(const [device,width,height,mobile]of [['Mac',1440,1000,false],['iPad-mini',744,1133,true],['iPhone',390,844,true],['small-iPhone',320,700,true]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const item of PAGES){
   await page.goto(new URL(item.url,base).href,{waitUntil:'domcontentloaded'});
   await page.locator('header h1').waitFor();
   assert.equal(await page.locator('header h1').innerText(),item.label);
   assert.deepEqual(await page.locator('.morning-pages a').allTextContents(),PAGES.map(p=>p.label));
   assert.equal(await page.locator('.morning-pages a[aria-current=page]').count(),1);
   assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('header h1')).fontWeight),width>650&&!mobile?'750':'850');
   if(item.key==='market'){
    await page.locator('.vi-card').waitFor();assert.equal(await page.locator('#cards>.card').count(),5);assert.equal(await page.locator('.fund-card').count(),0);
    await page.waitForFunction(()=>document.querySelector('#page-ready-alert')?.dataset.phase==='complete',null,{timeout:60000});
    assert.equal(await page.locator('#ready-alert-progress').getAttribute('aria-valuenow'),'18');
   }else if(item.key==='funds'){
    await page.locator('[data-fund=soxl]').waitFor();assert.equal(await page.locator('.fund-card').count(),9);
    assert.deepEqual(await page.locator('.fund-card').evaluateAll(a=>a.map(e=>e.dataset.fund)),['sox','fang','nasdaq','nasdaq_ifree','sp500_slim','allcountry_slim','schd','tqqq','soxl']);
    for(const id of ['sox','fang','nasdaq','nasdaq_ifree','sp500_slim','allcountry_slim','schd','tqqq','soxl']){
     const tile=page.locator('[data-fund="'+id+'"]');await tile.locator('[data-fund-period="1m"]').click();
     assert.equal(await tile.locator('[data-fund-period="1m"]').getAttribute('aria-pressed'),'true');assert.equal(await tile.locator('.fund-chart').count(),1);
    }
   }else if(['japan','stocks'].includes(item.key)){
    await page.locator('.stock-tile').first().waitFor();assert.equal(await page.locator('.stock-tile').count(),item.key==='japan'?4:13);
    if(item.key==='japan'){
     assert.deepEqual(await page.locator('.stock-tile h2').allTextContents(),['ソフトバンクグループ','楽天グループ','キオクシア','東京エレクトロン']);
     assert.deepEqual(await page.locator('.currency').allTextContents(),['円','円','円','円']);
     assert.equal(await page.locator('.analyst-panel').count(),4);assert.equal(await page.locator('.ratio').count(),8);
     for(const code of ['9984','4755','285A','8035']){
      const tile=page.locator('[data-symbol="'+code+'.T"].stock-tile');
      assert.equal(await tile.locator('.minkabu-small').getAttribute('href'),'https://minkabu.jp/stock/'+code);
      for(const period of ['1d','1w','1m','6m','1y','2y']){await tile.locator('[data-period="'+period+'"]').click();assert.equal(await tile.locator('svg[data-period="'+period+'"]').count(),1);}
     }
    }
   }else if(item.key==='heatmap')await page.locator('.tile').first().waitFor();
   else await page.locator('#rsi-chart svg').waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,device+' '+item.key+' overflows');
   await page.screenshot({path:'screenshots/navigation-six-'+engine+'-'+device+'-'+item.key+'.png'});
  }
  await page.goto(base+'nasdaq-rsi.html');
  for(const id of ['ndx','tqqq','soxl'])assert.ok((await page.locator('#price-'+id+' .indicator-panel-link').getAttribute('href')).startsWith('./funds.html#metric-'));
  await page.goto(base+'#metric-soxl');await page.waitForURL('**/funds.html#metric-soxl');await page.locator('#metric-soxl').waitFor();
  assert.deepEqual(errors,[]);console.log('SIX_PAGES_OK',engine,device);await context.close();
 }
}finally{await browser.close();}
