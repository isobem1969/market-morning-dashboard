import {PERIODS,periodHigh,sectionOld} from './stocks-logic.js?v=period-high-20261009';
export function belowHigh(value,high){
 if(!Number.isFinite(value)||value<=0||!Number.isFinite(high)||high<=0)return null;
 const threshold=[50,60,70,80].find(t=>value*100<high*t);
 return threshold?{threshold,ratio:value/high*100}:null;
}
export function stockAlerts(stock,period,{generatedAt,offline=false,now=Date.now()}={}){
 const price=stock.price||{},highs=stock.highs||{},hits=[],unchecked=[];
 const priceUsable=!offline&&!sectionOld(price,generatedAt,now)&&Number.isFinite(price.value)&&price.value>0;
 const check=(key,label,high,usable)=>{
  if(!priceUsable||!usable||!Number.isFinite(high)||high<=0){unchecked.push(key);return;}
  const hit=belowHigh(price.value,high);
  if(hit)hits.push({key,label,...hit});
 };
 const highTime=Date.parse(highs.lastSuccess);
 check('allTime','上場来',highs.allTime?.value,highs.allTime?.complete===true&&highs.status==='ok'&&Number.isFinite(highTime)&&highTime<=now+86400000&&now-highTime<=4*86400000);
 for(const [key,label] of PERIODS)check(key,label,periodHigh(price,key).value,true);
 return {hits,unchecked,active:hits.some(h=>h.key==='allTime'||h.key===period),hidden:hits.filter(h=>h.key!=='allTime'&&h.key!==period)};
}
