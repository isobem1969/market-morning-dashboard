import {ETF_IDS} from './asset-pages.js?v=overview-sync-20261124-v1';
import {FUND_META,fundCard,fundHover,openFundReference} from './fund-panel.js?v=overview-sync-20261124-v1';
import {rangeOverviewState} from './funds-overview.js?v=overview-sync-20261124-v1';
import {quality} from './logic.js?v=overview-sync-20261124-v1';
import {readSnapshot,updateSnapshot} from './shared-data.js?v=six-pages-20261119-v1';
import {watchValuePairs} from './value-pair.js?v=green-arrow-20261008';
export function etfMetrics(market,drawdowns={}){
 return ETF_IDS.map(id=>({...market?.metrics?.find(m=>m.id===id),id,
  name:market?.metrics?.find(m=>m.id===id)?.name||FUND_META[id].name,drawdown:drawdowns[id]}));
}
export function mountUsEtfs(host,{datetime,onChange=()=>{}}){
 const ranges=new Map();let market=readSnapshot('market'),drawdowns=readSnapshot('drawdowns')||{},offline=false,pending=null;
 const metrics=()=>etfMetrics(market,drawdowns);
 const checkedQuality=m=>{const q=quality(m,Date.now(),market?.generatedAt,offline);const issue=window.__morningHealthState?.issues?.find(i=>i.page==='stocks'&&i.label===m.name&&i.item==='価格・グラフ');return issue?{usable:false,label:issue.reason}:q;};
 const overview=()=>rangeOverviewState(metrics(),ranges,checkedQuality);
 function jump(){
  const id=/^#(?:metric-|stock-)(tqqq|soxl)$/i.exec(location.hash)?.[1]?.toLowerCase();if(!id)return;
  const el=document.getElementById('metric-'+id);if(el)requestAnimationFrame(()=>{el.scrollIntoView({block:'start',behavior:'instant'});el.focus({preventScroll:true});});
 }
 let jumpPending=!!location.hash;
 function render(){
  const reading=scrollY>0?[...host.querySelectorAll('.fund-card')].find(el=>{const r=el.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;}):null;
  const id=reading?.id,top=reading?.getBoundingClientRect().top;
  host.innerHTML=metrics().map(m=>fundCard(m,checkedQuality(m),ranges.get(m.id)||'6m',{datetime})).join('');
  for(const el of host.querySelectorAll('.fund-card')){el.id='metric-'+el.dataset.fund;el.tabIndex=-1;}
  const state=window.__morningRenderState||={};state.stocks={...state.stocks,etfsReady:!!market&&!!Object.keys(drawdowns).length&&['market','drawdowns'].every(k=>window.__morningPreloadState?.[k]==='準備完了')};
  onChange();
  if(id){const current=document.getElementById(id);if(current)scrollBy({top:current.getBoundingClientRect().top-top,behavior:'instant'});}
  if(jumpPending&&market){jumpPending=false;jump();}
 }
 async function refresh(){
  if(pending)return pending;
  const requests=['market','drawdowns'].map(updateSnapshot);render();
  pending=Promise.allSettled(requests).then(results=>{market=readSnapshot('market');drawdowns=readSnapshot('drawdowns')||{};offline=results[0].status==='rejected';render();}).finally(()=>{pending=null;});return pending;
 }
 host.addEventListener('click',e=>{const ref=e.target.closest('[data-fund-minkabu]');if(ref){e.preventDefault();openFundReference(ref);return;}const b=e.target.closest('[data-fund-period]');if(!b)return;ranges.set(b.dataset.fundId,b.dataset.fundPeriod);render();host.querySelector('[data-fund-id="'+b.dataset.fundId+'"][data-fund-period="'+b.dataset.fundPeriod+'"]')?.focus({preventScroll:true});});
 host.addEventListener('pointermove',e=>fundHover(e,metrics(),ranges));
 window.addEventListener('hashchange',jump);
 window.addEventListener('morning-data-health',()=>{market=readSnapshot('market');drawdowns=readSnapshot('drawdowns')||{};render();});
 watchValuePairs(host);render();return {overview,refresh};
}
