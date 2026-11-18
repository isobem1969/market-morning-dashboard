export function headerDateMarkup(date=new Date()){
 const parts=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'numeric',day:'numeric',weekday:'short'}).formatToParts(date);
 const value=type=>parts.find(p=>p.type===type)?.value||'';
 const weekday=value('weekday'),tone=weekday==='土'?'is-saturday':weekday==='日'?'is-sunday':'is-weekday';
 return '<span class="header-calendar-date">'+value('year')+'年'+value('month')+'月'+value('day')+'日</span><span class="header-weekday">（<span class="'+tone+'">'+weekday+'</span>）</span>';
}
export function updateHeaderDate(date=new Date()){
 const el=document.getElementById('today');if(!el)return;
 const markup=headerDateMarkup(date);if(el.innerHTML!==markup)el.innerHTML=markup;
 el.setAttribute('datetime',new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date));
}
if(typeof document!=='undefined'){
 updateHeaderDate();
 setInterval(()=>{if(!document.hidden)updateHeaderDate();},60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateHeaderDate();});
 const button=document.querySelector('.header-refresh');
 if(button){
  const sync=()=>button.setAttribute('aria-busy',String(button.disabled));
  sync();new MutationObserver(sync).observe(button,{attributes:true,attributeFilter:['disabled']});
  button.addEventListener('click',()=>updateHeaderDate());
 }
}

// Keep previously saved links working after moving fund panels.
if(typeof location!=='undefined'&&/\/#metric-(nasdaq|tqqq|soxl)$/.test(location.pathname+location.hash))location.replace('./funds.html'+location.hash);
