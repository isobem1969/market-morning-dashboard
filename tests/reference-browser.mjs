import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const symbols=['AAPL','GOOGL','MSFT','AMZN','META','TSLA','SPCX','NVDA','LLY','KO','JNJ','ABBV'];
const server=spawn('python',['-m','http.server','8771','--directory','public'],{stdio:'ignore'});
try{
 for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:8771')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 await fs.mkdir('screenshots',{recursive:true});
 for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true});
  try{for(const [device,width,height,mobile] of [['mac',1440,1000,false],['iphone',390,844,true],['ipad',744,1133,true],['small-phone',320,700,true]]){
   const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
   // Test navigation only. This explicit fixture does not represent Minkabu data or live-site availability.
   await context.route('https://us.minkabu.jp/**',r=>r.fulfill({contentType:'text/html',body:'<title>Reference navigation test fixture</title><p>Navigation test only</p>'}));
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:8771/stocks-reference.html');await page.waitForSelector('.stock-tile');
   assert.equal(await page.locator('.stock-tile').count(),12);assert.equal(await page.locator('.minkabu-small').count(),12);assert.equal(await page.locator('iframe').count(),0);
   for(const symbol of symbols){
    const tile=page.locator(`.stock-tile[data-symbol="${symbol}"]`),button=tile.locator('.minkabu-small');
    assert.equal(await button.innerText(),'みんかぶ');assert.equal(await button.getAttribute('href'),`https://us.minkabu.jp/stocks/${symbol}/researches`);
    const box=await button.boundingBox(),panel=await tile.boundingBox();assert.ok(box.width<=110);assert.ok(box.height<=50);assert.ok(Math.abs(panel.x+panel.width-(box.x+box.width))<=32);
    const popupPromise=page.waitForEvent('popup');await button.click();const popup=await popupPromise;await popup.waitForURL(`https://us.minkabu.jp/stocks/${symbol}/researches`);await popup.close();
   }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));assert.deepEqual(errors,[]);
   await page.locator('.stock-tile').first().scrollIntoViewIfNeeded();await page.screenshot({path:`screenshots/reference-${engine}-${device}.png`});
   console.log(`PASS ${engine} ${device}: 12 compact right-aligned buttons and 12 matching reference popup URLs (fixture)`);await context.close();
  }}finally{await browser.close();}
 }
}finally{server.kill();}
