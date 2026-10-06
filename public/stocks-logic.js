export const PERIODS=[['1d','1日'],['1w','1週'],['1m','1カ月'],['6m','6カ月'],['1y','1年'],['2y','2年']];
export function validPoints(points){return (Array.isArray(points)?points:[]).filter(p=>Number.isFinite(p.time)&&Number.isFinite(p.value)&&p.value>0).sort((a,b)=>a.time-b.time);}
export function nyDate(time){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time*1000));}
export function selectPoints(price,period){
  let points=validPoints(['1d','1w'].includes(period)?price.intraday:price.daily);
  if(!points.length)return [];
  const end=nyDate(points.at(-1).time);
  if(period==='1d')return points.filter(p=>nyDate(p.time)===end);
  const date=new Date(`${end}T12:00:00Z`);
  if(period==='1w')date.setUTCDate(date.getUTCDate()-6);
  else{
    const months=({'1m':1,'6m':6,'1y':12,'2y':24})[period]??6;
    const day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()-months);
    const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();date.setUTCDate(Math.min(day,last));
  }
  const cutoff=date.toISOString().slice(0,10);return points.filter(p=>nyDate(p.time)>=cutoff);
}
export function sectionOld(section,generatedAt,now=Date.now()){
  return Boolean(section.status!=='ok'||!Number.isFinite(Date.parse(section.lastSuccess))||now-Date.parse(section.lastSuccess)>90*60e3||!Number.isFinite(Date.parse(generatedAt))||now-Date.parse(generatedAt)>90*60e3||(section.asOf&&now-Date.parse(section.asOf)>4*86400e3)||(section.marketOpen&&now-Date.parse(section.asOf)>45*60e3));
}
