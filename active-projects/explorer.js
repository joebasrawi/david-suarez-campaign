import {json,escape as e,matches,date,sourceLink} from '../shared.js?v=da4eebcc5e';
import {phaseColor,legendMarkup,pointInFeature,neighborhoods,installBasemap,boundaryLayer} from '../city-map.js?v=094b460af6';
const $=s=>document.querySelector(s),params=new URLSearchParams(location.search);
const state={dataset:'works',datasets:{},areas:[],selected:params.get('project'),center:null,map:null,markers:null,markerIndex:new Map(),boundary:null};
const clean=v=>v&&String(v).toLowerCase()!=='null'?String(v):'';
const distance=(a,b)=>{const r=x=>x*Math.PI/180,dlat=r(b.lat-a.lat),dlng=r(b.lng-a.lng);return 3958.8*2*Math.atan2(Math.sqrt(Math.sin(dlat/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dlng/2)**2),Math.sqrt(1-(Math.sin(dlat/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dlng/2)**2)));};
const area=()=>state.areas.find(f=>f.properties.name===$('#project-neighborhood').value);
function items(){
 return (state.datasets[state.dataset]?.items||[]).filter(i=>
  matches($('#project-search').value,[i.title,i.description,i.neighborhood,i.corridor,i.limits].join(' '))&&
  (!area()||pointInFeature(i,area()))&&
  ($('#project-phase').value==='all'||i.phase===$('#project-phase').value)&&
  (!state.center||Number.isFinite(i.lat)&&Number.isFinite(i.lng)&&distance(state.center,i)<=Number($('#project-radius').value))
 ).sort((a,b)=>state.center?distance(state.center,a)-distance(state.center,b):a.title.localeCompare(b.title));
}
function filters(){
 const data=state.datasets[state.dataset]?.items||[];
 $('#project-phase').innerHTML='<option value="all">All phases</option>'+[...new Set(data.map(i=>i.phase).filter(Boolean))].sort().map(v=>'<option>'+e(v)+'</option>').join('');
 $('#project-source').textContent=state.datasets[state.dataset]?.note||'This source could not be loaded. Choose another source above.';
}
function syncUrl(){
 const p=new URLSearchParams();
 if(state.selected)p.set('project',state.selected);
 if(state.dataset!=='works')p.set('dataset',state.dataset);
 if(area())p.set('area',area().properties.name);
 if($('#project-search').value)p.set('q',$('#project-search').value);
 if($('#project-phase').value!=='all')p.set('phase',$('#project-phase').value);
 history.replaceState(null,'',location.pathname+(p.size?'?'+p:''));
}
function select(id,move=false){
 const item=state.datasets[state.dataset]?.items.find(i=>i.id===id);if(!item)return;
 state.selected=id;
 document.querySelectorAll('[data-project]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.project===id)));
 state.markerIndex.forEach((marker,key)=>marker.setStyle({radius:key===id?7:4,weight:key===id?2:1,color:key===id?'#17343c':'#ffffff'}));
 state.markerIndex.get(id)?.bringToFront();
 const fact=(label,value)=>value?'<div><dt>'+label+'</dt><dd>'+e(value)+'</dd></div>':'';
 $('#project-detail').innerHTML='<div class="project-detail-heading"><div><span class="chapter-label">'+e(item.phase||'Project')+'</span><h2>'+e(item.title)+'</h2></div><div class="button-row">'+sourceLink(item.link||state.datasets[state.dataset].source,'Open project source')+'<button class="hub-button secondary" data-copy-link>Copy link</button></div></div><div class="project-detail-body"><p>'+e(item.description||'The saved source does not include a description. Open the project source for details.')+'</p><dl>'+fact('Source neighborhood',item.neighborhood||'Not specified')+fact('Phase / status',[item.phase,item.status].filter(Boolean).join(' · '))+fact('Department',item.department)+fact('Project limits',item.limits)+fact('Project number',item.projectNumber)+fact('Start listed in source',item.startDate?date(item.startDate):'')+fact('End listed in source',item.endDate?date(item.endDate):'')+(item.totalNeed?'<div><dt>Estimated need in source</dt><dd>'+new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(item.totalNeed)+'<br>Not confirmed funding</dd></div>':'')+'</dl></div>';
 syncUrl();
 if(move&&state.map&&Number.isFinite(item.lat)&&Number.isFinite(item.lng))state.map.setView([item.lat,item.lng],Math.max(15,state.map.getZoom()),{animate:!matchMedia('(prefers-reduced-motion: reduce)').matches});
 if(move){$('#project-detail').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});$('#project-detail').focus({preventScroll:true});}
}
function frameMap(list){
 if(!state.map)return;
 state.boundary?.remove();
 const selected=area();
 state.boundary=boundaryLayer(state.map,selected?[selected]:[],feature=>{$('#project-neighborhood').value=feature.properties.name;render();});
 if(selected)state.map.fitBounds(state.boundary.getBounds(),{padding:[30,30],maxZoom:16});
 else if(state.center)state.map.setView([state.center.lat,state.center.lng],14);
 else {
  const pts=list.filter(i=>Number.isFinite(i.lat)&&Number.isFinite(i.lng)).map(i=>[i.lat,i.lng]);
  if(pts.length)state.map.fitBounds(pts,{padding:[40,40],maxZoom:14});
  else state.map.fitBounds([[25.758,-80.17],[25.877,-80.113]]);
 }
}
function render(){
 const list=items(),mapped=list.filter(i=>Number.isFinite(i.lat)&&Number.isFinite(i.lng));
 $('#project-count').textContent=list.length+' '+(state.dataset==='works'?(list.length===1?'mapped feature':'mapped features'):(list.length===1?'project':'projects'))+(area()?' · '+area().properties.name:'')+(state.center?' near '+state.center.label:'')+(mapped.length<list.length?' · '+(list.length-mapped.length)+' without map locations':'');
 $('#project-results').innerHTML=list.length?list.map(i=>'<button class="project-result" type="button" data-project="'+e(i.id)+'" aria-pressed="'+(state.selected===i.id)+'"><span><i class="phase-dot" style="--marker:'+phaseColor(i)+'"></i>'+e(i.phase||'Project')+'</span><h2>'+e(i.title)+'</h2><p>'+e(i.neighborhood||i.limits||'Open project details')+(state.center?' · '+distance(state.center,i).toFixed(1)+' mi':'')+'</p></button>').join(''):'<div class="empty-state"><h2>No matching projects</h2><p>Try another neighborhood, widen the address radius, or reset your filters.</p></div>';
 if(state.markers){
  state.markers.clearLayers();state.markerIndex.clear();frameMap(list);
  mapped.forEach(i=>{
   const marker=L.circleMarker([i.lat,i.lng],{radius:4,color:'#fff',weight:1,fillColor:phaseColor(i),fillOpacity:1}).addTo(state.markers);
   marker.bindTooltip(e(i.title));marker.on('click',()=>{select(i.id,true);});state.markerIndex.set(i.id,marker);
  });
 }
 if(!list.some(i=>i.id===state.selected))state.selected=list[0]?.id;
 if(state.selected)select(state.selected);else {$('#project-detail').innerHTML='<p>Select a project to read its details and source.</p>';syncUrl();}
}
async function initialize(){
 const local=file=>fetch(file,{signal:AbortSignal.timeout(20000)}).then(r=>{if(!r.ok)throw Error('Catalog unavailable');return r.json();});
 const results=await Promise.allSettled([json('city-projects'),local('data/projects.json'),local('data/future-projects.json'),json('neighborhoods')]);
 if(results[0].status==='fulfilled'){const d=results[0].value;state.datasets.works={items:d.items.map(i=>({...i,neighborhood:clean(i.neighborhood),phase:clean(i.phase),status:clean(i.status),description:clean(i.description),limits:clean(i.limits),corridor:clean(i.corridor)})),source:d.source.url,note:'City Public Works GIS · Snapshot saved '+date(d.generatedAt)+'. Checked by the six-hour publishing workflow. A project can have several mapped features.'};}
 if(results[1].status==='fulfilled')state.datasets.neighborhood={items:results[1].value.map(i=>({...i,description:i.summary,neighborhood:i.hood,phase:i.category})),source:'https://www.miamibeachfl.gov/city-hall/cip/active-projects/',note:'Selected City neighborhood projects. This saved editorial catalog is separate from the automatically refreshed Public Works GIS. Confirm current status with the linked City source.'};
 if(results[2].status==='fulfilled')state.datasets.future={items:results[2].value.map(i=>({...i,description:i.summary,neighborhood:i.hood,phase:i.phaseWindow,status:'Future need — not confirmed funding',link:'https://docs.google.com/presentation/d/1I7hCgh6ZmT26NXUE4aO2mQmtftqUYn6f/edit'})),source:'https://docs.google.com/presentation/d/1I7hCgh6ZmT26NXUE4aO2mQmtftqUYn6f/edit',note:'Future needs from the June 5, 2026 Critical Infrastructure Funding presentation. Planning estimates and approximate points—not active construction or confirmed appropriations.'};
 if(!Object.keys(state.datasets).length)throw Error('All project sources unavailable');
 if(results[3].status==='fulfilled')state.areas=neighborhoods(results[3].value);
 $('#project-neighborhood').innerHTML='<option value="all">All Miami Beach</option>'+state.areas.map(f=>'<option>'+e(f.properties.name)+'</option>').join('');
 if(state.areas.some(f=>f.properties.name===params.get('area')))$('#project-neighborhood').value=params.get('area');
 if(!state.areas.length){$('#project-neighborhood').disabled=true;$('#project-legend').insertAdjacentHTML('afterend','<p class="source-note">Neighborhood boundaries could not load. All projects remain available.</p>');}
 state.dataset=Object.keys(state.datasets).includes(params.get('dataset'))?params.get('dataset'):state.datasets.works?'works':Object.keys(state.datasets)[0];
 $('#project-search').value=params.get('q')||'';
 $('#project-map').replaceChildren();
 if(typeof L!=='undefined'){
  state.map=L.map('project-map',{scrollWheelZoom:false}).setView([25.815,-80.13],12);
  installBasemap(state.map);state.markers=L.layerGroup().addTo(state.map);
 }else $('#project-map').innerHTML='<p class="notice">The map could not load. All project details are available in the list.</p>';
 $('#project-legend').innerHTML=legendMarkup();
 filters();
 if([...$('#project-phase').options].some(o=>o.value===params.get('phase')))$('#project-phase').value=params.get('phase');
 render();
 document.querySelectorAll('[data-dataset]').forEach(b=>{b.disabled=!state.datasets[b.dataset.dataset];b.setAttribute('aria-pressed',String(b.dataset.dataset===state.dataset));});
}
$('#project-results').addEventListener('click',event=>{const b=event.target.closest('[data-project]');if(b)select(b.dataset.project,true);});
$('#dataset-tabs').addEventListener('click',event=>{const b=event.target.closest('[data-dataset]');if(!b||b.disabled)return;state.dataset=b.dataset.dataset;document.querySelectorAll('[data-dataset]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));filters();render();});
['#project-search','#project-neighborhood','#project-phase','#project-radius'].forEach(selector=>$(selector).addEventListener(selector==='#project-search'?'input':'change',render));
$('#reset-map').addEventListener('click',()=>{
 state.center=null;state.selected=null;$('#project-search').value='';$('#project-neighborhood').value='all';$('#project-phase').value='all';$('#address-input').value='';$('#address-results').textContent='';$('#clear-address').hidden=true;render();
});
$('#expand-map').addEventListener('click',()=>{
 const open=$('#expand-map').getAttribute('aria-pressed')!=='true';
 $('#expand-map').setAttribute('aria-pressed',String(open));$('#expand-map').textContent=open?'Compact map':'Expand map';
 $('.project-explorer').classList.toggle('is-expanded',open);
 requestAnimationFrame(()=>{state.map?.invalidateSize();frameMap(items());});
});
$('#address-form').addEventListener('submit',async event=>{event.preventDefault();$('#address-results').textContent='Finding matching addresses…';try{const q=$('#address-input').value.trim();const p=new URLSearchParams({f:'json',SingleLine:q+', Miami Beach, FL',outFields:'Match_addr',maxLocations:'4',searchExtent:'-80.20,25.75,-80.10,25.88'});const r=await fetch('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?'+p);if(!r.ok)throw Error('geocoding unavailable');const d=await r.json();const candidates=(d.candidates||[]).filter(c=>c.location.x>=-80.2&&c.location.x<=-80.1&&c.location.y>=25.75&&c.location.y<=25.88);$('#address-results').innerHTML=candidates.length?'<p>Select your address:</p>':'No matching Miami Beach address was found. Try a street address or search by neighborhood.';candidates.forEach(c=>{const b=document.createElement('button');b.type='button';b.textContent=c.address;b.addEventListener('click',()=>{state.center={lat:c.location.y,lng:c.location.x,label:c.address};$('#address-results').textContent='Using '+c.address;$('#clear-address').hidden=false;state.map?.setView([c.location.y,c.location.x],14);render();});$('#address-results').append(b);});}catch{$('#address-results').textContent='Address lookup is unavailable. You can still search projects by street or neighborhood.';}});
$('#clear-address').addEventListener('click',()=>{state.center=null;$('#address-results').textContent='';$('#clear-address').hidden=true;render();});
initialize().catch(error=>{console.error(error);$('#project-count').textContent='Projects could not be loaded. Please use the official City project directory.';}).finally(()=>document.dispatchEvent(new Event('page:ready')));
