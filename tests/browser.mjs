import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const server=spawn('python',['-m','http.server','8765','--directory','public'],{stdio:'ignore'});
let browser;
try {
  for(let i=0;i<40;i++){
    try {if((await fetch('http://127.0.0.1:8765')).ok)break;}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({serviceWorkers:'block'});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await fs.mkdir('screenshots',{recursive:true});
  for(const [name,width,height] of [['iphone',390,844],['ipad-mini',744,1133],['small-iphone',320,700]]){
    await page.setViewportSize({width,height});
    await page.goto('http://127.0.0.1:8765');
    await page.waitForSelector('.card');
    assert.equal(await page.locator('.card').count(),8);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name} overflows`);
    await page.screenshot({path:`screenshots/${name}.png`,fullPage:true});
  }
  await page.getByRole('button',{name:'30回',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'30回',exact:true}).getAttribute('aria-pressed'),'true');
  const data=JSON.parse(await fs.readFile('public/data/market.json','utf8'));
  const now=new Date().toISOString(),today=now.slice(0,10);
  const fixture={...data,generatedAt:now,metrics:data.metrics.map(m=>({...m,asOf:today,status:'ok',lastSuccess:now,value:({vix:30,fear:20,vi:49.99}[m.id]??m.value??50)}))};
  await page.route('**/data/market.json?*',route=>route.fulfill({json:fixture}));
  await page.getByRole('button',{name:'更新を確認'}).click();
  await page.waitForFunction(()=>document.querySelector('#summary').textContent.includes('指定条件に到達'));
  assert.equal(await page.locator('article[aria-label="VIX 恐怖指数"]').getAttribute('class'),'card alert');
  assert.equal((await page.locator('article[aria-label="Fear & Greed"]').getAttribute('class')).includes('alert'),false);
  fixture.metrics=fixture.metrics.map(m=>({...m,status:'error'}));
  await page.getByRole('button',{name:'更新を確認'}).click();
  await page.waitForFunction(()=>document.querySelector('#summary').textContent.includes('判定保留'));
  assert.equal(await page.locator('.card.alert').count(),0);
  await page.getByText('CNNの値を補完する',{exact:true}).click();
  await page.locator('#manual-value').fill('19');
  await page.locator('#manual-date').fill(today);
  await page.getByRole('button',{name:'保存',exact:true}).click();
  assert.equal((await page.locator('article[aria-label="Fear & Greed"]').getAttribute('class')).includes('alert'),true);
  await context.setOffline(true);
  await page.getByRole('button',{name:'更新を確認'}).click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('通信できません'));
  assert.equal(await page.locator('.card.alert').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: 3 mobile layouts, 8 cards, chart controls, exact alerts, manual entry and offline handling');
}finally{await browser?.close();server.kill();}
