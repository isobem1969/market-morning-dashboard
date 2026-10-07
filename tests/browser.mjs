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
  await context.route('https://itf.minkabu.jp/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:'<meta charset="utf-8"><title>Fund reference navigation test fixture</title><p>Navigation test only</p><p>基準価額</p>'}));
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await fs.mkdir('screenshots',{recursive:true});
  for(const [name,width,height] of [['mac',1440,1000],['iphone',390,844],['ipad-mini',744,1133],['small-iphone',320,700]]){
    await page.setViewportSize({width,height});
    await page.goto('http://127.0.0.1:8765');
    await page.waitForSelector('.card');
    assert.equal(await page.locator('.card').count(),8);
    const halfCards=await page.locator('.large-market-card').evaluateAll(cards=>cards.map(c=>{const r=c.getBoundingClientRect();return {width:r.width,top:r.top,left:r.left,titleSize:getComputedStyle(c.querySelector('.card-title')).fontSize,valueSize:getComputedStyle(c.querySelector('.value')).fontSize}}));
    assert.equal(halfCards.length,2);assert.equal(halfCards[0].titleSize,halfCards[0].valueSize);
    const gridWidth=await page.locator('#cards').evaluate(e=>e.getBoundingClientRect().width);
    if(width>650){assert.ok(Math.abs(halfCards[0].top-halfCards[1].top)<1);assert.ok(Math.abs(halfCards[0].width*2+14-gridWidth)<2);}else{assert.ok(Math.abs(halfCards[0].width-gridWidth)<2);}

    assert.equal(await page.locator('.fund-card').count(),3);
    for(const [id,code] of [['sox','29314233'],['fang','04311181'],['nasdaq','89311265']]){
      const tile=page.locator(`[data-fund="${id}"]`);
      for(const period of ['1d','1w','1m','6m','1y','2y']){await tile.locator(`[data-fund-period="${period}"]`).click();assert.equal(await tile.locator(`[data-fund-period="${period}"]`).getAttribute('aria-pressed'),'true');assert.equal(await tile.locator('.fund-chart').count(),1);}
      await tile.locator('[data-fund-period="6m"]').click();
      const button=tile.locator('.fund-minkabu');assert.equal(await button.getAttribute('href'),`https://itf.minkabu.jp/fund/${code}#:~:text=${encodeURIComponent('基準価額')}`);
      const popupPromise=page.waitForEvent('popup');await button.click();const popup=await popupPromise;await popup.waitForURL(new RegExp(`/fund/${code}`));await popup.close();
    }
    assert.equal(await page.locator('.fear-card .fear-legend li').count(),5);
    assert.equal(await page.locator('.vi-card .vi-legend li').count(),5);
    const positions=await page.evaluate(()=>['.vix-card:not(.fear-card):not(.vi-card)','.fear-card','.vi-card'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom}}));
    assert.ok(positions[0].bottom<positions[1].top);assert.ok(positions[1].bottom<positions[2].top);
    await page.locator('[data-vi-months="3"]').click();
    assert.equal(await page.locator('[data-vi-months="3"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('[data-fear-months="12"]').getAttribute('aria-pressed'),'true');
    await page.locator('[data-vi-months="12"]').click();
    await page.locator('[data-fear-months="6"]').click();
    assert.equal(await page.locator('[data-fear-months="6"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('[data-vix-months="12"]').getAttribute('aria-pressed'),'true');
    await page.locator('[data-fear-months="12"]').click();
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
  assert.equal(await page.locator('.vix-card:not(.fear-card):not(.vi-card)').getAttribute('data-band'),'fear');
  assert.equal(await page.locator('.fear-card').getAttribute('data-band'),'extreme-fear');
  assert.equal(await page.locator('.vi-card').getAttribute('data-band'),'high');
  assert.equal((await page.locator('.vix-card:not(.fear-card):not(.vi-card)').getAttribute('class')).includes('alert'),true);
  for(const [value,band]of [[14.99,'calm'],[15,'normal'],[20,'watch'],[30,'fear'],[40,'panic']]){
    fixture.metrics=fixture.metrics.map(m=>m.id==='vix'?{...m,value}:m);
    await page.getByRole('button',{name:'更新を確認'}).click();
    await page.waitForFunction(b=>document.querySelector('.vix-card:not(.fear-card):not(.vi-card)').dataset.band===b,band);
    assert.equal(await page.locator('.vix-card:not(.fear-card):not(.vi-card) .vix-legend .active').count(),1);
  }
  await page.locator('[data-vix-months="3"]').click();
  assert.equal(await page.locator('[data-vix-months="3"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-vix-months="12"]').click();
  assert.equal(await page.locator('[data-vix-months="12"]').getAttribute('aria-pressed'),'true');
  assert.equal((await page.locator('article[aria-label="Fear & Greed"]').getAttribute('class')).includes('alert'),false);
  fixture.metrics=fixture.metrics.map(m=>({...m,status:'error'}));
  await page.getByRole('button',{name:'更新を確認'}).click();
  await page.waitForFunction(()=>document.querySelector('#summary').textContent.includes('判定保留'));
  assert.equal(await page.locator('.card.alert').count(),0);
  assert.equal(await page.locator('.fear-card').getAttribute('data-band'),'unknown');
  assert.equal(await page.locator('.vi-card').getAttribute('data-band'),'unknown');
  await page.getByText('CNNの値を補完する',{exact:true}).click();
  await page.locator('#manual-value').fill('19');
  await page.locator('#manual-date').fill(today);
  await page.getByRole('button',{name:'保存',exact:true}).click();
  assert.equal((await page.locator('article[aria-label="Fear & Greed"]').getAttribute('class')).includes('alert'),true);
  await page.unrouteAll();
  await context.setOffline(true);
  await page.getByRole('button',{name:'更新を確認'}).click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('通信できません'));
  assert.equal(await page.locator('.card.alert').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: 3 mobile layouts, 8 cards, chart controls, exact alerts, manual entry and offline handling');
}finally{await browser?.close();server.kill();}
