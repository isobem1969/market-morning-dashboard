const controls=document.createElement('div');
controls.id='page-scroll-controls';controls.hidden=true;
const path={up:'M12 19V5M5 12l7-7 7 7',down:'M12 5v14M5 12l7 7 7-7'};
function scrollButton(id,label,direction){
 const button=document.createElement('button');button.id=id;button.type='button';
 button.setAttribute('aria-label',label);button.title=label;
 button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="'+path[direction]+'" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
 controls.append(button);return button;
}
const up=scrollButton('back-to-top','最上部に戻る','up');
const down=scrollButton('go-to-bottom','最下部へ移動','down');
document.body.append(controls);
const bottom=()=>Math.max(document.documentElement.scrollHeight,document.body.scrollHeight)-window.innerHeight;
const update=()=>{
 const max=bottom();controls.hidden=max<=1;
 up.disabled=window.scrollY<=1;down.disabled=window.scrollY>=max-1;
};
window.addEventListener('scroll',update,{passive:true});
window.addEventListener('resize',update);
window.addEventListener('pageshow',update);
if('ResizeObserver' in window){const observer=new ResizeObserver(update);observer.observe(document.body);observer.observe(document.documentElement);}
for(const [button,to] of [[up,()=>0],[down,bottom]])button.addEventListener('click',()=>window.scrollTo({top:to(),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));
update();
