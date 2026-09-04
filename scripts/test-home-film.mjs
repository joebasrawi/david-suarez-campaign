import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../home.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('function initFilm(){'),source.indexOf('function loadMapLibrary(){'));
function harness({reduced=false,saveData=false,mobile=false,blocked=false,observeImmediately=true}={}){
 const events={},preferences={},observers={};
 const film={paused:true,dataset:{videoSrc:'wide.mp4',mobileSrc:'mobile.mp4'},muted:false,src:'',getAttribute(){return this.src;},closest(){return {classList:{add(){},remove(){}}};},addEventListener(k,f){events['video:'+k]=f;},play(){if(blocked)return Promise.reject({name:'NotAllowedError'});this.paused=false;events['video:playing']();return Promise.resolve();},pause(){this.paused=true;events['video:pause']?.();}};
 const control={textContent:'',contains(target){return target===this;},setAttribute(k,v){this[k]=v;},addEventListener(k,f){events['control:'+k]=f;}};
 const doc={hidden:false,addEventListener(k,f){events[k]=f;}};
 const preference={matches:reduced,addEventListener(k,f){preferences[k]=f;}};
 class IntersectionObserver{constructor(f){observers.change=f;}observe(){}}
 vm.runInNewContext(code,{$:s=>s==='#hero-film'?film:control,matchMedia:q=>q.includes('reduced')?preference:{matches:mobile},navigator:{connection:{saveData}},document:doc,window:{IntersectionObserver,addEventListener(k,f){events[k]=f;}},IntersectionObserver});
 if(observeImmediately)observers.change([{isIntersecting:true}]);
 return {film,control,doc,events,preference,preferences,observers,unblock(){blocked=false;}};
}
for(const options of [{reduced:true},{saveData:true}]){
 const h=harness(options);assert.equal(h.film.src,'');assert.equal(h.film.paused,true);
 h.events['control:click']();assert.equal(h.film.paused,false);assert.equal(h.film.muted,true);
}
const h=harness({mobile:true});assert.equal(h.film.src,'mobile.mp4');assert.equal(h.film.paused,false);
h.events['control:click']();assert.equal(h.film.paused,true);assert.equal(h.control['aria-label'],'Play background video');
h.events['control:click']();assert.equal(h.film.paused,false);
h.doc.hidden=true;h.events.visibilitychange();assert.equal(h.film.paused,true);
h.doc.hidden=false;h.events.visibilitychange();assert.equal(h.film.paused,false);
h.observers.change([{isIntersecting:false}]);assert.equal(h.film.paused,true);
h.observers.change([{isIntersecting:true}]);assert.equal(h.film.paused,false);
h.preference.matches=true;h.preferences.change();assert.equal(h.film.paused,true);
h.observers.change([{isIntersecting:true}]);assert.equal(h.film.paused,true);
const denied=harness({blocked:true});await Promise.resolve();assert.equal(denied.film.paused,true);assert.equal(denied.control['aria-label'],'Play background video');
denied.unblock();denied.events.pointerdown({target:{}});assert.equal(denied.film.paused,false,'Retry browser-blocked autoplay on interaction');
denied.events['control:click']();denied.events.pointerdown({target:{}});denied.events.pageshow();assert.equal(denied.film.paused,true,'Never undo an explicit Pause');
const immediate=harness({observeImmediately:false});assert.equal(immediate.film.paused,false,'Start without waiting for IntersectionObserver');
assert.equal(immediate.film.autoplay,true);assert.equal(immediate.film.defaultMuted,true);assert.equal(immediate.film.playsInline,true);
const restored=harness({blocked:true});await Promise.resolve();restored.unblock();restored.events.pageshow();assert.equal(restored.film.paused,false,'Retry on restored pages');
console.log('Homepage film tests passed: autoplay, mobile source, pause/resume, offscreen/hidden tabs, reduced motion, data saving, blocked playback.');
