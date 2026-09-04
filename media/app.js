import {json,escape as e,date,matches,thumbnailFallback} from '../shared.js?v=468bf5ea8f';
const $=s=>document.querySelector(s),params=new URLSearchParams(location.search);
const state={items:[],series:params.get('series')||'all',query:params.get('q')||'',selected:params.get('video')};
const descriptions={'Suarez Sound Off':'Long-form conversations with the people shaping Miami Beach.','Miami Beach Civics':'Understand the people, process and public money behind city government.','Ride Along':'Go behind the scenes with the teams working in Miami Beach.','Accountability':'David’s reporting and perspective on public accountability.','City Issues':'Updates and conversations about life in Miami Beach.'};
function syncUrl(){const p=new URLSearchParams();if(state.selected)p.set('video',state.selected);if(state.series!=='all')p.set('series',state.series);if(state.query)p.set('q',state.query);history.replaceState(null,'',location.pathname+(p.size?'?'+p:''));}
function select(id,scroll=false){
 const item=state.items.find(i=>i.id===id);if(!item)return;
 state.selected=id;$('#player-art').innerHTML='<img data-video="'+e(item.id)+'" src="https://i.ytimg.com/vi/'+e(item.id)+'/maxresdefault.jpg" alt="'+e(item.title)+'">';
 $('#player-title').textContent=item.title.replace(/^Suarez Sound Off\s*Ep\.\s*\d+\s*[—-]\s*/i,'');$('#player-series').textContent=item.series;$('#player-meta').textContent=date(item.publishedAt)+(item.duration?' · '+item.duration:'');$('#player-description').textContent=descriptions[item.series]||descriptions['City Issues'];$('#youtube-link').href=item.url;$('#play-video').hidden=false;thumbnailFallback($('#player-art'));syncUrl();
 if(scroll){$('#watch-player').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});$('#player-title').focus({preventScroll:true});}
}
function render(){
 const available=['all','Suarez Sound Off','Miami Beach Civics','Ride Along','Accountability','City Issues'];
 $('#media-filters').innerHTML=available.map(series=>'<button type="button" data-series="'+e(series)+'" aria-pressed="'+(series===state.series)+'" class="'+(series===state.series?'is-active':'')+'">'+(series==='all'?'All videos':series)+'</button>').join('');
 const items=state.items.filter(i=>(state.series==='all'||i.series===state.series)&&matches(state.query,i.title+' '+i.series));
 $('#media-count').textContent=items.length+' videos · Official YouTube channel';
 $('#media-grid').innerHTML=items.length?items.map(i=>'<article class="media-card"><button type="button" data-video-select="'+e(i.id)+'"><div class="video-image"><img data-video="'+e(i.id)+'" src="https://i.ytimg.com/vi/'+e(i.id)+'/maxresdefault.jpg" alt="" loading="lazy">'+(i.duration?'<span class="video-duration">'+e(i.duration)+'</span>':'')+'</div><div class="media-card-copy"><span>'+e(i.series)+'</span><h2>'+e(i.title)+'</h2><p>'+e(date(i.publishedAt,true))+'</p></div></button></article>').join(''):'<div class="media-empty"><strong>No videos match.</strong><p>Try another series or search term.</p></div>';
 thumbnailFallback($('#media-grid'));syncUrl();
}
$('#play-video').addEventListener('click',()=>{
 const item=state.items.find(i=>i.id===state.selected);if(!item)return;
 const frame=document.createElement('iframe');frame.src='https://www.youtube-nocookie.com/embed/'+item.id+'?autoplay=1';frame.title=item.title;frame.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';$('#player-art').replaceChildren(frame);$('#play-video').hidden=true;
});
$('#media-filters').addEventListener('click',event=>{const button=event.target.closest('[data-series]');if(button){state.series=button.dataset.series;render();}});
$('#media-search').value=state.query;$('#media-search').addEventListener('input',event=>{state.query=event.target.value;render();});
$('#media-grid').addEventListener('click',event=>{const button=event.target.closest('[data-video-select]');if(button)select(button.dataset.videoSelect,true);});
json('youtube').then(data=>{state.items=data.items;const first=data.items.find(i=>i.id===state.selected)||data.items.find(i=>state.series!=='all'&&i.series===state.series)||data.items[0];select(first.id);render();}).catch(error=>{$('#player-art').innerHTML='<p>The video archive could not be loaded. <a href="https://www.youtube.com/@CommissionerDavidSuarez">Open the official channel</a>.</p>';$('#play-video').hidden=true;console.error(error);}).finally(()=>document.dispatchEvent(new Event('page:ready')));
