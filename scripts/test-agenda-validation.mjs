import assert from 'node:assert/strict';
import {validateAgenda} from './agenda-validation.mjs';
function fixture(n) {return {meetingDate:'2026-11-16',officialAgendaUrl:'https://miamibeachfl.primegov.com/Portal/Meeting?meetingTemplateId=6325',itemCount:n,sections:[{id:'special',label:'Special',count:n}],items:Array.from({length:n},(_,i)=>({id:`special-${i}`,itemNumber:String(i+1),title:'Item',officialTitle:'Official item',section:'Special',meetingDate:'2026-11-16',officialSponsors:[]}))};}
validateAgenda(fixture(5));validateAgenda(fixture(214));
for(const modify of [x=>x.itemCount=NaN,x=>x.items.pop(),x=>x.items=[],x=>x.sections=[],x=>x.sections[0].count=99,x=>x.items[1].id=x.items[0].id,x=>x.items[0].officialTitle='',x=>x.officialAgendaUrl='https://example.com/',x=>x.items[0].meetingDate='2026-11-18']) {const x=fixture(5);modify(x);assert.throws(()=>validateAgenda(x));}
console.log('Agenda validation passed: small special + large regular agendas; rejects missing counts, truncation, empty data, invalid sections, duplicates, missing title/source, mixed meetings.');
