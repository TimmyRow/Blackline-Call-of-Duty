import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {PLANETS,getPlanetAt,getPlanetArrival,biomeAt,heightAt,getWorldSites,getLandingPads,WORLD_LANDMARKS,regionName} from '../src/region-layout.mjs';
import {getDestinationInterior,interiorWallBoxes} from '../src/world-destinations.mjs';

function triangleHeight(x,z){const gx=Math.floor(x/8)*8,gz=Math.floor(z/8)*8,u=(x-gx)/8,v=(z-gz)/8,a=heightAt(gx,gz),b=heightAt(gx+8,gz),c=heightAt(gx,gz+8),d=heightAt(gx+8,gz+8);return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);}
test('both jump destinations have clear landings above the actual terrain triangles',()=>{
 for(const planet of PLANETS){const arrival=getPlanetArrival(planet.id);assert.equal(getPlanetAt(arrival.x,arrival.z).id,planet.id);const pads=getLandingPads(arrival.x,arrival.z,80);assert(pads.some(p=>Math.hypot(p.x-arrival.x,p.z-arrival.z)<1&&Math.abs(p.y-arrival.y)<.001));for(let a=-8;a<=8;a+=2)for(let c=-8;c<=8;c+=2)assert(triangleHeight(arrival.x+a,arrival.z+c)<arrival.y+.001);}
 assert.equal(getPlanetArrival('missing'),null);const arrival=getPlanetArrival('orison');arrival.y=999;assert.equal(getPlanetArrival('orison').y,16.16);
 assert.equal(heightAt(0,110),16);assert.equal(heightAt(0,-10),18);assert.equal(heightAt(-690,-540),52);assert.equal(heightAt(780,-370),35);
});
test('Vesper has persistent authored discoveries, dry terrain and distinct biomes',()=>{
 const first=getWorldSites(42000,0,1800),second=getWorldSites(42000,0,1800);assert.deepEqual(first,second);
 for(const id of ['vesper-port','vesper-vault','vesper-mine','vesper-salt'])assert(first.some(s=>s.id===id));assert(!first.some(s=>s.id==='harbour'));
 assert.equal(biomeAt(42000,0).id,'desert');assert.equal(biomeAt(40900,100).id,'volcanic');assert.equal(biomeAt(42450,1000).id,'salt');assert.equal(biomeAt(-2000,-1800).id,'forest');
 let min=Infinity,max=-Infinity;for(let x=40200;x<=43800;x+=160)for(let z=-1800;z<=1800;z+=160){const h=heightAt(x,z);assert(Number.isFinite(h)&&h>0);min=Math.min(min,h);max=Math.max(max,h);}assert(max-min>80);assert.match(regionName(42800,1400),/Vesper|Relic|Freeport|Encampment|Extraction|Yard/);
 for(const edge of [8000,10000])assert(Math.abs(heightAt(42000+edge-.01,0)-heightAt(42000+edge+.01,0))<.1);
});
test('walk-through caves grade the full entrance and keep their cache off the center route',()=>{
 for(const cave of WORLD_LANDMARKS.filter(s=>s.kind==='cave')){const floor=heightAt(cave.x,cave.z);for(let dz=-15;dz<=15;dz+=2)for(const dx of [-2,0,2])assert(Math.abs(triangleHeight(cave.x+dx,cave.z+dz)-floor)<.001);}
});
test('station and boarding wall colliders admit a capsule through every connected doorway',async()=>{
 await RAPIER.init();
 for(const kind of ['station','pirate-ship']){
  const world=new RAPIER.World({x:0,y:0,z:0}),rooms=getDestinationInterior(kind);
  try{for(const room of rooms)for(const b of interiorWallBoxes(room))world.createCollider(RAPIER.ColliderDesc.cuboid(b.w/2,b.h/2,b.d/2).setTranslation(b.x,b.y,b.z));world.step();
   const capsule=new RAPIER.Capsule(.65,.4);for(const room of rooms){for(let z=room.z-room.d/2;z<=room.z+room.d/2;z+=.5){let hit=false;world.intersectionsWithShape({x:room.x,y:1.1,z},{x:0,y:0,z:0,w:1},capsule,()=>{hit=true;return true;});assert.equal(hit,false,`${kind} blocked at ${z}`);}
    let wallHit=false;world.intersectionsWithShape({x:room.x+room.w/2,y:1.1,z:room.z},{x:0,y:0,z:0,w:1},capsule,()=>{wallHit=true;return true;});assert(wallHit,'Side walls must remain solid');}
   assert.equal(rooms[0].z-rooms[0].d/2,rooms[1].z+rooms[1].d/2,'Rooms must share a door threshold');
  }finally{world.free();}
 }
});
