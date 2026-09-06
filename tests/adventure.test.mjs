import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdventure,stepAdventure,siteDistance,interactionLabel} from '../src/adventure.mjs';
import {REGION_SITES,SPECIAL_SITES,getWorldSites,heightAt} from '../src/region-layout.mjs';

const at=site=>({x:site.x,y:site.elevation+1.7,z:site.z});
const empty=()=>0;

test('discoveries persist without automatically looting or requiring an objective order',()=>{
 const state=createAdventure();
 for(const site of [...SPECIAL_SITES,...REGION_SITES])stepAdventure(state,[site],at(site),false,10,empty,10);
 assert.equal(state.discovered.length,6);assert.equal(state.completed.length,0);assert.equal(state.tracked,null);
 const site=REGION_SITES[2];stepAdventure(state,[site],at(site),true,2.5,empty,20);
 assert.deepEqual(state.completed,[site.id]);assert.equal(state.raids,1);
 stepAdventure(state,[site],at(site),false,1,empty,30);assert.equal(state.discovered.length,6);
});

test('pirate guards prevent cargo collection until cleared',()=>{
 const state=createAdventure(),site=REGION_SITES[0];
 stepAdventure(state,[site],at(site),true,8,()=>3,10);assert.equal(state.salvage,0);assert.equal(state.progress[site.id]??0,0);
 assert.match(interactionLabel(state,site,3,10),/3 PIRATES REMAIN/);
 assert.equal(stepAdventure(state,[site],at(site),true,2.5,empty,15).type,'loot');
 assert.equal(state.salvage,100);assert.equal(state.raids,1);
});

test('cargo interactions require actual three-dimensional proximity and sustained input',()=>{
 const state=createAdventure(),site=SPECIAL_SITES.find(s=>s.id==='station');
 assert(siteDistance({...at(site),y:20},site)>1700);
 stepAdventure(state,[site],{...at(site),y:20},true,10,empty,10);assert.equal(state.salvage,0);
 stepAdventure(state,[site],at(site),true,1,empty,11);assert.equal(state.progress[site.id],1);
 stepAdventure(state,[site],{...at(site),x:site.x+10},true,.5,empty,12);assert.equal(state.progress[site.id],.5);
 stepAdventure(state,[site],at(site),false,.5,empty,13);assert.equal(state.progress[site.id],0);
 assert.equal(state.completed.length,0);
});

test('secured sites retain completion and cannot grant duplicate salvage on revisits',()=>{
 const site=SPECIAL_SITES.find(s=>s.kind==='pirate-ship'),state=createAdventure();
 stepAdventure(state,[site],at(site),true,2.5,empty,10);assert.equal(state.salvage,180);
 const persisted=JSON.parse(JSON.stringify(state));
 stepAdventure(persisted,[],{x:5000,y:100,z:5000},false,10,empty,20);
 stepAdventure(persisted,[site],at(site),true,10,empty,30);
 assert.equal(persisted.salvage,180);assert.equal(persisted.raids,1);assert.deepEqual(persisted.completed,[site.id]);
 assert.match(interactionLabel(persisted,site,0,30),/REPLENISHING/);
});

test('captured pirate sites become resupply bases without duplicate raid rewards',()=>{
 const state=createAdventure(),site=REGION_SITES[0];stepAdventure(state,[site],at(site),true,2.5,empty,10);
 assert.equal(stepAdventure(state,[site],at(site),true,1.2,empty,12).type,'resupply');
 assert.equal(stepAdventure(state,[site],at(site),true,10,empty,20),null);
 assert.equal(stepAdventure(state,[site],at(site),true,1.2,empty,32).type,'resupply');
 assert.equal(state.salvage,100);assert.equal(state.raids,1);assert.deepEqual(state.completed,[site.id]);
});

test('friendly carrier resupplies repeatedly with cooldown, without counting as a raid',()=>{
 const state=createAdventure(),site=SPECIAL_SITES.find(s=>s.faction==='friendly');
 assert.equal(stepAdventure(state,[site],at(site),true,1.2,()=>99,10).type,'resupply');
 assert.equal(state.visited[site.id],true);assert.equal(state.salvage,0);assert.equal(state.raids,0);assert.deepEqual(state.completed,[]);
 assert.match(interactionLabel(state,site,0,11),/REPLENISHING/);
 assert.equal(stepAdventure(state,[site],at(site),true,10,empty,11),null);
 assert.equal(stepAdventure(state,[site],at(site),true,1.2,empty,30).type,'resupply');
});

test('neutral relics reward exploration without pirate combat requirements',()=>{
 const state=createAdventure(),site={id:'test-ruin',x:10000,z:10000,elevation:50,radius:45,kind:'ruin',faction:'neutral'};
 assert.equal(stepAdventure(state,[site],at(site),true,2.5,()=>12,10).type,'loot');
 assert.equal(state.salvage,60);assert.equal(state.raids,0);
});

test('finishing every initial hostile site leaves the expedition open for future discoveries',()=>{
 const state=createAdventure();
 for(const site of [...REGION_SITES,...SPECIAL_SITES].filter(s=>s.faction==='pirate'))stepAdventure(state,[site],at(site),true,2.5,empty,10);
 assert.equal(state.completed.length,5);assert.equal('extracted' in state,false);assert.equal('won' in state,false);
 const future=getWorldSites(12000,12000,3000).find(s=>s.faction==='pirate');assert(future);
 const before=state.salvage;assert.equal(stepAdventure(state,[future],at(future),true,2.5,empty,100).type,'loot');assert.equal(state.salvage,before+100);
});

test('distant procedural terrain and places are deterministic beyond the original island',()=>{
 for(const [x,z] of [[12000,12000],[-15000,5000],[85000,-22000]]){
  const sites=getWorldSites(x,z,3000);assert(sites.length>0);assert.deepEqual(sites,getWorldSites(x,z,3000));
  assert.equal(new Set(sites.map(s=>s.id)).size,sites.length);assert(Number.isFinite(heightAt(x,z)));
  for(const site of sites)assert.equal(heightAt(site.x,site.z),site.elevation);
 }
});
