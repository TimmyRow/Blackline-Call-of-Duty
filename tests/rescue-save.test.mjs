import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeOperations,normalizeRescuePositions} from '../src/field-operations.mjs';
import {validateSave} from '../src/progression.mjs';
import {storeSlot,readVault,checkpoint} from '../src/save-vault.mjs';
const positions=[[-162,25,156],[-159,26,157]];
const save=()=>({version:1,savedAt:100000,position:[-158,26,158],campaign:{operations:{'op-rescue':{stage:2,survivors:positions}},contracts:{'op-rescue':'active'},activeMission:'op-rescue'}});
test('escort locations survive validated autosaves, slots and recovery checkpoints',()=>{
 const raw=save(),valid=validateSave(raw),m=new Map(),storage={getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v)};
 assert.deepEqual(valid.campaign.operations['op-rescue'].survivors,positions);
 assert.notEqual(valid.campaign.operations['op-rescue'].survivors[0],positions[0]);
 assert(storeSlot(storage,'slot1',raw));assert(checkpoint(storage,raw));
 for(const id of ['slot1','checkpoint']){const c=readVault(storage,id).campaign;assert.deepEqual(c.operations['op-rescue'].survivors,positions);assert.equal(c.contracts['op-rescue'],'active');assert.equal(c.activeMission,'op-rescue');}
});
test('old saves keep their rescue stage while malformed or out-of-area actor positions are discarded',()=>{
 assert.deepEqual(normalizeOperations({'op-rescue':{stage:2}}),{'op-rescue':{stage:2}});
 for(const value of [null,[],[positions[0]],[positions[0],[NaN,25,150]],[positions[0],[-170,Infinity,150]],[positions[0],[20000,25,150]],[positions[0],[-170,1000,150]]])assert.equal(normalizeRescuePositions(value),null);
 for(const stage of [0,1,3])assert.deepEqual(normalizeOperations({'op-rescue':{stage,survivors:positions}}),{'op-rescue':{stage}});
 const raw=save();raw.campaign.operations['op-rescue'].survivors=[[],[]];assert.equal(validateSave(raw).campaign.operations['op-rescue'].stage,2);
});
