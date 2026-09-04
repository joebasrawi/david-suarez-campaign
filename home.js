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
