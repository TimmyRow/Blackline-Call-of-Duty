import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import ts from 'typescript';
import * as THREE from 'three';
const cache=new URL('../node_modules/.cache/',import.meta.url);await mkdir(cache,{recursive:true});const file=new URL(`pirates-${process.pid}.mjs`,cache);await writeFile(file,ts.transpileModule(await readFile(new URL('../src/space-pirates.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);const {createSpacePirates}=await import(file.href);await unlink(file);
test('cannon obstruction limit prevents an interceptor hit behind solid cover',()=>{const p=createSpacePirates(new THREE.Scene()),origin=new THREE.Vector3(0,600,0);p.step(.01,origin,true,()=>{},()=>{});assert(p.raiders.length>0);const enemy=p.raiders[0],direction=enemy.position.clone().sub(origin).normalize(),before=enemy.health;assert.equal(p.hit(origin,direction,1),null);assert.equal(enemy.health,before);assert(p.hit(origin,direction,900));assert(enemy.health<before);p.reset();});
test('cleared air sectors do not instantly respawn the same encounter',()=>{const p=createSpacePirates(new THREE.Scene()),position=new THREE.Vector3(0,600,0);p.step(.01,position,true,()=>{},()=>{});for(const r of p.raiders)r.health=0;p.step(.01,position,true,()=>{},()=>{});p.step(.01,position,true,()=>{},()=>{});assert.equal(p.raiders.length,0);position.x=3000;p.step(.01,position,true,()=>{},()=>{});assert(p.raiders.length>0);p.reset();});
