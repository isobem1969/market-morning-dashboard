import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=spawn('python',['-m','http.server','8770','--directory','public'],{stdio:'ignore'});
try{
 for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:8770')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 await fs.mkdir('screenshots',{recursive:true});
 for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true});
  try{for(const [device,width,height,mobile] of [['mac',1440,1000,false],['iphone',390,844,true],['ipad',744,1133,true],['small-phone',320,700,true]]){
   const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:8770/stocks.html');await page.waitForSelector('.stock-tile');
   await page.locator('.research-tools [data-import-research]').click();
   await page.locator('#import-text').fill('アップル AAPL NASDAQ $100.00 買い 目標株価 $123.45 株価診断 割高 アナリスト 割安');
   await page.locator('#import-parse').click();
   assert.ok((await page.locator('#import-preview').innerText()).includes('123.45'));
   assert.equal(await page.locator('#import-save').isDisabled(),true);
   await page.locator('#import-confirm').check();await page.locator('#import-save').click();
   const panel=page.locator('.stock-tile[data-symbol="AAPL"] .research-panel');
   assert.equal(await panel.locator('.research-target').innerText(),'$123.45');
   assert.equal(await panel.locator('.research-badge.green').innerText(),'割高');
   assert.equal(await panel.locator('.research-badge.orange').innerText(),'割安');
   await page.reload();await page.waitForSelector('.stock-tile');assert.equal(await panel.locator('.research-target').innerText(),'$123.45');
   await page.locator('.research-tools [data-import-research]').click();
   await page.locator('#import-symbol').selectOption('MSFT');await page.locator('#import-text').fill('アップル AAPL NASDAQ 買い 目標株価 $123 株価診断 割高 アナリスト 割安');await page.locator('#import-parse').click();assert.ok((await page.locator('#import-message').innerText()).includes('一致'));assert.equal(await page.locator('#import-save').isDisabled(),true);
   const file={format:'market-morning-minkabu',version:1,records:[{symbol:'MSFT',opinion:'中立',target:456.78,diagnosis:'適正',analyst:'中立',capturedAt:new Date().toISOString()}]};
   await page.getByText('別端末で書き出したファイルから取り込む',{exact:true}).click();
   await page.locator('#import-file').setInputFiles({name:'research-test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(file))});
   await page.waitForFunction(()=>document.querySelector('#import-preview').textContent.includes('456.78'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,engine+' '+device+' overflow');
   assert.equal(await page.locator('#research-import-dialog').evaluate(el=>el.scrollWidth>el.clientWidth),false,engine+' '+device+' dialog overflow');
   await page.screenshot({path:`screenshots/research-import-${engine}-${device}.png`});
   await page.locator('#import-confirm').check();await page.locator('#import-save').click();
   assert.equal(await page.locator('.stock-tile[data-symbol="MSFT"] .research-target').innerText(),'$456.78');
   // File export round trip (native OS sharing is outside browser-engine emulation).
   await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true});});
   const downloadPromise=page.waitForEvent('download');await page.locator('#research-export').click();const download=await downloadPromise;
   const bundle=JSON.parse(await fs.readFile(await download.path(),'utf8'));assert.equal(bundle.records.length,2);
   await context.setOffline(true);await page.getByRole('button',{name:'更新を確認'}).click();
   await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('通信できません'));
   assert.equal(await panel.locator('.research-target').innerText(),'$123.45');assert.deepEqual(errors,[]);
   console.log(`PASS: ${engine} ${device}: paste, confirmation, panel values, persistence, wrong ticker, file import/export, offline`);
   await context.close();
  }}finally{await browser.close();}
 }
}finally{server.kill();}
