import test from 'node:test';
import assert from 'node:assert/strict';
import {targetNavigation,flightGuidance} from '../src/navigation.mjs';
test('selected signal gives one shared world distance, elevation and bearing',()=>{
 const n=targetNavigation({x:0,y:10,z:0},0,{x:0,z:-30,elevation:50});
 assert.equal(n.distance,50);assert.equal(n.distanceLabel,'50 m');assert.equal(n.verticalLabel,'↑ 40 m');assert.equal(n.arrow,'◇');assert.equal(n.offscreen,false);
 assert.equal(targetNavigation({x:0,y:100,z:0},0,{x:-30,z:0,y:50}).arrow,'◀');
 assert.equal(targetNavigation({x:0,y:100,z:0},0,{x:30,z:0,y:50}).verticalLabel,'↓ 50 m');
});
test('bearing wraps across north and long journeys use km',()=>{
 const n=targetNavigation({x:0,y:0,z:0},Math.PI/180,{x:0,z:-42000,elevation:0});
 assert.equal(n.delta,1);assert.equal(n.distanceLabel,'42.0 km');assert.equal(n.verticalLabel,'LEVEL');assert.equal(targetNavigation({x:0,z:0},0,null),null);
});
test('landing guidance distinguishes hostile deck and approach braking',()=>{
 const input={position:{x:0,y:200,z:0},tracked:{x:20,z:0,elevation:180,kind:'carrier',faction:'pirate'},speed:28,altitude:20,landed:false};
 const fast=flightGuidance(input);assert.equal(fast.label,'HOSTILE DECK');assert.match(fast.detail,/BRAKE/);assert.match(fast.detail,/deck 180 m/);assert.equal(fast.danger,true);
 assert.doesNotMatch(flightGuidance({...input,speed:10}).detail,/BRAKE/);assert.equal(flightGuidance({...input,landed:true}).label,'GEAR LOCKED');
});
