import {historyComparison,historyCalculationMarkup} from './high-history.js?v=history-range-20261122-v1';
import {readSnapshot,updateSnapshot} from './shared-data.js?v=six-pages-20261119-v1';
import {PAGES} from './page-registry.js?v=six-pages-20261119-v1';
const fundIds=['sox','fang','nasdaq','nasdaq_ifree','sp500_slim','allcountry_slim','schd','tqqq','soxl'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=v=>Number.isFinite(v);
const iso=t=>Number.isFinite(Date.parse(t));
const date=(t,tz='UTC')=>!t?'':t.length===10?t:iso(t)?new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t)):'';
export function expectedDates(calendar,now=Date.now()){
 if(calendar?.schemaVersion!==1||!calendar.feeds)return null;
 const result={};
 for(const [key,events]of Object.entries(calendar.feeds)){
  const due=events.filter(e=>iso(e.dueAt)&&Date.parse(e.dueAt)<=now);
  if(!due.length||!events.some(e=>Date.parse(e.dueAt)>now))return null;
  result[key]=due.at(-1).date;
 }
 return ['jpFund','jpPrice','jpDaily','usPrice','usDaily'].every(k=>result[k])?result:null;
}
export function dataHealth(snapshots,calendar,now=Date.now(),states={}){
 const issues=[],pending=[],unpublished=[],expected=expectedDates(calendar,now);
 const add=(page,label,item,reason,record={},anchor='')=>issues.push({page,label,item,reason,asOf:record.asOf||record.sessionDate||record.asOfDate||null,lastSuccess:record.lastSuccess||null,source:record.source||record.sourceLabel||'',sourceUrl:record.sourceUrl||'',href:(PAGES.find(p=>p.key===page)?.url||'./')+anchor});
 if(!expected)add('market','全6ページ','更新確認','取引日カレンダーを取得できないか、有効期間を過ぎています。');
 for(const [name,page]of [['market','market'],['market','funds'],['drawdowns','funds'],['stocks','stocks'],['japan','japan'],['heatmap','heatmap'],['rsi','rsi']])if(snapshots[name]&&states[name]==='再確認が必要')add(page,PAGES.find(p=>p.key===page)?.label||page,'通信・更新確認','最新の保存データを読み直せません。保存値を参考表示しています。');
 const check=(page,label,item,record,feed,anchor='',extra=[])=>{
  const r=record||{},reasons=[];
  if(r.status==='error'||r.error)reasons.push(r.error||'配信元から取得できませんでした');
  else if(r.status!=='ok'&&r.status!=='manual')reasons.push('取得済みのデータがありません');
  if(!iso(r.lastSuccess)||Date.parse(r.lastSuccess)>now+60000)reasons.push('取得日時が未確認です');
  else if(now-Date.parse(r.lastSuccess)>30*3600000)reasons.push('30時間以上、取得成功を確認できていません');
  if(feed&&expected){const day=r.sessionDate||date(r.asOf,r.timeZone||(['tqqq','soxl'].includes(r.id)?'America/New_York':'UTC'));if(!day||day<expected[feed])reasons.push('公表日 '+(day||'不明')+' ／ 必要な取引日 '+expected[feed]);}
  if(r.marketOpen&&iso(r.asOf)&&now-Date.parse(r.asOf)>45*60000)reasons.push('取引中の価格が45分以上更新されていません');
  reasons.push(...extra);
  if(reasons.length)add(page,label,item,[...new Set(reasons)].join(' · '),r,anchor);
 };
 const missing=(name,page)=>{if(snapshots[name])return false;if(states[name]==='再確認が必要')add(page,PAGES.find(p=>p.key===page)?.label||page,'データファイル','通信できず、保存データも確認できません');else pending.push(page);return true;};
 for(const page of ['market','funds'])if(!missing('market',page)){
  const ms=snapshots.market.metrics||[];
  const ids=page==='funds'?fundIds:['usd','vix','fear','vi','brent'];
  for(const id of ids){
   const m=ms.find(m=>m.id===id)||{},history=m.history||[],label=m.name||id,day=date(m.asOf,m.timeZone||(['tqqq','soxl'].includes(id)?'America/New_York':'UTC'));
   const extra=[];if(!finite(m.value))extra.push('価格・指数値が未取得です');
   if(!history.length||history.at(-1).date!==day)extra.push('グラフの最終日と表示値の公表日が一致しません');
   else if(finite(m.value)&&Math.abs(history.at(-1).value-m.value)>Math.max(.0001,Math.abs(m.value)*1e-6))extra.push('グラフの最終値と表示値が一致しません');
   check(page,label,'価格・グラフ',m,page==='funds'&&!['tqqq','soxl'].includes(id)?'jpFund':id==='vi'?'jpDaily':id==='vix'||id==='fear'?'usDaily':'usPrice','#metric-'+id,extra);
  }
 }
 if(!missing('drawdowns','funds'))for(const [key,label,target]of [['fang','FANG＋','fang'],['nasdaq','SBI／iFreeNEXT NASDAQ100','nasdaq'],['sp500_slim','S&P500','sp500_slim'],['allcountry_slim','オルカン','allcountry_slim'],['schd','SBI・SCHD','schd'],['tqqq','TQQQ','tqqq'],['soxl','SOXL','soxl']]){
  const r=snapshots.drawdowns[key]||{},last=r.years?.[r.currentYear]?.at(-1),extra=[];
  if(!last||last.date!==r.asOf)extra.push('下落比較グラフが公表日まで揃っていません');
  check('funds',label,'下落比較',{...r,status:r.error?'error':'ok'},['tqqq','soxl'].includes(key)?'usDaily':'jpFund','#metric-'+target,extra);
 }
 for(const [name,page]of [['stocks','stocks'],['japan','japan']])if(!missing(name,page)){
  if((snapshots[name].stocks||[]).length<(page==='japan'?4:13))add(page,PAGES.find(p=>p.key===page).label,'銘柄一覧','必要な銘柄のデータが揃っていません');
  for(const s of snapshots[name].stocks||[]){
   const p=s.price||{},label=s.name||s.symbol,anchor='#stock-'+s.symbol,extra=[],tz=p.timeZone||(page==='japan'?'Asia/Tokyo':'America/New_York');
   if(!finite(p.value))extra.push('株価が未取得です');
   for(const key of ['daily','intraday']){const last=p[key]?.at(-1);if(!last||date(new Date(last.time*1000).toISOString(),tz)!==p.sessionDate)extra.push((key==='daily'?'日足':'日中')+'グラフが株価の取引日まで揃っていません');}
   check(page,label,'株価・グラフ',p,page==='japan'?'jpPrice':'usPrice',anchor,extra);
   const history=historyComparison(s),beforeHigh=issues.length;
   check(page,label,'最高値',s.highs,null,anchor,!finite(s.highs?.allTime?.value)?['高値データが未取得です']:s.highs?.allTime?.complete!==true?['上場来の全履歴は未確認です。'+(history.rangeValid?history.start+'〜'+history.end+'の取得済み履歴'+(history.valid?'内の最高値で計算しています。':'です。価格・高値の記録が未確認のため計算を保留しています。'):'取得済み履歴の範囲も確認できていません。')]:[]);
   if(issues.length>beforeHigh)issues.at(-1).history=history;
   const ratios=s.japan||{},missingRatios=[];
   for(const key of ['per','pbr']){const value=ratios.ratios?.[key];if(value?.availability==='unpublished')unpublished.push({page,label,item:key.toUpperCase()});else if(!finite(value?.value))missingRatios.push(key.toUpperCase()+'が未取得です');}
   check(page,label,'PER・PBR',ratios,page==='japan'?'jpDaily':'usDaily',anchor,missingRatios);
   check(page,label,'アナリスト評価',s.research,null,anchor,(!finite(s.research?.target)&&!s.research?.recommendation&&!s.research?.recommendationLabel)?['公表状況を確認できません']:[]);
  }
 }
 if(!missing('heatmap','heatmap')){
  if((snapshots.heatmap.stocks||[]).length<37)add('heatmap','ヒートマップ','銘柄一覧','必要な銘柄のデータが揃っていません');
  for(const s of snapshots.heatmap.stocks||[])check('heatmap',s.name||s.symbol,'株価・期間比較',s,'usPrice','',(!finite(s.value)||['1d','1w','1m'].some(k=>!finite(s.periods?.[k]?.changePct)))?['比較元または価格が未取得です']:[]);
 }
 if(!missing('rsi','rsi')){
  const r=snapshots.rsi;check('rsi','NASDAQ100','週足RSI',{...r,lastSuccess:r.generatedAt,asOf:r.prices?.ndx?.asOf},'usDaily','',!finite(r.confirmed?.rsi)?['確定RSIが未取得です']:[]);
  for(const [key,label]of [['ndx','NASDAQ100'],['tqqq','TQQQ'],['soxl','SOXL']]){const p=r.prices?.[key]||{},extra=[];if(!finite(p.value)||p.closeHistory?.at(-1)?.date!==p.asOf)extra.push('価格比較用の履歴が最新公表日まで揃っていません');check('rsi',label,'価格・履歴',{...p,status:r.status,lastSuccess:r.generatedAt,error:r.error},'usPrice','#price-'+key,extra);}
 }
 return {kind:issues.length?'error':pending.length?'loading':'ready',issues,pending:[...new Set(pending)],unpublished,checkedAt:now};
}
export function healthMarkup(state){
 if(!state)return '<p>項目ごとの公表日と取得状況を確認しています。</p>';
 if(state.kind==='loading')return '<p>全6ページの公表日・価格・履歴を確認しています。</p>';
 if(!state.issues.length)return '<p>各項目の取得状況と直近の取引日を確認しました。'+(state.unpublished.length?'配信元が未公表とする項目 '+state.unpublished.length+'件は区別しています。':'')+'</p>';
 const lead=state.issues.slice(0,3).map(i=>i.label+'：'+i.item).join(' ／ ');
 return '<p class="health-lead">未取得・未確認 '+state.issues.length+'項目 · '+esc(lead)+(state.issues.length>3?' ほか':'')+'</p><details class="health-issues" open><summary>未取得・未確認の項目と理由を確認（'+state.issues.length+'件）</summary><ul>'+state.issues.map(i=>'<li><a href="'+esc(i.href)+'">'+esc(PAGES.find(p=>p.key===i.page)?.label||i.page)+' ／ '+esc(i.label)+' ／ '+esc(i.item)+'</a><p>'+esc(i.reason)+'</p>'+historyCalculationMarkup(i.history)+'<small>公表 '+esc(i.asOf||'日時未確認')+' ／ 最終取得成功 '+esc(i.lastSuccess||'なし')+'</small></li>').join('')+'</ul></details><button type="button" data-health-retry>未確認項目を再確認</button>';
}
export function mountDataHealth(win=window,doc=document){
 if(new URL(win.location.href).searchParams.get('ready-alert')==='off'||win.parent!==win)return;
 let calendar=null,calendarFailed=false,started=Date.now(),loading=false,lastSignature='';
 const snapshots=()=>Object.fromEntries(['market','stocks','japan','heatmap','rsi','drawdowns'].map(k=>[k,readSnapshot(k)]));
 let host=doc.getElementById('data-health-alert');
 if(!doc.getElementById('page-ready-alert')&&!host){host=doc.createElement('section');host.id='data-health-alert';host.className='data-health-alert';host.setAttribute('aria-label','全6ページの更新状況');doc.querySelector('.morning-pages')?.after(host);}
 async function load(){if(loading)return;loading=true;try{const response=await fetch('./data/health-calendar.json',{cache:'no-cache'});if(!response.ok)throw Error('calendar');calendar=await response.json();calendarFailed=false;}catch{calendarFailed=true;}finally{loading=false;render();}}
 function render(){
  let model;
  if(!calendar&&!calendarFailed&&Date.now()-started<15000)model={kind:'loading',issues:[],pending:['calendar'],unpublished:[]};
  else model=dataHealth(snapshots(),calendar,Date.now(),win.__morningPreloadState||{});
  if(Date.now()-started>=20000&&model.pending.length){model={...model,kind:'error',issues:[...model.issues,...model.pending.map(page=>({page,label:PAGES.find(p=>p.key===page)?.label||page,item:'データ確認',reason:'取得・保存データの確認が完了していません',href:PAGES.find(p=>p.key===page)?.url||'./'}))]};}
  const signature=JSON.stringify([model.kind,model.issues,model.pending,model.unpublished]);
  if(signature===lastSignature)return;
  // WebKit does not keep a reading panel in place when an alert above it grows.
  // Capture the panel ID because a health listener can rebuild its DOM node.
  const reading=win.scrollY>0?[...doc.querySelectorAll('#cards>.card,.stock-tile,.index-panel')].find(el=>{
   const r=el.getBoundingClientRect();return el.id&&r.bottom>0&&r.top<win.innerHeight;
  }):null;
  const readingId=reading?.id,readingTop=reading?.getBoundingClientRect().top;
  lastSignature=signature;win.__morningHealthState=model;
  win.dispatchEvent(new Event('morning-data-health'));
  if(host){const wasOpen=host.querySelector('.health-issues')?.open;host.dataset.state=model.kind;host.innerHTML='<strong>'+(model.kind==='error'?'⚠ 取得・履歴を確認できない項目があります':model.kind==='ready'?'✓ 全6ページの更新確認が完了しました':'↻ 全6ページの更新状況を確認しています')+'</strong>'+healthMarkup(model)+(model.issues.length?'':'<button type="button" data-health-retry>再確認</button>');if(typeof wasOpen==='boolean'&&host.querySelector('.health-issues'))host.querySelector('.health-issues').open=wasOpen;}
  if(readingId){const panel=doc.getElementById(readingId);if(panel)win.scrollBy({top:panel.getBoundingClientRect().top-readingTop,behavior:'instant'});}
 }
 doc.addEventListener('click',e=>{if(!e.target.closest('[data-health-retry]'))return;started=Date.now();void load();for(const key of ['market','stocks','japan','heatmap','rsi','drawdowns'])void updateSnapshot(key).catch(()=>{});});
 void load();render();let timer=win.setInterval(render,1000);
 doc.addEventListener('visibilitychange',()=>{if(!doc.hidden){started=Date.now();void load();render();}});
 win.addEventListener('pagehide',()=>win.clearInterval(timer));win.addEventListener('pageshow',e=>{if(e.persisted){win.clearInterval(timer);timer=win.setInterval(render,1000);void load();}});
}
if(typeof window!=='undefined'&&typeof document!=='undefined')mountDataHealth();
