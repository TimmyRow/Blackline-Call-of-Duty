import {prepareShipPurchaseSave,crashfallStatus} from '../src/opening-mission.mjs';
import * as THREE from 'three';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdventure} from '../src/adventure.mjs';
import {ensureProgression,validateSave,resolveContracts} from '../src/progression.mjs';
import {mainQuest,speakMain,advanceStory} from '../src/story-quests.mjs';
import {CITY,HANGAR,SHIP_BERTH,ASTRA_APPROACH,PURCHASE_ROUTE,SHIP_PRICE,ownsShip,shipOffer,buyFirstShip} from '../src/ship-purchase.mjs';
import {heightAt,getSettlementBuildings} from '../src/region-layout.mjs';
const fresh=()=>{const c=ensureProgression(createAdventure());c.completed.push(PURCHASE_ROUTE);c.onboarding.stage='complete';return c;};
const at={x:HANGAR.x,y:HANGAR.elevation+1.7,z:HANGAR.z};
test('ground chapters precede city ship purchase, with enough main-mission income',()=>{
 const c=fresh();assert(!ownsShip(c));assert.equal(mainQuest(c).stage,'briefing');speakMain(c);
 for(const [site,next] of [['harbour','array'],['relay','ship-purchase']]){c.completed.push(site);c.salvage+=100;advanceStory(c);resolveContracts(c);assert.equal(mainQuest(c).stage,next);}
 assert.equal(mainQuest(c).target.id,HANGAR.id);assert(shipOffer(c).available);assert(c.salvage>=SHIP_PRICE);
 const money=c.salvage;assert(buyFirstShip(c,at).ok);assert.equal(c.salvage,money-SHIP_PRICE);assert(ownsShip(c));assert.equal(mainQuest(c).stage,'raider');
 assert(!buyFirstShip(c,at).ok);assert.equal(c.salvage,money-SHIP_PRICE);
});
test('purchase rejects early access, insufficient funds and remote or invalid positions',()=>{
 const c=fresh();c.salvage=999;assert(!buyFirstShip(c,at).ok);c.story.briefed=true;c.completed.push('harbour','relay');
 assert(!buyFirstShip(c,{...at,x:at.x+10}).ok);assert(!buyFirstShip(c,{...at,y:NaN}).ok);c.salvage=299;assert(!buyFirstShip(c,at).ok);assert.equal(c.salvage,299);assert.match(shipOffer(c).description,/earn 1 more/);
 c.salvage=300;assert(buyFirstShip(c,at).ok);assert.equal(c.salvage,0);
});
test('pending and purchased ownership survive saving; existing pilots keep their ships',()=>{
 const c=fresh();c.story.briefed=true;c.completed.push('harbour','relay');c.salvage=300;
 const saved=()=>validateSave({version:1,position:[at.x,at.y,at.z],campaign:c}).campaign;
 assert(!ownsShip(saved()));assert(buyFirstShip(c,at).ok);assert(ownsShip(saved()));assert.equal(saved().salvage,0);
 const legacy=ensureProgression(createAdventure());legacy.onboarding.stage='complete';assert(ownsShip(legacy));assert.equal(mainQuest(legacy).total,8);
});
test('city has dense buildings, a flat sales terminal and an unobstructed berth footprint',()=>{
 const buildings=getSettlementBuildings(CITY);assert.equal(buildings.length,12);assert.equal(heightAt(HANGAR.x,HANGAR.z),CITY.elevation);
 for(let dx=-6;dx<=6;dx+=2)for(let dz=-7;dz<=7;dz+=2){const x=SHIP_BERTH.x+dx,z=SHIP_BERTH.z+dz;assert.equal(heightAt(x,z),CITY.elevation);assert(!buildings.some(b=>Math.abs(x-CITY.x-b.a)<b.w/2&&Math.abs(z-CITY.z-b.c)<b.d/2));}
});

test('the curved Northwatch causeway stays dry and gently sloped all the way to the city',()=>{
 const curve=new THREE.CatmullRomCurve3(ASTRA_APPROACH.map(([x,z])=>new THREE.Vector3(x,0,z)),false,'centripetal');
 const points=curve.getSpacedPoints(500);let last=null;
 for(const p of points){const h=heightAt(p.x,p.z);assert(h>40);if(last)assert(Math.abs(h-last.h)/p.distanceTo(last.p)<.4);last={p,h};}
});

test('unfinished legacy cell saves cannot get stuck between the new and old openings',()=>{
 const c=ensureProgression(createAdventure());c.onboarding.stage='cell';prepareShipPurchaseSave(c);assert(!ownsShip(c));c.onboarding.stage='ship';assert.equal(crashfallStatus(c).stage,'regroup');prepareShipPurchaseSave(c);assert.equal(crashfallStatus(c).stage,'regroup');
 const older=ensureProgression(createAdventure());older.onboarding.stage='ship';prepareShipPurchaseSave(older);assert.equal(older.onboarding.stage,'complete');assert(!ownsShip(older));assert.equal(mainQuest(older).stage,'briefing');
 const pilot=ensureProgression(createAdventure());pilot.onboarding.stage='launch';prepareShipPurchaseSave(pilot);assert(ownsShip(pilot));
});
