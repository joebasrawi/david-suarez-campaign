import assert from 'node:assert/strict';
import {readFile,access,readdir} from 'node:fs/promises';
import vm from 'node:vm';
import {loadingRegions,addLoadingShells} from './ui-shells.mjs';
const root=new URL('../',import.meta.url);
const read=file=>readFile(new URL(file,root),'utf8');
const agenda=JSON.parse(await read('data/city-agenda.json'));
const actions=JSON.parse(await read('data/commission-actions.json'));
const videos=JSON.parse(await read('data/youtube.json'));
for(const [name,items] of [['agenda',agenda.items],['actions',actions.items],['videos',videos.items]])assert.equal(new Set(items.map(i=>i.id)).size,items.length,`${name}: IDs must be unique`);
assert.ok(videos.items.some(i=>i.series==='Ride Along'));
assert.ok(videos.items.some(i=>i.series==='Accountability'));
for(const item of actions.items){
 assert.ok(item.sourcePage>0,`${item.id}: source page`);
 if(item.voteBlockCount>1){assert.equal(item.voteSummary,'');assert.equal(item.rollCall.length,0);}
 if(item.voteType==='Consent agenda')assert.ok(['Passed','Referred'].includes(item.outcome));
}
// Execute the production parser's pure functions against regression fixtures.
const source=await read('scripts/sync-actions.mjs');
const context={commissionerNames:[],PRIMEGOV:'https://miamibeachfl.primegov.com'};vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function isoDate('),source.indexOf('const archive =')),context);
assert.equal(context.outcomeFor('Resolution adopted. A motion to defer failed.'),'Passed');
assert.equal(context.outcomeFor('The item was withdrawn.'),'Withdrawn');
assert.equal(context.extractAmendments(['ACTION: Approved.','AMENDMENTS:','Change the effective date.'],'Approved.')[0],'Change the effective date.');
const lines=['SEPARATED ITEMS:','Commissioner Suarez separated Items: C7 B','A motion was made to adopt the Consent Agenda, except separated items; Vote: 7-0.','VOTES:','Mayor Test: Yes','C7 A A RESOLUTION OF THE MAYOR AND CITY COMMISSION TO APPROVE A PROJECT.','ACTION: Resolution adopted.','C7 B A RESOLUTION OF THE MAYOR AND CITY COMMISSION TO APPROVE ANOTHER PROJECT.','ACTION: Item deferred.'];
const fixture=context.parseMeeting(lines,{id:1,date:'February 5, 2026'},{templateId:1,compileOutputType:1});
assert.equal(fixture[0].voteType,'Consent agenda');assert.equal(fixture[1].voteSummary,'');assert.equal(fixture[1].rollCall.length,0);
const multi=['R7 A A RESOLUTION OF THE MAYOR AND CITY COMMISSION TO APPROVE A PROJECT.','ACTION: Resolution adopted. Vote: 6-1.','VOTES:','Mayor Test: Yes','Another motion. Vote: 7-0.','VOTES:','Mayor Test: Yes'];
assert.equal(context.parseMeeting(multi,{id:1,date:'February 5, 2026'},{templateId:1,compileOutputType:1})[0].voteSummary,'');
const routes=['','resident-guide','search','meetings','news','sources','about','legislation','commission-agenda','commission-actions','active-projects','media'];
let checked=0;
for(const route of routes){
 const file=new URL(`${route?route+'/':''}index.html`,root),html=await readFile(file,'utf8');
 assert.equal((html.match(/<h1\b/g)||[]).length,1,route+': one main heading');
 assert.equal((html.match(/class="hub-header"/g)||[]).length,1,route+': one shared header');
 assert.equal((html.match(/class="hub-footer"/g)||[]).length,1,route+': one shared footer');
 assert.ok(html.includes('Skip to'),route+': skip navigation');
 assert.ok(html.includes('calm.css'),route+': simplified layout stylesheet');
 assert.equal((html.match(/<script[^>]+src="[^"]*experience\.js/g)||[]).length,1,route+': one shared motion controller');
 assert.ok(html.includes('experience.css'),route+': shared motion and skeleton styling');
 assert.equal((html.match(/data-load-region=/g)||[]).length,loadingRegions[route].length,route+': all asynchronous sections have loading shells');
 assert.ok(html.includes('role="status">Loading content'),route+': accessible loading announcement');
 if(route!=='resident-guide')assert.equal(addLoadingShells(html,route),html,route+': skeleton assembly is idempotent');
 if(route==='resident-guide')assert.equal((html.match(/class="service-icon"/g)||[]).length,12,'All service icons are present');
 if(!['commission-agenda','commission-actions'].includes(route))assert.ok(!/<script[^>]+src="[^"]*shared\.js/.test(html),route+': shared navigation must load once via the module entry');
 for(const match of html.matchAll(/<script([^>]*?)src="([^"?]+)(?:\?[^" ]*)?"[^>]*>/g)){
   if(/^https?:/.test(match[2]))continue;
   const code=await readFile(new URL(match[2],file),'utf8');
   if(/^import\s/m.test(code))assert.ok(match[0].includes('type="module"'),route+': module entry must have module type');
 }
 for(const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)){
  const target=match[1];if(/^(https?:|mailto:|tel:|data:)/.test(target))continue;
  const url=new URL(target,file);url.search='';url.hash='';if(url.pathname.endsWith('/'))url.pathname+='index.html';
  await access(url).catch(()=>assert.fail(`${route}: broken local target ${target}`));checked++;
 }
}
const motion=await read('experience.js');
assert.ok(motion.includes("matchMedia('(prefers-reduced-motion: reduce)')"));
assert.ok(motion.includes('animation.cancel()'),'Active entrances cancel when reduced motion is enabled');
assert.ok(!/addEventListener\(['"]scroll/.test(motion),'No high-frequency scroll handlers');
assert.ok(!/setTimeout/.test(motion),'No artificial minimum skeleton delay');
console.log(`Passed parser regressions, data integrity checks and ${checked} local links/assets across ${routes.length} routes.`);
