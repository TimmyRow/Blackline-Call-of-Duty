import test from 'node:test';
import assert from 'node:assert/strict';
import {getEncounterSites,encounterPosition,isEncounterId,createEncounterInteraction,encounterInteractionSteps,encounterRewardMessage} from '../src/encounter-layout.mjs';
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

const hold=(interaction,site,frames=40,guards=0)=>{let rewards=0;for(let i=0;i<frames;i++)if(interaction.step(site,true,.1,guards))rewards++;return rewards;};
test('wreck repair and retrieval require separate interactions and grant one final reward',()=>{
 const site=getEncounterSites(0,110).find(s=>s.kind==='wreck'),done=new Set(),interaction=createEncounterInteraction(done);
 assert.equal(hold(interaction,site),0);assert.equal(interaction.stage(site),1);assert.equal(done.size,0);
 assert.equal(hold(interaction,site),0,'continuous hold must not skip the second action');
 interaction.step(null,false,.1); // Move away from the drive, then approach its recovery case.
 assert.equal(interaction.stage(site),1,'walking between terminals must retain the repaired drive');
 assert.equal(hold(interaction,site),1);assert.deepEqual([...done],[site.id]);
 interaction.step(site,false,.1);assert.equal(hold(interaction,site),0,'completed encounters cannot pay twice');
 const steps=encounterInteractionSteps(site);assert.ok(Math.hypot(steps[0].x-steps[1].x,steps[0].z-steps[1].z)>6.4,'wreck actions require changing position');
});
test('distress transmitter remains locked during combat and interrupted holds reset cleanly',()=>{
 const site=getEncounterSites(0,110).find(s=>s.kind==='distress'),interaction=createEncounterInteraction();
 assert.equal(hold(interaction,site,40,2),0);assert.equal(interaction.stage(site),0);
 hold(interaction,site,8);assert.ok(interaction.fraction(site)>.4);
 interaction.step(site,false,.1);assert.equal(interaction.fraction(site),0);
 hold(interaction,site,8);assert.equal(interaction.stage(site),0);
 hold(interaction,site,8);assert.equal(interaction.stage(site),1);
 interaction.step(site,false,.1);assert.equal(hold(interaction,site),1);
});
test('restored completion IDs suppress rewards and friendly supplies need no combat',()=>{
 const sites=getEncounterSites(0,110),site=sites.find(s=>s.kind==='friendly'),wreck=sites.find(s=>s.kind==='wreck');
 const interaction=createEncounterInteraction(new Set([wreck.id,'encounter:old-save:42']));
 assert.equal(hold(interaction,wreck),0);
 interaction.step(null,false,.1);assert.equal(hold(interaction,site),1);assert.equal(site.guardCount,0);assert.equal(site.reward,35);
 assert.match(encounterRewardMessage(site),/RECON SUPPLIES SHARED/);
});
test('large frame delays cannot instantly complete interactions and partial discoveries stay bounded',()=>{
 const interaction=createEncounterInteraction();
 const site={id:'encounter:wreck:lag',kind:'wreck'};
 interaction.step(site,true,90);assert.ok(interaction.fraction(site)<.1);
 for(let i=0;i<140;i++){interaction.step(null,false,.1);hold(interaction,{id:`encounter:wreck:${i}`,kind:'wreck'},12);}
 assert.ok(interaction.snapshot().stages.length<=128);
 interaction.reset();assert.deepEqual(interaction.snapshot().stages,[]);
});
test('every discovery type has a distinct action and reward description',()=>{
 const kinds=['wreck','distress','relic','bunker','convoy','patrol','friendly'];
 assert.equal(new Set(kinds.map(kind=>encounterInteractionSteps({kind})[0].action)).size,kinds.length);
 assert.equal(new Set(kinds.map(kind=>encounterRewardMessage({kind,reward:70}))).size,kinds.length);
});
