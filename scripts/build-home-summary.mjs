import {selectHomeVideos} from '../home-videos.js';
import {readFile} from 'node:fs/promises';
import {isoNow,writeSnapshot} from './lib.mjs';
const read=async name=>JSON.parse(await readFile(new URL(`../data/${name}.json`,import.meta.url),'utf8'));
const [videos,agenda,news,actions]=await Promise.all(['youtube','city-agenda','city-news','commission-actions'].map(read));
const calendar=await read('city-calendar').catch(()=>({items:[]}));
// Regular commission meetings let the homepage name the next date before its agenda is posted.
const commissionMeetings=(calendar.items||[]).filter(i=>/^City Commission\*?\s*$/i.test(i.title||'')).map(({title,startLocal,location,url})=>({title,startLocal,location,url}));
const latest=actions.items.filter(i=>i.outcome==='Passed'&&/^R5\s/.test(i.itemNumber)).sort((a,b)=>b.meetingDate.localeCompare(a.meetingDate)).slice(0,3);
await writeSnapshot('data/home-summary.json',{
 generatedAt:isoNow(),
 youtube:{items:selectHomeVideos(videos.items)},
 agenda:{nextMeeting:agenda.nextMeeting,commissionMeetings},
 news:{items:news.items.slice(0,2)},
 actions:{items:latest.map(({id,itemNumber,title,outcome,meetingDate,voteSummary})=>({id,itemNumber,title,outcome,meetingDate,voteSummary}))}
});
