import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {pointInFeature,neighborhoods,phaseColor} from '../city-map.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const polygon={geometry:{type:'Polygon',coordinates:[[[0,0],[4,0],[4,4],[0,4],[0,0]],[[1,1],[2,1],[2,2],[1,2],[1,1]]]}};
assert.equal(pointInFeature({lat:3,lng:3},polygon),true);
assert.equal(pointInFeature({lat:1.5,lng:1.5},polygon),false,'Polygon holes are not included');
assert.equal(pointInFeature({lat:5,lng:2},polygon),false);
assert.equal(pointInFeature({lat:null,lng:2},polygon),false);
assert.equal(pointInFeature({lat:3,lng:3},{geometry:{type:'MultiPolygon',coordinates:[polygon.geometry.coordinates]}}),true);
const geo=JSON.parse(await read('data/neighborhoods.json'));
assert.ok(geo.features.length>=35);
const local=neighborhoods(geo);
assert.ok(local.some(f=>f.properties.name==='South of Fifth'));
assert.ok(local.some(f=>f.properties.name==='West Ave Neighborhood'));
assert.ok(local.every(f=>f.properties.layer===11),'Prefer actual sub-neighborhoods');
assert.equal(phaseColor({phase:'Unknown'}),'#8db6ac');
assert.equal(phaseColor({phase:'Unknown',sourceLayer:{phase:'Construction'}}),'#ef9b61');
// Exercise the exact pre-paint theme controller without relying on storage access.
const code=await read('theme.js');
function setup(stored,systemDark=false,deny=false){
 const events={},system={matches:systemDark,addEventListener:(name,fn)=>system.change=fn};
 const document={documentElement:{dataset:{},style:{}},querySelectorAll:()=>[],dispatchEvent:()=>{},addEventListener:(name,fn)=>events[name]=fn};
 const storage={value:stored,getItem(){if(deny)throw Error('Denied');return this.value;},setItem(k,v){if(deny)throw Error('Denied');this.value=v;}};
 vm.runInNewContext(code,{document,matchMedia:()=>system,localStorage:storage,window:{addEventListener:(name,fn)=>events[name]=fn},CustomEvent:class{}});
 events.DOMContentLoaded();
 return {document,events,storage,system};
}
let t=setup(null);assert.equal(t.document.documentElement.dataset.theme,'dark');
t.events.click({target:{closest:()=>({dataset:{themeChoice:'light'}})}});
assert.equal(t.document.documentElement.dataset.theme,'light');assert.equal(t.storage.value,'light');
assert.equal(setup(t.storage.value).document.documentElement.dataset.theme,'light','Theme persists between pages');
t.events.click({target:{closest:()=>({})}});
assert.equal(t.document.documentElement.dataset.theme,'dark','A second click switches back without a menu');
t=setup('system',false);assert.equal(t.document.documentElement.dataset.theme,'light');t.system.matches=true;t.system.change();assert.equal(t.document.documentElement.dataset.theme,'dark');
t.events.storage({key:'suarez-display',newValue:'light'});assert.equal(t.document.documentElement.dataset.theme,'light');
assert.equal(setup('invalid').document.documentElement.dataset.theme,'dark');
assert.equal(setup(null,false,true).document.documentElement.dataset.theme,'dark','Storage denial is harmless');
const home=await read('index.html'),about=await read('about/index.html'),directory=await read('search/index.html'),commission=await read('commission/index.html');
assert.equal((home.match(/id="film-control"/g)||[]).length,1);
assert.ok(home.indexOf('id="film-control"')>home.indexOf('</header>'),'Pause control is separate from theme toggle');
assert.ok(home.includes('data-theme-toggle'));
assert.ok(!home.includes('class="nav-group display-menu"'));
assert.ok(!home.includes('home-service-bar'));
assert.ok(!directory.includes('global-search-form'));
assert.ok(!about.includes('id="official-people"'));
assert.ok(commission.includes('id="official-people"'));
assert.ok(home.includes('id="home-neighborhood"'));
assert.ok((await read('media/app.js')).includes('shelf-track'));
for(const route of ['', 'resident-guide/', 'meetings/', 'news/', 'legislation/', 'commission-agenda/', 'commission-actions/', 'about/', 'active-projects/']) {
 const html=await read(route+'index.html');
 assert.ok(!/A little help\.|Show up\. Speak up\.|Know what’s on the table\.|Guests, ideas and the city we share|class="editorial-deck"/.test(html),'No decorative filler on '+route);
}
const css=await read('coastal.css');
assert.match(css,/body\.home-cinematic \.hub-header \{[^}]*--panel:#122e39/,'Cinematic mobile navigation keeps a dark surface in light mode');
const rgb=h=>h.replace('#','').match(/../g).map(x=>parseInt(x,16)/255);
const luminance=h=>rgb(h).reduce((sum,c,i)=>sum+(c<=.04045?c/12.92:((c+.055)/1.055)**2.4)*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const values=[luminance(a),luminance(b)].sort((a,b)=>b-a);return(values[0]+.05)/(values[1]+.05);};
for(const selector of [':root',':root[data-theme="light"]']) {
 const block=css.slice(css.indexOf(selector+' {')).split('}')[0];
 const tokens=Object.fromEntries([...block.matchAll(/--([\w-]+):(#(?:[\da-f]{6}|[\da-f]{3}));/g)].map(([,key,value])=>[key,value.length===4?'#'+[...value.slice(1)].map(x=>x+x).join(''):value]));
 for(const surface of ['canvas','panel','panel-raised','selected'])for(const ink of ['text','subtle','accent'])assert.ok(contrast(tokens[ink],tokens[surface])>=4.5,selector+' '+ink+' on '+surface);
 assert.ok(contrast(tokens['accent-ink'],tokens.accent)>=4.5);
 for(const surface of ['canvas','panel','panel-raised'])assert.ok(contrast(tokens['control-border'],tokens[surface])>=3,selector+' control boundary');
}
console.log('Coastal regression tests passed: geography, source phases, persistent themes, and approved removals.');
