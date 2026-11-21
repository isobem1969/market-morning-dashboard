// Strict boundaries shared by every price/high comparison.
export function belowHigh(value,high){
 if(!Number.isFinite(value)||value<=0||!Number.isFinite(high)||high<=0)return null;
 const threshold=[50,60,70,80].find(t=>value*100<high*t);
 return threshold?{threshold,ratio:value/high*100}:null;
}
export function highCondition(value,high,{reference=false,label='最高値',available=true}={}){
 const valid=available&&Number.isFinite(value)&&value>0&&Number.isFinite(high)&&high>0;
 const hit=valid?belowHigh(value,high):null;
 return {hit,valid,reference,label,text:!valid?'判定不可 · 高値または価格が未取得':(reference?'保存値の判定 · ':'')+label+'の'+(hit?hit.threshold+'％未満 · 条件到達':'80％以上 · 条件外')+'（表示値'+(value/high*100).toFixed(1)+'％）'};
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function conditionMarkup(state){return '<p class="high-condition '+(state.hit?'is-hit':state.valid?'is-clear':'is-unknown')+'" data-threshold="'+(state.hit?.threshold||'')+'"'+(state.reference?' data-reference="true"':'')+'>'+esc(state.text)+'</p>';}

export function signalMarkup(sig,q){return '<p class="high-condition '+(sig.tone==='alert'?'is-hit':'is-clear')+'"'+(!q.usable?' data-reference="true"':'')+'>'+(q.usable?'':'保存値の判定 · ')+esc(sig.text)+(!q.usable?' · '+esc(q.label):'')+'</p>';}
