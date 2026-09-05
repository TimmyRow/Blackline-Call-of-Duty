import test from 'node:test';
import assert from 'node:assert/strict';
import {reloadAmmo,bulletDamage,canInteract,grenadeDamage} from '../src/rules.mjs';
test('reload transfers only available ammunition',()=>{assert.deepEqual(reloadAmmo(24,2),{ammo:26,reserve:0});assert.deepEqual(reloadAmmo(0,180),{ammo:30,reserve:150});assert.deepEqual(reloadAmmo(30,10),{ammo:30,reserve:10});});
test('headshots kill while body damage falls off at long range',()=>{assert.ok(bulletDamage(true,40)>=100);assert.ok(bulletDamage(false,40)<bulletDamage(false,10));});
test('uplink requires proximity and all hostiles cleared',()=>{assert.equal(canInteract({x:0,z:0},{x:0,z:2},0),true);assert.equal(canInteract({x:0,z:0},{x:0,z:2},1),false);assert.equal(canInteract({x:0,z:0},{x:0,z:6},0),false);});
test('grenade damage falls off to zero without becoming negative',()=>{assert.equal(grenadeDamage(0),150);assert.equal(grenadeDamage(7),0);assert.equal(grenadeDamage(10),0);});
