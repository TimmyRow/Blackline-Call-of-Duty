import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureProgression,validateSave} from '../src/progression.mjs';
import {createAdventure} from '../src/adventure.mjs';
import {debriefOffers,claimDebrief} from '../src/operation-debriefs.mjs';
const campaign=()=>ensureProgression(createAdventure());
test('field caches require a completed operation and its available, met resident',()=>{
 const c=campaign();c.contracts['op-rescue']='complete';
 assert.deepEqual(debriefOffers(c,'tomas'),[]);assert(!claimDebrief(c,'tomas','op-rescue').ok);
 c.metPeople=['tomas','lia','iris'];assert.equal(debriefOffers(c,'tomas')[0].id,'op-rescue');
 assert(!claimDebrief(c,'lia','op-rescue').ok);assert(!claimDebrief(c,'tomas','op-defense').ok);
 c.contracts['op-sabotage']='complete';assert.deepEqual(debriefOffers(c,'iris'),[]);c.completed.push('harbour');assert.equal(debriefOffers(c,'iris').length,1);
});
test('debrief cache pays once, preserves tracking and survives validated reloads',()=>{
 const c=campaign();c.metPeople=['lia'];c.contracts['op-escape']='complete';c.activeMission='main';c.tracked='relay';const salvage=c.salvage;
 assert(claimDebrief(c,'lia','op-escape').ok);assert.deepEqual(c.baseLocker,{reserve:60,grenades:1});assert.equal(c.salvage,salvage);assert.equal(c.activeMission,'main');assert.equal(c.tracked,'relay');
 const restored=validateSave({version:1,position:[0,20,0],campaign:c}).campaign;
 assert(!claimDebrief(restored,'lia','op-escape').ok);assert.deepEqual(restored.baseLocker,{reserve:60,grenades:1});assert(debriefOffers(restored,'lia')[0].claimed);
});
test('full lockers retain unclaimed caches until there is room; old saves gain offers',()=>{
 const c=campaign();delete c.debriefedOperations;c.metPeople=['tomas'];c.contracts['op-defense']='complete';
 for(const locker of [{reserve:541,grenades:0},{reserve:0,grenades:10}]){c.baseLocker={...locker};assert(!claimDebrief(c,'tomas','op-defense').ok);assert.deepEqual(c.baseLocker,locker);assert.equal(c.debriefedOperations,undefined);}
 c.baseLocker={reserve:540,grenades:9};assert(claimDebrief(c,'tomas','op-defense').ok);assert.deepEqual(c.baseLocker,{reserve:600,grenades:10});
 c.debriefedOperations.push('op-defense','op-rescue','unknown');assert.deepEqual(validateSave({version:1,position:[0,20,0],campaign:c}).campaign.debriefedOperations,['op-defense']);
});
