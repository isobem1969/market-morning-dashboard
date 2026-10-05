export function quality(m, now=Date.now(), pipeline=null, offline=false) {
  if (!Number.isFinite(m.value) || !m.asOf) return {usable:false,label:'未取得'};
  if (offline) return {usable:false,label:'オフライン・保存データ'};
  if (m.status==='error') return {usable:false,label:'取得失敗・前回値'};
  if (!['ok','manual'].includes(m.status)) return {usable:false,label:'取得状況を確認してください'};
  const date=Date.parse(m.asOf.length===10 ? `${m.asOf}T23:59:59+09:00` : m.asOf);
  if (!Number.isFinite(date) || date>now+86400000) return {usable:false,label:'日時を確認してください'};
  if (now-date>4*86400000) return {usable:false,label:'公表から4日超・参考値'};
  if (m.status!=='manual' && (!pipeline || now-Date.parse(pipeline)>30*3600000 || !Number.isFinite(Date.parse(pipeline)))) return {usable:false,label:'取得処理が30時間以上未更新'};
  return {usable:true,label:m.status==='manual'?'手入力・CNNで確認した値':'取得成功'};
}
export function signal(id,value) {
  if (!Number.isFinite(value)) return {tone:'',text:'判定できません'};
  if (id==='vix') return value>=50?{tone:'alert',text:'条件到達 · VIX ≥ 50'}:value>=40?{tone:'alert',text:'条件到達 · VIX ≥ 40'}:value>=30?{tone:'alert',text:'条件到達 · VIX ≥ 30'}:value>=20?{tone:'watch',text:'警戒 · VIX ≥ 20'}:{tone:'',text:'VIX < 20'};
  if (id==='fear') return value<20?{tone:'alert',text:'条件到達 · 20未満'}:{tone:'',text:value<45?'恐怖寄り':value<=55?'中立': '欲望寄り'};
  if (id==='vi') return value>=50?{tone:'alert',text:'条件到達 · VI ≥ 50'}:{tone:'',text:'VI < 50'};
  if (id==='brent') return value>=100?{tone:'watch',text:'原油 ≥ 100ドル'}:{tone:'',text:'ブレント期近先物'};
  return {tone:'',text:id==='usd'?'円換算への影響を確認':'投資信託の公表価格'};
}
export function overall(metrics, now, pipeline, offline=false) {
  const keys=['vix','fear','vi'];
  const usable=metrics.filter(m=>keys.includes(m.id)&&quality(m,now,pipeline,offline).usable);
  const alerts=usable.filter(m=>signal(m.id,m.value).tone==='alert');
  if(alerts.length) return {tone:'alert',title:'🔴 指定条件に到達',detail:alerts.map(m=>m.name).join('・')+' が条件に達しています。'+(usable.length<3?'未確認の指標もあります。':''),count:usable.length};
  if(usable.length<3) return {tone:'',title:'判定保留 · データ不足',detail:'未取得・取得失敗・古いデータがあります。取得できた指標の値と公表日を確認してください。',count:usable.length};
  if(usable.some(m=>signal(m.id,m.value).tone==='watch'))return {tone:'watch',title:'🟡 VIXが警戒域',detail:'VIXは20以上30未満。赤色の指定条件には達していません。',count:usable.length};
  return {tone:'',title:'指定条件への到達なし',detail:'確認できた3指標は、赤色の指定条件には達していません。',count:usable.length};
}

export const VIX_BANDS=[
  {key:'calm',min:0,max:15,range:'10〜15',label:'平穏',color:'#16886f'},
  {key:'normal',min:15,max:20,range:'15〜20',label:'スタンダード',color:'#2563b8'},
  {key:'watch',min:20,max:30,range:'20〜30',label:'警戒ゾーン',color:'#a46b08'},
  {key:'fear',min:30,max:40,range:'30〜40',label:'恐怖ゾーン',color:'#c35d12'},
  {key:'panic',min:40,max:Infinity,range:'40以上',label:'パニック状態',color:'#bc303c'},
];
export function vixBand(value){
  return Number.isFinite(value)&&value>=0?VIX_BANDS.find(b=>value>=b.min&&value<b.max):null;
}
export function selectVixHistory(points,months=12){
  const clean=new Map();
  for(const p of points||[]){
    if(!Number.isFinite(p.value)||p.value<0||!/^\d{4}-\d{2}-\d{2}$/.test(p.date))continue;
    const t=Date.parse(p.date+'T00:00:00Z');
    if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==p.date)continue;
    clean.set(p.date,{date:p.date,value:p.value});
  }
  const sorted=[...clean.values()].sort((a,b)=>a.date.localeCompare(b.date));
  if(!sorted.length)return [];
  const cutoff=new Date(sorted.at(-1).date+'T00:00:00Z'),day=cutoff.getUTCDate();
  cutoff.setUTCDate(1);cutoff.setUTCMonth(cutoff.getUTCMonth()-months);
  const lastDay=new Date(Date.UTC(cutoff.getUTCFullYear(),cutoff.getUTCMonth()+1,0)).getUTCDate();
  cutoff.setUTCDate(Math.min(day,lastDay));
  const start=cutoff.toISOString().slice(0,10);
  return sorted.filter(p=>p.date>=start);
}
