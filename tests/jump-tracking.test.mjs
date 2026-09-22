import test from 'node:test';
import assert from 'node:assert/strict';
import {jumpTrackedId} from '../src/navigation.mjs';
test('planet jumps preserve manual clues, main quest residents and operation targets',()=>{
 for(const id of ['clue:basalt-gate','person:mara','encounter:distress:coast','vesper-vault']){
  const target={id,x:10,z:97};for(const planet of ['orison','vesper'])assert.equal(jumpTrackedId(target,planet),id);
  assert.deepEqual(target,{id,x:10,z:97});
 }
 assert.equal(jumpTrackedId({id:'corsair-objective'},'vesper'),'corsair');
});
test('only an absent or own-ship target selects an arrival landmark',()=>{
 for(const target of [null,undefined,{id:'kestrel'}]){
  assert.equal(jumpTrackedId(target,'vesper'),'vesper-port');assert.equal(jumpTrackedId(target,'orison'),'kestrel');
 }
});
