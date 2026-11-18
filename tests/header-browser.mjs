import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PAGES} from '../public/page-registry.js';
const engine=process.env.BROWSER||'chromium',base=process.env.TEST_BASE_URL||'http://127.0.0.1:8773/';
const browser=await(engine==='webkit'?webkit:chromium).launch();
await fs.mkdir('screenshots',{recursive:true});
try{
 for(const [width,height,mobile]of [[1440,1000,false],[1024,900,false],[744,1133,true],[390,844,true],[320,700,true]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
  const page=await context.newPage();let reference;
  for(const item of PAGES){
   await page.goto(new URL(item.url,base).href,{waitUntil:'domcontentloaded'});
   await page.locator('header #today .header-calendar-date').waitFor();
   const result=await page.evaluate(()=>{
    const header=document.querySelector('header.unified-header'),hr=header.getBoundingClientRect();
    const selectors={subtitle:'.eyebrow',title:'h1',date:'#today',button:'.header-refresh',icon:'.refresh-icon'};
    const styleKeys=['fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','color','backgroundColor','borderRadius','borderTopWidth','paddingTop','paddingRight','paddingBottom','paddingLeft','textAlign'];
    return {header:{x:hr.x,y:hr.y,width:hr.width,height:hr.height},parts:Object.fromEntries(Object.entries(selectors).map(([key,selector])=>{
     const el=header.querySelector(selector),s=getComputedStyle(el),r=el.getBoundingClientRect();
     return [key,{x:r.x-hr.x,y:r.y-hr.y,right:hr.right-r.right,width:r.width,height:r.height,styles:Object.fromEntries(styleKeys.map(k=>[k,s[k]]))}];
    })),overflow:header.scrollWidth>header.clientWidth};
   });
   assert.equal(result.overflow,false,item.label+' header overflow '+width);
   if(!reference)reference=result;
   assert.deepEqual(result.header,reference.header,item.label+' header geometry '+width);
   for(const key of ['subtitle','title','date','button','icon']){
    assert.deepEqual(result.parts[key].styles,reference.parts[key].styles,item.label+' '+key+' styles '+width);
    for(const prop of ['x','y'])assert.ok(Math.abs(result.parts[key][prop]-reference.parts[key][prop])<=1,item.label+' '+key+' '+prop+' '+width);
   }
   for(const key of ['date','button','icon'])for(const prop of ['right','width','height'])assert.ok(Math.abs(result.parts[key][prop]-reference.parts[key][prop])<=1,item.label+' '+key+' '+prop+' '+width);
   await page.screenshot({path:'screenshots/navigation-header-'+engine+'-'+width+'-'+item.key+'.png'});
  }
  console.log('SIX_HEADERS_MATCH_REFERENCE',engine,width);await context.close();
 }
}finally{await browser.close();}
