import {FUND_IDS} from './asset-pages.js?v=us-etf-20261123-v1';
import {fundAlertState} from './fund-panel.js?v=us-etf-20261123-v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function rangeOverviewState(metrics,ranges,quality){
 const items=metrics.map(m=>{const period=ranges.get(m.id)||'6m',q=quality(m),state=fundAlertState(m,period,q);return {m,period,q,state};});
 return {items,reached:items.filter(i=>i.q.usable&&i.state.selected?.hit),
         pending:items.filter(i=>!i.q.usable||!i.state.selected?.valid),
         references:items.filter(i=>!i.q.usable&&i.state.selected?.hit)};
}
export function fundsOverviewState(metrics,ranges,quality){return rangeOverviewState(metrics.filter(m=>FUND_IDS.includes(m.id)),ranges,quality);}
export function renderFundsOverview(host,model){
 if(!host)return;
 const {reached,pending,references}=model;
 host.className='overview funds-overview'+(reached.length?' alert':'');
 host.innerHTML='<div class="overview-top"><span class="eyebrow">あなたの条件チェック · 投資信託</span><span>確認 '+(model.items.length-pending.length)+'/'+model.items.length+'銘柄</span></div><h2>'+(reached.length?'🔴 指定条件に到達 · '+reached.length+'銘柄':pending.length?'判定できた範囲では条件到達なし':'選択期間の指定条件への到達なし')+'</h2><p>各銘柄で選択中の期間の最高値に対する80％・70％・60％・50％未満を判定します。期間を切り替えると、この一覧も更新します。上場来・取得履歴全体は含めません。</p><div class="funds-alert-list">'+reached.map(({m,state})=>'<a class="funds-alert-link" href="#metric-'+esc(m.id)+'"><strong>'+esc(m.name)+'</strong><span>'+esc(state.selected.text)+' ／ 下落率 '+(state.selected.hit.ratio-100).toFixed(2)+'％</span></a>').join('')+'</div>'+(pending.length?'<p class="funds-pending">更新・履歴を未確認：'+pending.map(i=>esc(i.m.name)).join(' ／ ')+'。未確認の銘柄を「条件外」には数えていません。</p>':'')+(references.length?'<details><summary>保存値で条件に該当する参考銘柄（'+references.length+'件）</summary>'+references.map(({m,state})=>'<p><a class="funds-alert-link" href="#metric-'+esc(m.id)+'">'+esc(m.name)+' · '+esc(state.selected.text)+' ／ 公表 '+esc(m.asOf)+'</a></p>').join('')+'</details>':'');
}
