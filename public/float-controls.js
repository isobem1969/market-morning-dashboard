const button=document.createElement('button');
button.id='back-to-top';button.type='button';button.hidden=true;
button.setAttribute('aria-label','最上部に戻る');button.title='最上部に戻る';
button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
document.body.append(button);
const update=()=>{button.hidden=window.scrollY<200;};
window.addEventListener('scroll',update,{passive:true});
window.addEventListener('pageshow',update);update();
button.addEventListener('click',()=>{window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
