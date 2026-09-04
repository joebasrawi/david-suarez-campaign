import {json, escape as e, date, thumbnailFallback} from './shared.js?v=468bf5ea8f';
const $=s=>document.querySelector(s);
async function init(){
 const {youtube,agenda,news}=await json('home-summary');
 if(youtube){const item=youtube.items.find(i=>i.series==='Suarez Sound Off')||youtube.items[0];if(item){
 $('#featured-title').textContent=item.title.replace(/^Suarez Sound Off\s*Ep\.\s*\d+\s*[—-]\s*/i,'').replace(/\s*\|.*$/,'');
 $('#featured-series').textContent=item.series;$('#featured-date').textContent=date(item.publishedAt);$('#featured-link').href='media/?video='+item.id;$('#featured-link').textContent='Watch episode';
 const image=$('#featured-image');image.src='https://i.ytimg.com/vi/'+item.id+'/maxresdefault.jpg';image.alt=item.title;image.dataset.video=item.id;thumbnailFallback();
 }}
 const cards=[];
 if(agenda){const m=agenda.nextMeeting;cards.push('<article class="official-item"><div><span class="official-label">Next commission agenda</span><h3>'+e(date(m.date))+'</h3><p>'+m.itemCount+' items for consideration</p><a href="commission-agenda/">Explore the agenda</a></div></article>');}
 if(news)news.items.slice(0,2).forEach(i=>cards.push('<article class="official-item"><div><span class="official-label">'+e(date(i.publishedAt,true))+'</span><h3>'+e(i.title)+'</h3><a href="'+e(i.url)+'" target="_blank" rel="noreferrer">Read announcement ↗</a></div></article>'));
 $('#official-updates').innerHTML=cards.join('')||'<p class="loading-copy">Updates could not be loaded. <a href="news/">Try city news</a>.</p>';

}
init().catch(error=>{console.error(error);$('#official-updates').innerHTML='<p class="loading-copy">Updates could not be loaded. <a href="news/">Open city news</a> or <a href="commission-agenda/">read the agenda</a>.</p>';}).finally(()=>document.dispatchEvent(new Event('page:ready')));

// The local background film never sends a visitor to YouTube or starts audio.
function initFilm(){
 const film=$('#hero-film'),control=$('#film-control');
 if(!film||!control)return;
 control.hidden=false;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const connection=navigator.connection;
 let wanted=!reduced.matches&&!connection?.saveData,visible=true;
 function label(){const playing=!film.paused;control.textContent=playing?'Pause video':'Play video';control.setAttribute('aria-label',playing?'Pause background video':'Play background video');}
 function sync(){
  if(!wanted||!visible||document.hidden){film.pause();label();return;}
  if(!film.getAttribute('src'))film.src=matchMedia('(max-width: 700px)').matches?film.dataset.mobileSrc:film.dataset.videoSrc;
  film.muted=true;
  film.play().catch(error=>{if(error.name!=='AbortError')wanted=false;label();});
 }
 control.addEventListener('click',()=>{wanted=film.paused;sync();});
 film.addEventListener('playing',()=>{film.closest('.coastal-hero').classList.add('is-playing');label();});
 film.addEventListener('pause',label);
 film.addEventListener('error',()=>{wanted=false;film.closest('.coastal-hero').classList.remove('is-playing');control.hidden=true;});
 document.addEventListener('visibilitychange',sync);
 reduced.addEventListener('change',()=>{if(reduced.matches){wanted=false;sync();}});
 connection?.addEventListener?.('change',()=>{if(connection.saveData){wanted=false;sync();}});
 if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:0.05}).observe(film.closest('.coastal-hero'));
 else sync();
 label();
}
initFilm();

function loadMapLibrary(){
 const load=(tag,attributes)=>new Promise((resolve,reject)=>{
  const el=document.createElement(tag);Object.assign(el,attributes);
  const timer=setTimeout(()=>reject(new Error('Map loading timed out')),12000);
  el.onload=()=>{clearTimeout(timer);resolve();};el.onerror=()=>{clearTimeout(timer);reject(new Error('Map unavailable'));};
  document.head.append(el);
 });
 return Promise.all([
  load('link',{rel:'stylesheet',href:'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',integrity:'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=',crossOrigin:''}),
  load('script',{src:'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',integrity:'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=',crossOrigin:''})
 ]);
}
async function initHomeMap(){
 const region=$('#home-project-map'),list=$('#home-project-list');
 const areas={south:{center:[25.782,-80.137],min:25.75,max:25.805},mid:{center:[25.824,-80.127],min:25.805,max:25.846},north:{center:[25.866,-80.132],min:25.846,max:25.89}};
 let items=[],map,markers,selected='south';
 const url=item=>'active-projects/?project='+encodeURIComponent(item.id);
 const clean=value=>value&&value!=='null'?value:'Project';
 function render(){
  const area=areas[selected];
  const projects=items.filter(i=>i.lat>=area.min&&i.lat<area.max).sort((a,b)=>(b.phase==='Construction')-(a.phase==='Construction')||a.title.localeCompare(b.title));
  const distinct=[...new Map(projects.map(i=>[i.projectNumber||i.title,i])).values()];
  list.innerHTML=distinct.slice(0,3).map(i=>'<a class="map-project-link" href="'+url(i)+'"><span>'+e(clean(i.phase))+'</span><strong>'+e(i.title)+' <span aria-hidden="true" class="project-arrow">↗</span></strong></a>').join('')||'<p class="source-note">No mapped projects in this area. Explore the full directory below.</p>';
  document.querySelectorAll('[data-area]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.area===selected)));
  if(!map)return;
  map.setView(area.center,13,{animate:!matchMedia('(prefers-reduced-motion: reduce)').matches});markers.clearLayers();
  projects.forEach(i=>{
   const marker=L.circleMarker([i.lat,i.lng],{radius:7,color:'#fff',weight:2,fillColor:'#096e69',fillOpacity:1}).addTo(markers);
   marker.bindPopup('<strong>'+e(i.title)+'</strong><br>'+e(clean(i.phase))+'<a href="'+url(i)+'">View project details ↗</a>');
   // Avoid dozens of map tab stops; the adjacent links and directory provide keyboard access.
  });
 }
 document.querySelectorAll('[data-area]').forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.area;render();}));
 try{
  const data=await json('city-projects');items=data.items.filter(i=>Number.isFinite(i.lat)&&Number.isFinite(i.lng));render();
 }catch{list.innerHTML='<p class="source-note">Project updates are unavailable. You can still open the full directory.</p>';region.innerHTML='<div class="map-loading"><p>The project map is unavailable.</p><a href="active-projects/">Open the project directory</a></div>';region.setAttribute('aria-busy','false');return;}
 try{
  await loadMapLibrary();region.replaceChildren();
  map=L.map(region,{scrollWheelZoom:false,dragging:!matchMedia('(pointer: coarse)').matches,tap:false});
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
  markers=L.layerGroup().addTo(map);render();
 }catch{region.innerHTML='<div class="map-loading"><p>The map is unavailable right now.</p><a href="active-projects/">Browse the project directory</a></div>';}
 finally{region.setAttribute('aria-busy','false');}
}
const mapRegion=$('#home-project-map');
if(mapRegion){
 if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();initHomeMap();}},{rootMargin:'300px'});observer.observe(mapRegion);}
 else initHomeMap();
}
