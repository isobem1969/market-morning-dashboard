import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PAGES} from '../public/page-registry.js';
const engine=process.env.BROWSER||'chromium';
const browser=await (engine==='webkit'?webkit:chromium).launch();
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8773/';
await fs.mkdir('screenshots',{recursive:true});
try{
 const context=await browser.newContext({viewport:{width:744,height:1133},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const page=await context.newPage();
 for(const width of [320,390,650,651,744,768,800,1024,1133,1200,1201,1280,1440]){
  await page.setViewportSize({width,height:width===1133?744:1133});
  let reference;
  for(const item of PAGES){
   await page.goto(new URL(item.url,base).href,{waitUntil:'domcontentloaded'});
   const result=await page.locator('main > .morning-pages').evaluate(nav=>{
    const rect=r=>({x:r.x,y:r.y,width:r.width,height:r.height});
    return {columns:getComputedStyle(nav).gridTemplateColumns.split(' ').length,links:[...nav.querySelectorAll('a')].map(a=>{
     const r=a.getBoundingClientRect(),s=getComputedStyle(a),range=document.createRange();range.selectNodeContents(a);
     const texts=[...range.getClientRects()].filter(t=>t.width&&t.height);
     return {text:a.textContent,font:parseFloat(s.fontSize),box:rect(r),current:a.getAttribute('aria-current'),overflow:a.scrollWidth>a.clientWidth+1||a.scrollHeight>a.clientHeight+1,textFits:texts.every(t=>t.left>=r.left-1&&t.right<=r.right+1&&t.top>=r.top-1&&t.bottom<=r.bottom+1),inViewport:r.left>=0&&r.right<=innerWidth+1};
    })};
   });
   assert.equal(result.columns,width<=650?2:width<=1200?3:6);
   assert.deepEqual(result.links.map(x=>x.text),PAGES.map(x=>x.label));
   assert.equal(result.links.filter(x=>x.current==='page').length,1);
   assert.equal(result.links.find(x=>x.current==='page').text,item.label);
   for(const link of result.links){
    const label=`${engine} ${item.key} ${width} ${link.text}`;
    assert.ok(link.font>=(width<=360?20:width<=650?22:24),label+' font too small');
    assert.ok(!link.overflow&&link.textFits&&link.inViewport,label+' clipped text');
   }
   const geometry=result.links.map(({box,font})=>({box,font}));
   if(reference)assert.deepEqual(geometry,reference,`${item.key} ${width} differs from market navigation`);
   else reference=geometry;
   if([320,744,1133,1440].includes(width))await page.locator('main > .morning-pages').screenshot({path:`screenshots/nav-font-${engine}-${width}-${item.key}.png`});
  }
  console.log('SIX_PAGE_NAV_READABLE',engine,width);
 }
 // Resize the same loaded page through both iPad orientations without reloading.
 for(const width of [744,1133,744]){
  await page.setViewportSize({width,height:width===744?1133:744});
  assert.equal(await page.locator('.morning-pages a').first().evaluate(a=>parseFloat(getComputedStyle(a).fontSize)),24);
 }
 await context.close();
}finally{await browser.close();}
