export function changePercent(m){
 if(!Number.isFinite(m.change))return null;
 if(Number.isFinite(m.changePct))return m.changePct;
 const previous=m.value-m.change;
 return Number.isFinite(m.value)&&previous>0?m.change/previous*100:null;
}
export function percentLine(pct){return Number.isFinite(pct)?'<span class="change-pct">('+(pct>0?'+':'')+pct.toFixed(2)+'%)</span>':'';}
