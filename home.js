import {json, escape as e, date, recordTitle, thumbnailFallback} from './shared.js';
const $=s=>document.querySelector(s);
async function init(){
 const {youtube,agenda,news,actions}=await json('home-summary');
 if(youtube){const item=youtube.items.find(i=>i.series==='Suarez Sound Off')||youtube.items[0];if(item){
 $('#featured-title').textContent=item.title.replace(/^Suarez Sound Off\s*Ep\.\s*\d+\s*[—-]\s*/i,'').replace(/\s*\|.*$/,'');
 $('#featured-series').textContent=item.series;$('#featured-date').textContent=date(item.publishedAt);$('#featured-link').href='media/?video='+item.id;$('#featured-link').textContent='Watch episode';
 const image=$('#featured-image');image.src='https://i.ytimg.com/vi/'+item.id+'/maxresdefault.jpg';image.alt=item.title;image.dataset.video=item.id;thumbnailFallback();
 }}
 const cards=[];
 if(agenda){const m=agenda.nextMeeting;cards.push('<article class="official-item"><div><span class="official-label">Next commission agenda</span><h3>'+e(date(m.date))+'</h3><p>'+m.itemCount+' items for consideration</p><a href="commission-agenda/">Explore the agenda</a></div></article>');}
 if(news)news.items.slice(0,2).forEach(i=>cards.push('<article class="official-item"><div><span class="official-label">Official city news · '+e(date(i.publishedAt,true))+'</span><h3>'+e(i.title)+'</h3><a href="'+e(i.url)+'" target="_blank" rel="noreferrer">Read city announcement ↗</a></div></article>'));
 $('#official-updates').innerHTML=cards.join('')||'<p class="loading-copy">Updates could not be loaded. <a href="news/">Try city news</a>.</p>';
 if(actions){const latest=[...actions.items].filter(i=>i.outcome==='Passed'&&/^R5\s/.test(i.itemNumber)).sort((a,b)=>b.meetingDate.localeCompare(a.meetingDate)).slice(0,3);
 $('#home-decisions').innerHTML=latest.map(i=>'<article class="home-action"><strong>'+e(i.itemNumber)+'</strong><div><a href="commission-actions/?item='+encodeURIComponent(i.id)+'">'+e(recordTitle(i.title,130))+'</a><p>'+e(date(i.meetingDate,true))+' · '+e(i.outcome)+(i.voteSummary?' · '+e(i.voteSummary):'')+'</p></div></article>').join('');}
 else $('#home-decisions').innerHTML='<p><a href="commission-actions/">Browse the recorded decisions</a></p>';
}
init().catch(error=>{console.error(error);$('#official-updates').innerHTML='<p class="loading-copy">Updates could not be loaded. <a href="news/">Open city news</a> or <a href="commission-agenda/">read the agenda</a>.</p>';$('#home-decisions').innerHTML='<a href="commission-actions/">Browse recorded decisions</a>';});
