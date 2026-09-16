import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';

// Enemy construction only uses this canvas to seed the shared weave texture.
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){}})})};
const root=fileURLToPath(new URL('../',import.meta.url)),cache=path.join(root,'node_modules/.cache');
await mkdir(cache,{recursive:true});const temporary=path.join(cache,`blackline-actors-${process.pid}.mjs`);
await writeFile(temporary,ts.transpileModule(await readFile(path.join(root,'src/actors.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
const {createEnemy}=await import(pathToFileURL(temporary));await unlink(temporary);
function resources(actor){const geometry=new Set(),material=new Set();actor.group.traverse(o=>{if(o.isMesh){geometry.add(o.geometry);for(const m of [o.material].flat())material.add(m);}});return{geometry,material};}

test('streamed actors dispose private GPU resources exactly once without invalidating live actors',()=>{
 const scene=new THREE.Scene(),live=createEnemy(scene),liveResources=resources(live),sharedDisposals=[];
 for(const material of liveResources.material)material.addEventListener('dispose',()=>sharedDisposals.push(material));
 for(let cycle=0;cycle<12;cycle++){
  const actor=createEnemy(scene),r=resources(actor),own=[...r.material].filter(m=>!liveResources.material.has(m)),disposed=new Map();
  assert(own.length>=5,'rifle optics, role effects and muzzle flash are actor-owned');
  for(const resource of [...r.geometry,...own])resource.addEventListener('dispose',()=>disposed.set(resource,(disposed.get(resource)||0)+1));
  actor.dispose();actor.dispose();
  assert.equal(actor.group.parent,null);assert.equal(actor.hitMeshes.length,0);
  for(const resource of [...r.geometry,...own])assert.equal(disposed.get(resource),1);
  assert.equal(sharedDisposals.length,0,'disposing a scout must preserve every live actor resource');
  assert.equal(scene.children.length,1);
 }
 live.setRole('shielded');live.update(1/60,{time:1,moving:true,firing:true,dead:false,shield:20});
 live.dispose();assert.equal(scene.children.length,0);
});
