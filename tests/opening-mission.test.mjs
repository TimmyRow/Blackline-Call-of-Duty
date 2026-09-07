import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdventure} from '../src/adventure.mjs';
import {ensureProgression,validateSave} from '../src/progression.mjs';
import {beginCrashfall,crashfallStatus,crashfallEnemies,stepCrashfall,CRASHFALL_RAIDERS,CRASHFALL_RALLY,recoveryBrief} from '../src/opening-mission.mjs';
import {personDialogue} from '../src/story-quests.mjs';
import {QUEST_PEOPLE} from '../src/quest-data.mjs';
const fresh=()=>{const c=ensureProgression(createAdventure());c.onboarding.stage='cell';return c;};
const rally={x:CRASHFALL_RALLY.x,y:CRASHFALL_RALLY.elevation+1.7,z:CRASHFALL_RALLY.z};
function regroup(c){let event;for(let i=0;i<7;i++)event=stepCrashfall(c,rally,true,.1,new Map())||event;return event;}
test('fresh arrival opens a short survivor defense only after recovering the cell',()=>{
 const c=fresh();assert(beginCrashfall(c));assert(!beginCrashfall(c));assert.equal(crashfallStatus(c),null);
 assert.equal(recoveryBrief(c).title,'Escape the wreck');c.onboarding.stage='ship';assert.equal(crashfallStatus(c).stage,'regroup');
 assert.equal(crashfallEnemies(c,rally).length,0);assert.equal(regroup(c),'regroup');assert.equal(crashfallStatus(c).stage,'defend');assert.equal(crashfallEnemies(c,rally).length,3);
});
test('survivor defense requires every confirmed kill, grants once and survives reload',()=>{
 const c=fresh();beginCrashfall(c);c.onboarding.stage='ship';regroup(c);
 const health=new Map(CRASHFALL_RAIDERS.slice(0,2).map(e=>[e.id,0]));assert.equal(stepCrashfall(c,rally,false,.1,health),null);
 const saved=validateSave({version:1,position:[rally.x,rally.y,rally.z],campaign:c}).campaign;assert.equal(crashfallStatus(saved).stage,'defend');
 health.set(CRASHFALL_RAIDERS[2].id,-10);assert.equal(stepCrashfall(saved,rally,false,.1,health),'defended');assert.equal(saved.salvage,60);
 assert.equal(stepCrashfall(saved,rally,false,.1,health),null);assert.equal(saved.salvage,60);assert.equal(crashfallEnemies(saved,rally).length,0);assert.equal(recoveryBrief(saved).title,'Find your ship');
 assert.equal(saved.encountersCompleted.length,0,'tutorial milestones must not count as side-quest distress signals');
});
test('older expeditions never get a new tutorial gate and leaving the rally cancels the hold',()=>{
 const c=fresh();c.onboarding.stage='ship';assert.equal(crashfallStatus(c),null);assert(!beginCrashfall(c));
 c.onboarding.stage='cell';beginCrashfall(c);c.onboarding.stage='ship';stepCrashfall(c,rally,true,.1,new Map());assert.equal(c.onboarding.progress,.1);
 stepCrashfall(c,{...rally,x:rally.x+30},true,.1,new Map());assert.equal(c.onboarding.progress,0);assert.equal(crashfallStatus(c).stage,'regroup');
 regroup(c);assert.equal(crashfallEnemies(c,{x:42000,z:0}).length,0);c.onboarding.stage='complete';assert.equal(crashfallStatus(c),null);
});
test('town residents acknowledge accepted and completed work without changing rewards',()=>{
 const c=fresh(),lia=QUEST_PEOPLE.find(p=>p.id==='lia');assert.equal(personDialogue(lia,c),lia.greeting);
 c.contracts.survey='active';assert.equal(personDialogue(lia,c),lia.followup);c.contracts.survey='complete';assert(personDialogue(lia,c).includes(lia.thanks));
 c.contracts.surveyor='complete';assert.equal(personDialogue(lia,c),lia.thanks);assert.equal(c.salvage,0);
});
