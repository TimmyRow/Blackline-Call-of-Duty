import test from 'node:test';
import assert from 'node:assert/strict';
import {canSupport,supportShot,mayBuddyRevive,medicAid} from '../src/squad-tactics.mjs';
test('companions leave distant camps to the player unless explicitly focused',()=>{
 assert.equal(canSupport({memberDistance:40,playerDistance:40}),false);
 assert.equal(canSupport({memberDistance:40,playerDistance:40,focused:true}),true);
 assert.equal(canSupport({memberDistance:25,playerDistance:20,holding:true}),false);
 assert.equal(canSupport({memberDistance:20,playerDistance:20,holding:true}),false);
 assert.equal(canSupport({memberDistance:2,playerDistance:2}),false);
});
test('combined support cannot clear a six-person camp while the player watches',()=>{
 let damage=0;
 for(let i=0;i<2;i++)for(let t=0,n=0;t<13;n++){
  const shot=supportShot(i,n);damage+=shot.damage;t+=shot.cooldown;
 }
 assert.ok(damage<100,`13 seconds of perfect sight support dealt ${damage}`);
 const normal=Array.from({length:20},(_,n)=>supportShot(0,n));
 const focused=Array.from({length:20},(_,n)=>supportShot(0,n,true));
 assert.ok(focused.reduce((s,x)=>s+x.damage,0)>normal.reduce((s,x)=>s+x.damage,0));
 assert.ok(normal.some(x=>!x.hit));
});
test('buddy revives respect hold orders and nearby threats',()=>{
 assert.equal(mayBuddyRevive(4,50),false);
 assert.equal(mayBuddyRevive(4,50,false,true),true);
 assert.equal(mayBuddyRevive(4,20),false);
 assert.equal(mayBuddyRevive(4,50,true),false);
 assert.equal(mayBuddyRevive(12,50),false);
});
test('requested medical support respects range, health, cooldown and upgrades',()=>{
 assert.equal(medicAid({health:20,distance:5}),35);
 assert.equal(medicAid({health:20,distance:5,level:2}),55);
 assert.equal(medicAid({health:90,distance:5,level:3}),10);
 assert.equal(medicAid({health:20,distance:20}),0);
 assert.equal(medicAid({health:20,distance:5,cooldown:1}),0);
 assert.equal(medicAid({health:20,distance:5,available:false}),0);
});
