import {renderHomeVideos} from './home-videos.js?v=482f56434d';
import {json, escape as e, date, newsExcerpt, commissionStatus} from './shared.js?v=f6b5f20337';
import {phaseColor,legendMarkup,pointInFeature,neighborhoods,installBasemap,boundaryLayer,groupMapPoints} from './city-map.js?v=094b460af6';
const $=s=>document.querySelector(s);
async function init(){
 const {youtube,agenda,news}=await json('home-summary');
 renderHomeVideos(youtube?.items);
 const cards=[];
 if(agenda){const m=agenda.nextMeeting,s=commissionStatus(agenda,agenda.commissionMeetings),show=s.date||m.date;const d=new Date(show+'T12:00:00');const label=s.posted||s.date?'Your next commission meeting':'Most recent commission meeting';const body=s.posted?'<h3>'+m.itemCount+' items for consideration.</h3><a href="commission-agenda/">See what’s on the agenda ↗</a>':s.date?'<h3>Agenda not posted yet.</h3><a href="commission-agenda/">Review the '+e(date(m.date,true))+' agenda ↗</a>':'<h3>'+m.itemCount+' items were considered.</h3><a href="commission-agenda/">Review that agenda ↗</a>';cards.push('<article class="official-item agenda-preview"><span class="official-label">'+label+'</span><time class="meeting-date-art" datetime="'+e(show)+'">'+e(d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}))+'</time><div>'+body+'</div></article>');}
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
 function label(){
  const playing=!film.paused,label=playing?'Pause background video':'Play background video';
  control.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="currentColor">'+(playing?'<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>':'<path d="M8 5v14l11-7z"/>')+'</svg>';
  control.setAttribute('aria-label',label);control.setAttribute('title',label);
 }
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
 let visibleProjects=[];
 function drawMarkers(){
  if(!map||!markers)return;
  markers.clearLayers();
  for(const group of groupMapPoints(map,visibleProjects)){
   if(group.length===1){
    const i=group[0];
    L.circleMarker([i.lat,i.lng],{radius:5,color:'#17343c',weight:1.5,fillColor:phaseColor(i),fillOpacity:1}).addTo(markers)
     .bindPopup('<strong>'+e(i.title)+'</strong><br>'+e(i.sourceLayer?.phase||i.phase)+'<a href="'+url(i)+'">View project details ↗</a>');
   }else{
    const center=[group.reduce((n,i)=>n+i.lat,0)/group.length,group.reduce((n,i)=>n+i.lng,0)/group.length];
    const marker=L.marker(center,{icon:L.divIcon({className:'project-cluster',html:'<span>'+group.length+'</span>',iconSize:[34,34],iconAnchor:[17,17]}),title:group.length+' project features. Zoom in to explore.',alt:group.length+' project features'}).addTo(markers);
    if(map.getZoom()<17)marker.on('click',()=>map.fitBounds(group.map(i=>[i.lat,i.lng]),{padding:[50,50],maxZoom:Math.min(17,map.getZoom()+2),animate:!matchMedia('(prefers-reduced-motion: reduce)').matches}));
    else marker.bindPopup('<strong>'+group.length+' project features</strong><ul>'+group.map(i=>'<li><a href="'+url(i)+'">'+e(i.title)+'</a></li>').join('')+'</ul>');
   }
  }
 }
 function render(){
  const selected=areas.find(f=>f.properties.name===picker.value);
  const projects=items.filter(i=>!selected||pointInFeature(i,selected)).sort((a,b)=>(b.sourceLayer?.phase==='Construction')-(a.sourceLayer?.phase==='Construction')||a.title.localeCompare(b.title));
  const distinct=[...new Map(projects.map(i=>[i.projectNumber||i.title,i])).values()];
  $('#home-map-count').textContent=projects.length+(projects.length===1?' mapped feature':' mapped features')+(selected?' in '+selected.properties.name:' across Miami Beach');
  list.innerHTML=distinct.slice(0,3).map(i=>'<a class="map-project-link" href="'+url(i)+'"><span><i class="phase-dot" style="--marker:'+phaseColor(i)+'"></i>'+e(i.sourceLayer?.phase||i.phase||'Project')+'</span><strong>'+e(i.title)+' <span aria-hidden="true" class="project-arrow">↗</span></strong></a>').join('')||'<p class="source-note">No project points fall inside this neighborhood in the saved feed. Larger projects may cross its boundary.</p>';
  $('#home-map-link').href='active-projects/'+(selected?'?area='+encodeURIComponent(selected.properties.name):'');
  if(!map)return;
  visibleProjects=projects;
  boundaries?.remove();boundaries=boundaryLayer(map,selected?[selected]:[],choose);
  if(selected)map.fitBounds(boundaries.getBounds(),{padding:[32,32],maxZoom:15,animate:!matchMedia('(prefers-reduced-motion: reduce)').matches});
  else map.fitBounds([[25.758,-80.17],[25.877,-80.113]],{padding:[15,15]});
  drawMarkers();
 }
 picker.addEventListener('change',render);
 $('#home-map-legend').innerHTML=legendMarkup()+'<p class="source-note">Numbers group nearby project features. Select a number to zoom in.</p>';
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
  installBasemap(map);markers=L.layerGroup().addTo(map);map.on('zoomend',drawMarkers);render();
 }catch{region.innerHTML='<div class="map-loading"><p>The map is unavailable right now.</p><a href="active-projects/">Browse the project directory</a></div>';}
 finally{region.setAttribute('aria-busy','false');}
}
const mapRegion=$('#home-project-map');
if(mapRegion){
 if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();initHomeMap();}},{rootMargin:'300px'});observer.observe(mapRegion);}
 else initHomeMap();
}

// Stay informed: posts to the signup Worker, which adds the person to iContact.
// The same form shows inline on the page and in a popup a few seconds after arrival.
const SIGNUP_KEY='suarez-signup';
function signupMemory(){try{return JSON.parse(localStorage.getItem(SIGNUP_KEY)||'{}');}catch{return {};}}
function remember(value){try{localStorage.setItem(SIGNUP_KEY,JSON.stringify(value));}catch{}}
function bindSignup(form,endpoint,onSuccess){
 const status=form.querySelector('.signup-status'),button=form.querySelector('button[type="submit"]');
 const messages={first_name:'Please enter your first name.',email:'Please enter a valid email address.',phone:'Please enter a valid phone number, or leave it blank.',sms_phone:'Add your mobile number to get text messages.'};
 const say=(text,state)=>{status.textContent=text;status.dataset.state=state||'';};
 function check(data){
  if(!data.firstName.trim())return 'first_name';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email.trim()))return 'email';
  const digits=data.phone.replace(/\D/g,'');
  if(data.phone.trim()&&(digits.length<10||digits.length>15))return 'phone';
  if(data.smsConsent&&!data.phone.trim())return 'sms_phone';
  return '';
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const data=Object.fromEntries(new FormData(form));
  const problem=check(data);
  if(problem){say(messages[problem],'error');form.elements[problem==='first_name'?'firstName':problem==='sms_phone'?'phone':problem].focus();return;}
  if(!endpoint){say('Sign-ups aren’t connected yet.','error');return;}
  button.disabled=true;say('Signing you up…');
  try{
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
   const result=await response.json().catch(()=>({}));
   if(response.ok&&result.ok){form.reset();say('Thanks! You’re signed up.','success');remember({signedUp:true});onSuccess?.();}
   else say(messages[result.error]||'Something went wrong. Please try again.','error');
  }catch{say('Something went wrong. Please try again.','error');}
  finally{button.disabled=false;}
 });
}
function initSignupPopup(section,endpoint){
 if(typeof HTMLDialogElement!=='function')return;
 const memory=signupMemory(),params=new URLSearchParams(location.search);
 const snoozed=memory.dismissedAt&&Date.now()-memory.dismissedAt<14*864e5;
 const dialog=document.createElement('dialog');
 dialog.className='signup-popup';
 dialog.setAttribute('aria-labelledby','signup-popup-title');
 dialog.innerHTML='<button class="signup-close" type="button" aria-label="Close">×</button><h2 id="signup-popup-title">Stay informed</h2><p class="signup-lede">Get updates from David on what’s happening in Miami Beach.</p>';
 const form=section.querySelector('form').cloneNode(true);
 form.querySelector('.signup-status').textContent='';
 dialog.append(form);
 document.body.append(dialog);
 const close=()=>{if(dialog.open)dialog.close();};
 dialog.addEventListener('close',()=>{if(!signupMemory().signedUp)remember({dismissedAt:Date.now()});});
 dialog.querySelector('.signup-close').addEventListener('click',close);
 dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
 bindSignup(form,endpoint,()=>setTimeout(close,2200));
 function open(){
  if(dialog.open)return;
  document.querySelector('dialog[open]')?.close();
  dialog.showModal();
  // On touch screens, don't pop the keyboard before they've chosen to sign up.
  if(matchMedia('(pointer: fine)').matches)form.elements.firstName.focus({preventScroll:true});
  else{dialog.tabIndex=-1;dialog.focus({preventScroll:true});}
 }
 // The "Stay informed" menu link opens the popup here; from other pages it lands on /#stay-informed.
 document.querySelectorAll('[data-signup-open]').forEach(link=>link.addEventListener('click',event=>{
  event.preventDefault();
  const menu=document.querySelector('[data-menu][aria-expanded="true"]');
  if(menu)menu.click();
  open();
 }));
 if(location.hash==='#stay-informed'||params.get('signup')==='popup'){
  history.replaceState(null,'',location.pathname+location.search);
  setTimeout(open,300);
  return;
 }
 if(memory.signedUp||snoozed)return;
 setTimeout(()=>{
  // Don't interrupt someone already filling in the inline form or another dialog.
  if(section.contains(document.activeElement)||document.querySelector('dialog[open]')||signupMemory().signedUp)return;
  open();
 },5000);
}
function initSignup(){
 const section=$('#stay-informed');
 if(!section)return;
 const endpoint=section.dataset.signupEndpoint,mode=new URLSearchParams(location.search).get('signup');
 const preview=mode==='preview'||mode==='popup';
 if(!endpoint&&!preview)return;
 section.hidden=false;
 initSignupPopup(section,endpoint);
 bindSignup(section.querySelector('form'),endpoint);
}
initSignup();
