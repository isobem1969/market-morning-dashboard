import {PERIODS,periodHigh,sectionOld} from './stocks-logic.js?v=six-pages-20261119-v1';
import {belowHigh} from './high-condition.js?v=selected-period-20261122-v2';
export {belowHigh} from './high-condition.js?v=selected-period-20261122-v2';
export function stockAlerts(stock,period,{generatedAt,offline=false,now=Date.now()}={}){
 const price=stock.price||{},highs=stock.highs||{},hits=[],unchecked=[],reasons=[];
 const dated=s=>Number.isFinite(Date.parse(s.lastSuccess))&&Date.parse(s.lastSuccess)<=now+60000;
 const priceUsable=dated(price)&&Number.isFinite(price.value)&&price.value>0;
 const reference=offline||sectionOld(price,generatedAt,now)||sectionOld(highs,generatedAt,now);
 const check=(key,label,high,usable)=>{
  if(!priceUsable||!usable||!Number.isFinite(high)||high<=0){unchecked.push(key);reasons.push(label+'：'+(!priceUsable?'価格または取得日時が未確認':'高値データが未取得'));return;}
  const hit=belowHigh(price.value,high);
  if(hit)hits.push({key,label,...hit,reference});
 };
 check('allTime',highs.allTime?.complete?'上場来':'取得期間内',highs.allTime?.value,dated(highs));
 if(highs.allTime?.complete!==true){if(!unchecked.includes('allTime'))unchecked.push('allTime');reasons.push('上場来：全履歴が未確認（取得期間内の高値で比較）');}
 for(const [key,label] of PERIODS)check(key,label,periodHigh(price,key).value,true);
 return {hits,unchecked,reasons,reference,period,active:hits.some(h=>h.key===period),hidden:hits.filter(h=>h.key!==period)};
}
