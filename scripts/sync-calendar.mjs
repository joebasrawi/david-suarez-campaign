import {cleanText, fetchJson, isoNow, writeSnapshot} from './lib.mjs';
const CALENDAR_URL='https://events.miamibeachfl.gov/City%20Meetings/';
const API='https://events.miamibeachfl.gov/wp-json/tribe/events/v1/events';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date());
const end=new Date();end.setDate(end.getDate()+60);
const query=new URLSearchParams({categories:'659',start_date:today,end_date:end.toISOString().slice(0,10),per_page:'50'});
let url=API+'?'+query,events=[],pages=0;
while(url && pages<5){
 const data=await fetchJson(url);if(!Array.isArray(data.events))throw Error('Calendar API did not return events');
 events.push(...data.events);pages++;
 // The upstream next_rest_url drops the category filter. Preserve our query.
 query.set('page',String(pages+1));
 url=pages < Number(data.total_pages||1) ? API+'?'+query : '';
}
if(url)throw Error('Calendar pagination exceeded the safety limit; retaining previous snapshot.');
const items=[...new Map(events.map(event=>[event.id,event])).values()].filter(event=>event.categories?.some(c=>c.id===659)).map(event=>({
 id:String(event.id),title:cleanText(event.title),description:cleanText(event.description),
 startLocal:event.all_day?event.start_date.slice(0,10):event.start_date.replace(' ','T'),
 endLocal:event.all_day?event.end_date.slice(0,10):event.end_date.replace(' ','T'),
 location:cleanText([event.venue?.venue,event.venue?.address,event.venue?.city].filter(Boolean).join(', ')),
 category:'City Government',url:event.url,
 note:event.start_date==='2026-09-10 09:00:00'&&/^City Commission/.test(event.title)?'Time discrepancy: the City calendar lists 9:00 a.m.; the annual commission schedule lists 8:30 a.m. Confirm the start time in the official meeting notice.':''
})).sort((a,b)=>a.startLocal.localeCompare(b.startLocal));
if(!items.length||items.some(i=>!i.title||!i.url||!i.startLocal))throw Error('Calendar validation failed');
await writeSnapshot('data/city-calendar.json',{generatedAt:isoNow(),timezone:'America/New_York',source:{label:'City of Miami Beach Events Calendar',url:CALENDAR_URL,feedUrl:API+'?'+query},items});
console.log('Synced '+items.length+' upcoming government events across '+pages+' calendar pages.');
