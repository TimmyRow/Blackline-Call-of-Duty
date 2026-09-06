import test from 'node:test';
import assert from 'node:assert/strict';
import {getEncounterSites,encounterPosition,isEncounterId} from '../src/encounter-layout.mjs';
test('open exploration offers independent discoveries and optional fights near insertion',()=>{
 const sites=getEncounterSites(0,110);
 assert.ok(sites.some(s=>s.kind==='wreck'&&s.faction==='neutral'));
 assert.ok(sites.some(s=>s.kind==='convoy'&&s.guardCount===4));
 assert.ok(sites.some(s=>s.kind==='friendly'&&s.guardCount===0));
 assert.ok(sites.every(s=>isEncounterId(s.id)&&s.elevation>3));
 assert.deepEqual(sites,getEncounterSites(0,110));
});
test('roaming encounters follow bounded deterministic routes and leave discoveries stationary',()=>{
 const sites=getEncounterSites(0,110),convoy=sites.find(s=>s.kind==='convoy');
 assert.notDeepEqual(encounterPosition(convoy,0),encounterPosition(convoy,100));
 assert.deepEqual(encounterPosition(convoy,100),encounterPosition(convoy,100));
 for(let time=0;time<2000;time+=37){const p=encounterPosition(convoy,time);assert.ok(Math.hypot(p.x-convoy.x,p.z-convoy.z)<30);}
 const wreck=sites.find(s=>s.kind==='wreck');assert.deepEqual(encounterPosition(wreck,0),encounterPosition(wreck,1000));
});
