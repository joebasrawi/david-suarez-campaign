// Muted background footage; the still image remains for reduced-motion visitors.
const film=document.querySelector('#resident-film');
const control=document.querySelector('#resident-film-control');
if(film&&control){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const connection=navigator.connection;
 let wanted=!reduced.matches&&!connection?.saveData,visible=true;
 function label(){
  const playing=!film.paused,text=playing?'Pause background video':'Play background video';
  control.setAttribute('aria-label',text);control.title=text;
  control.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">'+(playing?'<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>':'<path d="M8 5v14l11-7z"/>')+'</svg>';
 }
 function sync(){
  film.autoplay=wanted&&visible&&!document.hidden;
  if(!film.autoplay){film.pause();label();return;}
  film.muted=true;film.defaultMuted=true;film.playsInline=true;
  if(!film.getAttribute('src'))film.src=film.dataset.src;
  film.play().catch(label);
 }
 control.hidden=false;
 control.addEventListener('click',()=>{wanted=film.paused;sync();});
 film.addEventListener('playing',label);film.addEventListener('pause',label);
 film.addEventListener('error',()=>{wanted=false;film.removeAttribute('src');film.load();control.hidden=true;});
 document.addEventListener('visibilitychange',sync);window.addEventListener('pageshow',sync);
 document.addEventListener('pointerdown',event=>{if(wanted&&film.paused&&!control.contains(event.target))sync();});
 reduced.addEventListener('change',()=>{if(reduced.matches){wanted=false;sync();}});
 connection?.addEventListener?.('change',()=>{if(connection.saveData){wanted=false;sync();}});
 if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:.05}).observe(film);
 sync();label();
}
