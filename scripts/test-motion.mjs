import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const code=await readFile(new URL('../experience.js',import.meta.url),'utf8');
function harness(reducedInitially) {
 let callback,observed=0,animated=0,canceled=0,change;
 const preference={matches:reducedInitially,addEventListener:(_,fn)=>change=fn};
 class Element {
  matches(){return false;} querySelectorAll(){return [];} closest(){return null;}
  contains(target){return target===this;}
  animate(frames,options){animated++;assert.equal(options.duration,420);assert.ok(options.delay<=160);return {effect:{target:this},finished:new Promise(()=>{}),cancel(){canceled++;}};}
 }
 const tile=new Element(),root=new Element();
 root.querySelectorAll=selector=>selector.includes('.topic-card')?[tile]:[];
 class IntersectionObserver {constructor(fn){callback=fn;}observe(){observed++;}unobserve(){}disconnect(){} }
 const document={documentElement:{classList:{add(){},remove(){}}},querySelectorAll:()=>[],querySelector:()=>root,body:root,addEventListener(){}};
 const context={document,matchMedia:()=>preference,Element,HTMLDetailsElement:Element,HTMLScriptElement:Element,IntersectionObserver,MutationObserver:class{observe(){}},window:{IntersectionObserver,addEventListener(){}}};
 vm.runInNewContext(code,context);
 callback([{target:tile,isIntersecting:true}]);
 if(reducedInitially){assert.equal(observed,0);assert.equal(animated,0);}
 else{assert.equal(observed,1);assert.equal(animated,1);preference.matches=true;change();assert.equal(canceled,1);}
}
harness(false);harness(true);
console.log('Motion tests passed: bounded entrances, no animation with reduced motion, active animations canceled on preference change.');
