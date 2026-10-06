import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=spawn('python',['-m','http.server','8766','--directory','public'],{stdio:'ignore'});
let browser;
try{
 for(let i=0;i<40;i++){try{if((await fetch('http://127.0.0.1:8766')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await fs.mkdir('screenshots',{recursive:true});
 for(const [name,width,height] of [['mac',1440,1000],['iphone',390,844],['ipad-mini',744,1133],['small-iphone',320,700]]){
  await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:8766/stocks.html');await page.waitForSelector('.stock-tile');
  assert.equal(await page.locator('.stock-tile').count(),12);
  assert.equal(await page.locator('.research-panel').count(),12);
  assert.equal(await page.locator('.research-missing').count(),33);
  const missing=page.locator('.stock-tile[data-symbol="AAPL"] .research-missing');
  for(const link of await missing.all()){
   assert.equal(await link.getAttribute('href'),'https://us.minkabu.jp/stocks/AAPL/researches');
   assert.equal(await link.getAttribute('target'),'_blank');
  }
  assert.ok((await page.locator('.stock-tile[data-symbol="AAPL"] [data-ma="25"]').getAttribute('d')).includes('L'));
  assert.ok((await page.locator('.stock-tile[data-symbol="AAPL"] [data-ma="75"]').getAttribute('d')).includes('L'));
  const nvda=page.locator('.stock-tile[data-symbol="NVDA"] .research-panel');
  assert.equal(await nvda.locator('.research-badge.green').innerText(),'割高');
  assert.equal(await nvda.locator('.research-badge.orange').innerText(),'割安');
  assert.equal(await nvda.locator('.research-target').innerText(),'$266.36');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name} stocks overflow`);
  await page.screenshot({path:`screenshots/stocks-${name}.png`,fullPage:true});
 }
 const aapl=page.locator('[data-symbol="AAPL"].stock-tile');
 for(const label of ['1日','1週','1カ月','6カ月','1年','2年']){
  await aapl.getByRole('button',{name:label,exact:true}).click();
  assert.equal(await aapl.getByRole('button',{name:label,exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await aapl.locator('.periods [aria-pressed="true"]').count(),1);
  assert.ok((await aapl.locator('[data-ma="25"]').getAttribute('d')).includes('L'));
  assert.ok((await aapl.locator('[data-ma="75"]').getAttribute('d')).includes('L'));
 }
 assert.equal(await page.locator('[data-symbol="MSFT"].stock-tile').getByRole('button',{name:'6カ月',exact:true}).getAttribute('aria-pressed'),'true');
 const saved=JSON.parse(await fs.readFile('public/data/stocks.json','utf8'));
 const now=new Date().toISOString();
 const fixture={...saved,researchSource:{status:'http_error',httpStatus:403,checkedAt:now,nextCheckAt:now},generatedAt:now,stocks:saved.stocks.map(s=>({...s,price:{...s.price,status:'ok',lastSuccess:now},japan:{status:'ok',lastSuccess:now,ratios:{per:{value:null},pbr:{value:5}},sentiment:{buy:60,hold:15,sell:25}}}))};
 await page.route('**/data/stocks.json?*',route=>route.fulfill({json:fixture}));
 await page.getByRole('button',{name:'更新を確認'}).click();
 await page.waitForFunction(()=>document.querySelector('.buy-label').textContent.includes('60.0'));
 assert.ok((await page.locator('#research-status').innerText()).includes('HTTP 403'));
 assert.ok((await page.locator('#research-status').innerText()).includes('自動取得は未接続'));
 assert.equal(await aapl.locator('.gauge .buy').evaluate(el=>el.style.width),'60%');
 assert.equal(await aapl.locator('.gauge .sell').evaluate(el=>el.style.width),'25%');
 assert.equal(await aapl.locator('.gauge .sell').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(58, 153, 70)');
 assert.equal(await aapl.getByText('公表値なし',{exact:true}).count(),1);
 fixture.stocks=fixture.stocks.map(s=>({...s,price:{...s.price,status:'error'},japan:{...s.japan,status:'error',sentiment:null}}));
 await page.getByRole('button',{name:'更新を確認'}).click();
 await page.waitForFunction(()=>document.querySelector('.badge').textContent.includes('前回保存値'));
 assert.equal(await aapl.locator('.gauge .buy').count(),0);
 await page.unrouteAll();await context.setOffline(true);await page.getByRole('button',{name:'更新を確認'}).click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('通信できません'));
 assert.deepEqual(errors,[]);
 console.log('PASS: 12 stocks, 4 viewport sizes, 6 independent chart ranges, sentiment with neutral, missing PER, stale and offline data');
}finally{await browser?.close();server.kill();}
