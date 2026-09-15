import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdventure} from '../src/adventure.mjs';
import {ensureProgression,validateSave,resolveContracts} from '../src/progression.mjs';
import {OPERATIONS,operationEnemies,operationWaveIds,createOperationRunner,operationBlocked} from '../src/field-operations.mjs';
import {claimDiscovery,finishOceanEvent,BOARDERS} from '../src/frontier-discoveries.mjs';
import {serviceAction} from '../src/base-services.mjs';
import {storeSlot,readVault,checkpoint,vaultEntries} from '../src/save-vault.mjs';
import {assistedDescent,tacticalIntent} from '../src/tactical-planner.mjs';
const fresh=()=>ensureProgression(createAdventure());
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
const saved=(campaign,time=100000)=>validateSave({version:1,campaign,position:[0,18,110],savedAt:time});
function hold(r,c,op,guards=0,health=new Map()){let event=null;for(let i=0;i<15;i++)event=r.step(c,op,true,.1,guards,health)||event;return event;}
test('infiltration allows live sentries, rescue requires clearance, held input cannot skip phases',()=>{
 const c=fresh(),r=createOperationRunner(),op=OPERATIONS[0];c.contracts[op.id]='active';assert.equal(operationEnemies(c,{x:op.x,z:op.z},()=>20).length,2);
 assert.equal(hold(r,c,op,2).stage,1);assert.equal(hold(r,c,op,2),null);r.step(c,null,false,.1,0,new Map());assert.equal(hold(r,c,op,2).stage,2);
 const rescue=OPERATIONS[1];r.reset();assert.equal(hold(r,c,rescue,1),null);assert.equal(hold(r,c,rescue,0).stage,1);
});
test('defense waits for confirmed wave deaths and saves retain objective phase',()=>{
 const c=fresh(),op=OPERATIONS[2],r=createOperationRunner();c.contracts[op.id]='active';hold(r,c,op);r.step(c,null,false,.1,0,new Map());
 assert(operationBlocked(c,op,0,new Map()));assert.equal(hold(r,c,op),null);
 const dead=new Map(operationWaveIds(op,1).map(id=>[id,0]));assert.equal(hold(r,c,op,0,dead).stage,2);
 const restored=saved(c).campaign;assert.equal(restored.operations[op.id].stage,2);assert(operationBlocked(restored,op,0,dead),'first-wave deaths cannot clear second wave');
 restored.operations[op.id].stage=4;assert.equal(resolveContracts(restored).length,1);assert.equal(resolveContracts(restored).length,0);
});
test('clues, rare equipment and ocean rescue reward once across save/load',()=>{
 const c=fresh();claimDiscovery(c,'clue:survey-wreck');assert(c.blueprints.includes('handling'));const d=saved(c).campaign;assert.equal(claimDiscovery(d,'clue:survey-wreck'),null);claimDiscovery(d,'clue:wayfarer-buoy');assert.equal(finishOceanEvent(d,new Map()),false);const hp=new Map(BOARDERS.map(id=>[id,0]));assert.equal(finishOceanEvent(d,hp),true);assert.equal(finishOceanEvent(d,hp),false);
});
test('manual slots are independent and recovery keeps previous safe checkpoint',()=>{
 const c=fresh(),s=storage();assert(storeSlot(s,'slot1',saved(c)));c.salvage=240;assert(checkpoint(s,saved(c,200000)));c.salvage=400;assert(checkpoint(s,saved(c,300000)));assert.equal(readVault(s,'previous').campaign.salvage,240);assert.equal(readVault(s,'slot1').campaign.salvage,0);assert.equal(vaultEntries(null).filter(e=>e.available).length,0);assert.equal(storeSlot(s,'../../bad',saved(c)),false);
});
test('locker conserves equipment and services require a base and funds',()=>{
 const c=fresh(),state={reserve:100,grenades:3,health:20,energy:5};assert.equal(serviceAction(c,state,'repair',true).ok,false);assert.equal(serviceAction(c,state,'deposit',false).ok,false);serviceAction(c,state,'deposit',true);assert.equal(state.reserve+c.baseLocker.reserve,100);assert.equal(state.grenades+c.baseLocker.grenades,3);serviceAction(c,state,'withdraw',true);assert.equal(state.reserve,100);assert.equal(state.grenades,3);c.salvage=20;serviceAction(c,state,'repair',true);assert.equal(c.salvage,0);assert.equal(state.health,100);assert.equal(saved(c).campaign.baseLocker.reserve,0);
});
test('landing aid slows safe approaches and retreat/search obey tactical context',()=>{
 assert.equal(assistedDescent(2,-180),-2);assert.equal(assistedDescent(2,-180,true,false),-180);assert.equal(assistedDescent(2,80),80);
 const base={distance:10,preferredRange:20,range:50};assert.equal(tacticalIntent('scout',{...base,healthRatio:.2}).mode,'retreat');assert.equal(tacticalIntent('scout',{...base,visible:false}).advance,1);
});
