import {readFile} from 'node:fs/promises';
import {isoNow,writeSnapshot} from './lib.mjs';
const read=async name=>JSON.parse(await readFile(new URL(`../data/${name}.json`,import.meta.url),'utf8'));
const [videos,agenda,news,actions]=await Promise.all(['youtube','city-agenda','city-news','commission-actions'].map(read));
const latest=actions.items.filter(i=>i.outcome==='Passed'&&/^R5\s/.test(i.itemNumber)).sort((a,b)=>b.meetingDate.localeCompare(a.meetingDate)).slice(0,3);
await writeSnapshot('data/home-summary.json',{
 generatedAt:isoNow(),
 youtube:{items:[videos.items.find(i=>i.series==='Suarez Sound Off')||videos.items[0]]},
 agenda:{nextMeeting:agenda.nextMeeting},
 news:{items:news.items.slice(0,2)},
 actions:{items:latest.map(({id,itemNumber,title,outcome,meetingDate,voteSummary})=>({id,itemNumber,title,outcome,meetingDate,voteSummary}))}
});
