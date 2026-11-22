import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const engine=process.env.BROWSER||'chromium',browser=await (engine==='webkit'?webkit:chromium).launch();
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const base=process.env.TEST_BASE_URL||'https://isobem1969.github.io/market-morning-dashboard/';
await fs.mkdir('screenshots',{recursive:true});
try{
 if(!process.env.TEST_BASE_URL)for(let attempt=0;attempt<100;attempt++){
  const r=await fetch(base+'sw.js?t='+Date.now());
  if((await r.text()).includes('six-pages-20261119-v1'))break;
  if(attempt===99)throw Error('New release not deployed');
  await new Promise(r=>setTimeout(r,3000));
 }
 await page.goto(base,{waitUntil:'domcontentloaded'});
 try{await page.waitForFunction(()=>document.querySelector('#page-ready-alert')?.dataset.phase==='complete',null,{timeout:60000});}
 catch(error){console.log('PROGRESS_DIAGNOSTIC',await page.evaluate(()=>({text:document.querySelector('#page-ready-alert')?.innerText,root:{data:window.__morningDataState,render:window.__morningRenderState,status:window.__morningPreloadState},frames:[...document.querySelectorAll('iframe[data-morning-page]')].map(f=>({key:f.dataset.morningPage,data:f.contentWindow.__morningDataState,render:f.contentWindow.__morningRenderState,status:f.contentWindow.__morningPreloadState}))})));throw error;}
 assert.equal(await page.locator('#ready-alert-progress').getAttribute('aria-valuenow'),'18');
 assert.equal(await page.locator('.ready-page[data-stage="complete"]').count(),6);
 for(const [label,width,height]of [['Mac',1440,1000],['Mac-narrow',1024,900],['iPad-portrait',1024,1366],['iPad-landscape',1366,1024],['mini-portrait',744,1133],['mini-landscape',1133,744],['iPhone-portrait',390,844],['iPhone-landscape',844,390],['iPhone-SE',375,667],['narrow',320,640]]){
  await page.setViewportSize({width,height});
  await page.locator('.ready-alert-details').evaluate(el=>el.open=false);
  // The user-facing default is expanded; measure the optional compact mode.
  await page.locator('#ready-alert-health .health-issues').evaluateAll(els=>els.forEach(el=>el.open=false));
  const compactHeight=await page.locator('#page-ready-alert').evaluate(el=>el.getBoundingClientRect().height);
  const healthError=await page.locator('#page-ready-alert').getAttribute('data-state')==='error';
  assert.ok(compactHeight<=(healthError?(width<=650?430:330):(width<=650?310:230)),label+' compact height: '+compactHeight);
  await page.screenshot({path:'screenshots/navigation-progress-compact-'+engine+'-'+label+'.png'});
  await page.locator('.ready-alert-details>summary').click();
  const layout=await page.evaluate(()=>{
   const panel=document.querySelector('#page-ready-alert').getBoundingClientRect(),nav=document.querySelector('.morning-pages').getBoundingClientRect();
   return {left:panel.left,right:panel.right,navLeft:nav.left,navRight:nav.right,overflow:document.querySelector('#page-ready-alert').scrollWidth>document.querySelector('#page-ready-alert').clientWidth,columns:getComputedStyle(document.querySelector('.ready-alert-pages')).gridTemplateColumns.split(' ').length,cards:[...document.querySelectorAll('.ready-page')].map(c=>({left:c.getBoundingClientRect().left,right:c.getBoundingClientRect().right,overflow:c.scrollWidth>c.clientWidth}))};
  });
  assert.ok(Math.abs(layout.left-layout.navLeft)<=2&&Math.abs(layout.right-layout.navRight)<=2,label+' full width');
  assert.equal(layout.overflow,false,label+' panel overflow');
  assert.equal(layout.columns,width<=380?1:width<=1100?2:3,label+' responsive columns');
  assert.ok(layout.cards.every(c=>c.left>=0&&c.right<=width+1&&!c.overflow),label+' card overflow');
  await page.screenshot({path:'screenshots/navigation-progress-'+engine+'-'+label+'.png'});
  console.log('PROGRESS_LAYOUT_OK',engine,label,width,height,layout.columns);
 }
 assert.deepEqual(errors,[]);
 console.log('PROGRESS_REAL_DATA_18_CHECKPOINTS_OK',engine);
}finally{await context.close();await browser.close();}
