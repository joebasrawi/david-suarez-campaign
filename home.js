import {json, escape as e, date, thumbnailFallback, newsExcerpt} from './shared.js?v=da4eebcc5e';
import {phaseColor,legendMarkup,pointInFeature,neighborhoods,installBasemap,boundaryLayer} from './city-map.js?v=e410b87006';
const $=s=>document.querySelector(s);
async function init(){
 const {youtube,agenda,news}=await json('home-summary');
 if(youtube){const item=youtube.items.find(i=>i.series==='Suarez Sound Off')||youtube.items[0];if(item){
 $('#featured-title').textContent=item.title.replace(/^Suarez Sound Off\s*Ep\.\s*\d+\s*[—-]\s*/i,'').replace(/\s*\|.*$/,'');
 $('#featured-series').textContent=item.series;$('#featured-date').textContent=date(item.publishedAt);$('#featured-link').href='media/?video='+item.id;$('#featured-link').textContent='Watch episode';
 const image=$('#featured-image');image.src='https://i.ytimg.com/vi/'+item.id+'/maxresdefault.jpg';image.alt=item.title;image.dataset.video=item.id;thumbnailFallback();
 }}
 const cards=[];
 if(agenda){const m=agenda.nextMeeting;const d=new Date(m.date+'T12:00:00');cards.push('<article class="official-item agenda-preview"><span class="official-label">Your next commission meeting</span><time class="meeting-date-art" datetime="'+e(m.date)+'"><span>'+d.toLocaleDateString('en-US',{month:'long'})+'</span><strong>'+d.getDate()+'</strong></time><div><h3>'+m.itemCount+' items for consideration.</h3><a href="commission-agenda/">See what’s on the agenda ↗</a></div></article>');}
 if(news)news.items.slice(0,2).forEach(i=>cards.push('<article class="official-item news-preview"><span class="official-label">City announcement · '+e(date(i.publishedAt,true))+'</span><div><h3>'+e(i.title)+'</h3><p>'+e(newsExcerpt(i.summary))+'</p></div><a href="'+e(i.url)+'" target="_blank" rel="noreferrer">Read announcement ↗</a></article>'));
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
  film.autoplay=wanted&&visible&&!document.hidden;
  if(!wanted||!visible||document.hidden){film.pause();label();return;}
  film.muted=true;
  film.defaultMuted=true;
  film.playsInline=true;
  if(!film.getAttribute('src'))film.src=matchMedia('(max-width: 700px)').matches?film.dataset.mobileSrc:film.dataset.videoSrc;
  // A browser policy rejection is not a visitor choosing Pause. Keep their
  // intent so returning to the tab or interacting with the page can retry.
  film.play().catch(()=>label());
 }
 control.addEventListener('click',()=>{wanted=film.paused;sync();});
 film.addEventListener('playing',()=>{film.closest('.coastal-hero').classList.add('is-playing');label();});
 film.addEventListener('pause',label);
 film.addEventListener('error',()=>{wanted=false;film.closest('.coastal-hero').classList.remove('is-playing');control.hidden=true;});
 document.addEventListener('visibilitychange',sync);
 window.addEventListener('pageshow',sync);
 const retry=event=>{if(wanted&&film.paused&&!control.contains(event.target))sync();};
 document.addEventListener('pointerdown',retry);
 document.addEventListener('keydown',retry);
 reduced.addEventListener('change',()=>{if(reduced.matches){wanted=false;sync();}});
 connection?.addEventListener?.('change',()=>{if(connection.saveData){wanted=false;sync();}});
 if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:0.05}).observe(film.closest('.coastal-hero'));
 // Start immediately; the observer only suspends playback when offscreen.
 sync();
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
 const region=$('#home-project-map'),list=$('#home-project-list'),picker=$('#home-neighborhood');
 let items=[],areas=[],map,markers,boundaries;
 const url=item=>'active-projects/?project='+encodeURIComponent(item.id);
 const choose=feature=>{picker.value=feature.properties.name;render();};
 function render(){
  const selected=areas.find(f=>f.properties.name===picker.value);
  const projects=items.filter(i=>!selected||pointInFeature(i,selected)).sort((a,b)=>(b.sourceLayer?.phase==='Construction')-(a.sourceLayer?.phase==='Construction')||a.title.localeCompare(b.title));
  const distinct=[...new Map(projects.map(i=>[i.projectNumber||i.title,i])).values()];
  $('#home-map-count').textContent=projects.length+(projects.length===1?' mapped feature':' mapped features')+(selected?' in '+selected.properties.name:' across Miami Beach');
  list.innerHTML=distinct.slice(0,3).map(i=>'<a class="map-project-link" href="'+url(i)+'"><span><i class="phase-dot" style="--marker:'+phaseColor(i)+'"></i>'+e(i.sourceLayer?.phase||i.phase||'Project')+'</span><strong>'+e(i.title)+' <span aria-hidden="true" class="project-arrow">↗</span></strong></a>').join('')||'<p class="source-note">No project points fall inside this neighborhood in the saved feed. Larger projects may cross its boundary.</p>';
  $('#home-map-link').href='active-projects/'+(selected?'?area='+encodeURIComponent(selected.properties.name):'');
  if(!map)return;
  boundaries?.remove();boundaries=boundaryLayer(map,selected?[selected]:areas,choose);
  if(selected)map.fitBounds(boundaries.getBounds(),{padding:[32,32],maxZoom:15,animate:!matchMedia('(prefers-reduced-motion: reduce)').matches});
  else map.fitBounds([[25.758,-80.17],[25.877,-80.113]],{padding:[15,15]});
  markers.clearLayers();
  projects.forEach(i=>{
   const marker=L.circleMarker([i.lat,i.lng],{radius:6,color:'#132f38',weight:2,fillColor:phaseColor(i),fillOpacity:1}).addTo(markers);
   marker.bindPopup('<strong>'+e(i.title)+'</strong><br>'+e(i.sourceLayer?.phase||i.phase)+'<a href="'+url(i)+'">View project details ↗</a>');
  });
 }
 picker.addEventListener('change',render);
 $('#home-map-legend').innerHTML=legendMarkup();
 try{
  const [data,geography]=await Promise.all([json('city-projects'),json('neighborhoods').catch(()=>null)]);
  items=data.items.filter(i=>Number.isFinite(i.lat)&&Number.isFinite(i.lng));
  if(geography){areas=neighborhoods(geography);picker.innerHTML='<option value="all">All Miami Beach</option>'+areas.map(f=>'<option>'+e(f.properties.name)+'</option>').join('');}
  else {picker.disabled=true;$('#home-map-legend').insertAdjacentHTML('beforeend','<p class="source-note">Neighborhood boundaries are temporarily unavailable.</p>');}
  render();
 }catch{list.innerHTML='<p class="source-note">Project updates are unavailable. Open the full directory below.</p>';region.innerHTML='<div class="map-loading">Project data could not load.</div>';region.setAttribute('aria-busy','false');return;}
 try{
  await loadMapLibrary();region.replaceChildren();
  map=L.map(region,{scrollWheelZoom:false,dragging:!matchMedia('(pointer: coarse)').matches,tap:false});
  installBasemap(map);markers=L.layerGroup().addTo(map);render();
 }catch{region.innerHTML='<div class="map-loading"><p>The map is unavailable right now.</p><a href="active-projects/">Browse the project directory</a></div>';}
 finally{region.setAttribute('aria-busy','false');}
}
const mapRegion=$('#home-project-map');
if(mapRegion){
 if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();initHomeMap();}},{rootMargin:'300px'});observer.observe(mapRegion);}
 else initHomeMap();
}
