import {redirectingFundPanel} from './common-header.js?v=us-etf-20261123-v1';
// Prepare snapshots and page structure off screen. Open links as real documents.
// A hidden, fixed iframe must never become the visible page or intercept its scroll.
import {PAGES} from './page-registry.js?v=six-pages-20261119-v1';
const base=new URL('./',import.meta.url);
const paths=Object.fromEntries(PAGES.filter(p=>p.key!=='market').map(p=>[p.key,new URL(p.url,base)]));
const isRoot=location.pathname===base.pathname||location.pathname===new URL('index.html',base).pathname;
if(window.parent===window&&isRoot&&!redirectingFundPanel){
 const frames=new Map();
 for(const [key,url]of Object.entries(paths)){
  const frame=document.createElement('iframe');frame.dataset.morningPage=key;
  frame.title=PAGES.find(p=>p.key===key).label+'の準備';
  frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;frame.inert=true;
  const source=new URL(url);source.searchParams.set('prewarmed','1');frame.src=source;
  frame.style.cssText='position:fixed;top:0;left:-200vw;width:100vw;height:100vh;border:0;visibility:hidden;pointer-events:none';
  document.body.append(frame);frames.set(key,frame);
 }
 function label(){
  const el=document.getElementById('page-preload-status');if(!el)return;
  el.textContent=[...frames].map(([key,frame])=>{
   let complete=false;
   try{const state=frame.contentWindow;complete=state.__morningPreloadState?.[PAGES.find(p=>p.key===key).dataKey]==='準備完了'&&!!state.__morningRenderState?.[key]&&(key!=='stocks'||state.__morningRenderState.stocks.etfsReady);}catch{}
   return PAGES.find(p=>p.key===key).label+'：'+(complete?'準備完了':'画面を先読み中');
  }).join(' ／ ');
 }
 document.getElementById('refresh')?.addEventListener('click',()=>{
  for(const frame of frames.values()){
   try{const target=frame.contentWindow;if(target.__morningRefreshReady)target.dispatchEvent(new target.Event('morning-refresh'));else frame.contentDocument?.querySelector('#refresh,#refresh-heatmap')?.click();}catch{}
  }
 });
 label();let timer=setInterval(label,300);
 window.addEventListener('pagehide',()=>clearInterval(timer));
 window.addEventListener('pageshow',event=>{if(event.persisted){clearInterval(timer);label();timer=setInterval(label,300);}});
}
