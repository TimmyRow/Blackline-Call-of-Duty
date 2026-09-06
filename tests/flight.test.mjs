import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {REGION_START,getLandingPads} from '../src/region-layout.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const cache=path.join(root,'node_modules/.cache');await mkdir(cache,{recursive:true});
const temporary=path.join(cache,`blackline-flight-${process.pid}.mjs`);
const source=(await readFile(path.join(root,'src/flight.ts'),'utf8')).replace("'./region-layout.mjs'",JSON.stringify(pathToFileURL(path.join(root,'src/region-layout.mjs')).href));
await writeFile(temporary,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
const {createFlight}=await import(pathToFileURL(temporary));await unlink(temporary);
await RAPIER.init();
const keys=(...codes)=>new Set(codes);
const tick=(ship,codes,frames=1)=>{for(let i=0;i<frames;i++)ship.step(1/60,{keys:keys(...codes),yaw:0,pitch:0});};

test('VTOL requires nearby boarding and landed safe disembarkation',()=>{
 const world=new RAPIER.World({x:0,y:-9.81,z:0}),ship=createFlight(new THREE.Scene(),world);
 assert.equal(ship.board(new THREE.Vector3(500,0,500)),false);
 assert.equal(ship.board(ship.position.clone()),true);
 const start=ship.position.y;tick(ship,['Space'],120);
 assert.ok(ship.position.y>start+90);assert.equal(ship.landed,false);assert.equal(ship.tryExit(),null);
 tick(ship,['ControlLeft'],240);
 assert.equal(ship.landed,true);assert.ok(ship.tryExit() instanceof THREE.Vector3);assert.equal(ship.piloting,false);world.free();
});

test('boost movement sweeps the whole path against buildings',()=>{
 const world=new RAPIER.World({x:0,y:-9.81,z:0}),ship=createFlight(new THREE.Scene(),world);
 const wallZ=ship.position.z-45;
 world.createCollider(RAPIER.ColliderDesc.cuboid(70,80,1).setTranslation(ship.position.x,ship.position.y+20,wallZ));world.step();
 ship.board(ship.position.clone());tick(ship,['Space'],25);tick(ship,['KeyW','ShiftLeft'],130);
 assert.ok(ship.position.z>wallZ+2.5,'the ship must remain in front of the wall even at boost speed');
 assert.ok(ship.snapshot().collisionCount>0);assert.ok(ship.health<100);world.free();
});

test('ship can land on an elevated station deck and exit at deck height',()=>{
 const pad=getLandingPads(1150,470,100).find(p=>p.id==='station');assert.ok(pad);
 const world=new RAPIER.World({x:0,y:-9.81,z:0});
 world.createCollider(RAPIER.ColliderDesc.cuboid(40,1,40).setTranslation(pad.x,pad.y-1,pad.z));world.step();
 const ship=createFlight(new THREE.Scene(),world,{x:pad.x,z:pad.z,y:pad.y+65});
 ship.board(ship.position.clone());tick(ship,['Space']);tick(ship,['KeyC'],240);
 assert.equal(ship.landed,true);assert.equal(ship.snapshot().pad,pad.name);assert.ok(Math.abs(ship.position.y-(pad.y+2.15))<.001);
 const exit=ship.tryExit();assert.ok(exit);assert.ok(Math.abs(exit.y-(pad.y+1.7))<.001);world.free();
});

test('ocean hover never permits disembarking into water',()=>{
 const world=new RAPIER.World({x:0,y:-9.81,z:0});
 const ship=createFlight(new THREE.Scene(),world,{x:240,z:1040,y:60});ship.board(ship.position.clone());tick(ship,['Space']);tick(ship,['KeyC'],240);
 assert.equal(ship.landed,false);assert.equal(ship.tryExit(),null);assert.ok(ship.position.y>=2.15);world.free();
});

test('ship cannons respect cooldown and recharge',()=>{
 const world=new RAPIER.World({x:0,y:-9.81,z:0}),ship=createFlight(new THREE.Scene(),world);
 assert.equal(ship.fire(),null);ship.board(ship.position.clone());
 const first=ship.fire();assert.ok(first);assert.ok(Math.abs(first.direction.length()-1)<.00001);assert.equal(ship.fire(),null);
 for(let i=0;i<50;i++){tick(ship,[],9);ship.fire();}
 assert.ok(ship.snapshot().energy<10);tick(ship,[],600);assert.equal(ship.snapshot().energy,100);world.free();
});
