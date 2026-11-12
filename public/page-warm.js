// Keep the two prepared pages alive: switching only changes visibility.
const base=new URL('./',import.meta.url),paths={indicators:base.pathname,stocks:new URL('stocks-reference.html',base).pathname,heatmap:new URL('heatmap.html',base).pathname,rsi:new URL('nasdaq-rsi.html',base).pathname};
const pageFor=url=>{try{const u=new URL(url,location.href);return u.origin===location.origin?Object.keys(paths).find(k=>paths[k]===u.pathname):null;}catch{return null;}};
const usableClick=e=>e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey;
if(window.parent!==window&&new URL(location.href).searchParams.has('prewarmed')){
 document.addEventListener('click',e=>{const a=e.target.closest('a[href]'),key=a&&pageFor(a.href);if(!key||!usableClick(e))return;e.preventDefault();window.parent.postMessage({type:'morning-page-switch',key},location.origin);});
}else if(location.pathname===paths.indicators||location.pathname===new URL('index.html',base).pathname){
 const root=document.querySelector('main'),frames=new Map(),ready=new Set();let active='indicators';
 const label=()=>{const el=document.querySelector('#page-preload-status');if(el)el.textContent=['stocks','heatmap','rsi'].map(k=>(k==='stocks'?'米国株':k==='rsi'?'NASDAQ100・RSI':'ヒートマップ')+'：'+(ready.has(k)?'準備完了':'画面を先読み中')).join(' ／ ');};
 const show=(key,push=true)=>{if(!paths[key])return;active=key;root.hidden=key!=='indicators';for(const [name,frame]of frames){const visible=name===key;frame.style.visibility=visible?'visible':'hidden';frame.style.pointerEvents=visible?'auto':'none';frame.setAttribute('aria-hidden',String(!visible));if(visible){document.title=frame.contentDocument?.title||document.title;frame.focus();}}if(push&&location.pathname!==paths[key])history.pushState({morningPage:key},'',paths[key]);if(key==='indicators'){document.title='朝の指標 | Market Morning';root.hidden=false;}};
 for(const key of ['stocks','heatmap','rsi']){
  const frame=document.createElement('iframe');frame.dataset.morningPage=key;frame.title=key==='stocks'?'朝の米国株':key==='rsi'?'NASDAQ100・RSI':'ヒートマップ';frame.src=new URL(paths[key]+'?prewarmed=1',location.origin);frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;inset:0;width:100%;height:100%;border:0;z-index:10000;background:#f5f4ef;visibility:hidden;pointer-events:none';document.body.append(frame);frames.set(key,frame);
 }
 document.querySelector('#refresh')?.addEventListener('click',()=>{for(const frame of frames.values())frame.contentDocument?.querySelector('#refresh,#refresh-heatmap')?.click();});
 label();const timer=setInterval(()=>{for(const [key,frame]of frames){if(ready.has(key))continue;try{const doc=frame.contentDocument;if(key==='stocks'?doc?.querySelectorAll('.stock-tile').length===13:key==='rsi'?!!doc?.querySelector('.rsi-ready'):doc?.querySelectorAll('.tile').length>0&&!doc.querySelector('.tile .move')?.textContent.includes('未取得'))ready.add(key);}catch{}}label();if(ready.size===3)clearInterval(timer);},100);
 document.addEventListener('click',e=>{const a=e.target.closest('a[href]'),key=a&&pageFor(a.href);if(!key||!usableClick(e))return;e.preventDefault();show(key);});
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.type!=='morning-page-switch')return;if(![...frames.values()].some(f=>f.contentWindow===e.source))return;show(e.data.key);});
 window.addEventListener('popstate',()=>show(pageFor(location.href)||'indicators',false));
}

