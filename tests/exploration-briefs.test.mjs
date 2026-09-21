import test from 'node:test';
import assert from 'node:assert/strict';
import {explorationBriefs,explorationLeads} from '../src/frontier-discoveries.mjs';
const campaign=()=>({clues:['clue:evacuation-stop','clue:coast-lookout'],activeMission:'main',tracked:'mara'});
test('nearby journal leads sort by distance, describe the approach and preserve tracking',()=>{
 const c=campaign(),before=JSON.stringify(c),leads=explorationBriefs(c,{x:240,y:1,z:800});
 assert.equal(leads[0].target.id,'clue:wayfarer-buoy');assert.equal(leads[0].distance,20);assert.equal(leads[0].travelLabel,'20 m N · LEVEL');assert.match(leads[0].context,/Ocean signal · Bring a launch/);assert.match(leads[1].context,/Cave archive · Approach on foot/);
 assert.equal(JSON.stringify(c),before);assert.equal(explorationLeads(c)[0].target.id,'clue:basalt-gate');
});
test('planet sectors are not presented as walkable distances or compass bearings',()=>{
 for(const lead of explorationBriefs(campaign(),{x:42000,y:58,z:35})){assert.equal(lead.distance,null);assert.equal(lead.travelLabel,'Return to Orison · Planet jump required');}
});
test('arrival and elevation labels distinguish signals below the player',()=>{
 assert.equal(explorationBriefs(campaign(),{x:240,y:1,z:780})[0].travelLabel,'At the signal');
 assert.equal(explorationBriefs(campaign(),{x:240,y:101,z:780})[0].travelLabel,'100 m · ↓ 100 m');
 assert.deepEqual(explorationBriefs({clues:[]},{x:0,y:0,z:0}),[]);
});
