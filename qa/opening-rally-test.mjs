import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {CRASHFALL_RALLY} from '../src/opening-mission.mjs';
import {heightAt} from '../src/region-layout.mjs';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const page=await browser.newPage({viewport:{width:1440,height:900}}),checks=[],errors=[],evidence={automation:'Teleportation positions the player; E/F and UI buttons exercise real interactions. One raider uses weapon raycasts; remaining enemies use QA.clear.'};
page.on('pageerror',error=>errors.push(error.message));
const snap=()=>page.evaluate(()=>window.blacklineQA.snapshot());
const ready=()=>page.waitForFunction(()=>window.blacklineQA,null,{timeout:90000});
async function check(name,run){await run();checks.push(name);console.log('PASS '+name);}
async function holdUntil(predicate){await page.keyboard.down('e');try{await page.waitForFunction(predicate,null,{timeout:15000});}finally{await page.keyboard.up('e');}}
async function approach(id){await page.evaluate(id=>{const q=window.blacklineQA,p=q.snapshot().people.find(p=>p.personId===id);q.teleport3(p.x,p.elevation+1.7,p.z+2.4);q.look(0,0);},id);await page.waitForFunction(id=>document.getElementById('prompt-text').textContent.includes(id),id==='lia'?'LIA SEN':'MARA VOSS');await page.waitForFunction(()=>Number(getComputedStyle(document.getElementById('region-arrival')).opacity)<.01);}
async function talk(id){await approach(id);await page.keyboard.down('e');try{await page.waitForFunction(id=>window.blacklineQA.snapshot().talking===id,id);}finally{await page.keyboard.up('e');}}
try{
 await page.goto(process.env.BLACKLINE_URL||'http://localhost:5180');await ready();await page.selectOption('#quality','low',{force:true});
 await check('New story can skip arrival and hold to recover the physical emergency cell',async()=>{
  await page.evaluate(()=>{const q=window.blacklineQA;q.newStory();q.skipArrival();});
  assert.equal((await snap()).campaign.onboarding.stage,'cell');
  await page.evaluate(y=>window.blacklineQA.teleport3(0,y+1.7,206),heightAt(0,206));
  await holdUntil(()=>window.blacklineQA.snapshot().campaign.onboarding.stage==='ship');
  assert.equal((await snap()).crashfall.stage,'regroup');await page.waitForFunction(()=>document.getElementById('waypoint-label').textContent.includes('SURVIVOR RALLY'));
 });
 await check('Rally hold creates exactly three scout raiders without installing the ship cell',async()=>{
  await page.evaluate(r=>{const q=window.blacklineQA;q.teleport3(r.x,r.elevation+1.7,r.z+2);q.look(0,-.03);},CRASHFALL_RALLY);
  await page.waitForFunction(()=>document.getElementById('prompt-text').textContent.includes('REGROUP'));
  assert(await page.locator('#world-waypoint').isHidden());assert.equal((await snap()).squad.order,'hold');
  await page.screenshot({path:'qa/opening-rally-regroup.png'});
  await holdUntil(()=>window.blacklineQA.snapshot().crashfall?.stage==='defend');
  const s=await snap(),raiders=s.enemyPositions.filter(e=>e.active&&e.site==='crashfall');assert.equal(raiders.length,3);assert(raiders.every(e=>e.role==='scout'));assert.equal(s.campaign.onboarding.stage,'ship');evidence.raiders=raiders;
  await page.screenshot({path:'qa/opening-rally-defense.png'});
 });
 await check('Real ballistic raycasts kill a raider; missing death records keep defense active',async()=>{
  const target=(await snap()).enemyPositions.find(e=>e.active&&e.site==='crashfall'&&e.health>0);assert(target);
  await page.evaluate(t=>{const q=window.blacklineQA;q.teleport3(t.position[0],t.position[1]+1.7,t.position[2]+9);},target);
  await page.waitForFunction(id=>{
   const q=window.blacklineQA,s=q.snapshot(),e=s.enemyPositions.find(e=>e.id===id);if(!e)return false;
   const dx=e.position[0]-s.position[0],dz=e.position[2]-s.position[2],dy=e.position[1]+1.15-s.position[1];
   q.look(Math.atan2(-dx,-dz),Math.atan2(dy,Math.hypot(dx,dz)));q.fire();return e.health<=0;
  },target.id,{timeout:12000});
  const s=await snap();assert.equal(s.crashfall.stage,'defend');evidence.weaponRaycast={target:target.id,health:s.enemyPositions.find(e=>e.id===target.id).health,ammo:s.ammo};
 });
 await check('Finishing the defense pays once and tracks the ship; a save reload preserves it',async()=>{
  const before=(await snap()).campaign.salvage;await page.evaluate(()=>window.blacklineQA.clear());
  await page.waitForFunction(()=>!window.blacklineQA.snapshot().crashfall);assert.equal((await snap()).campaign.salvage,before+60);
  await page.waitForFunction(()=>document.getElementById('waypoint-label').textContent.includes('KESTREL'));
  assert(await page.evaluate(()=>window.blacklineQA.save()));await page.reload();await ready();await page.locator('#deploy').click();
  await page.waitForFunction(()=>window.blacklineQA.snapshot().mode==='playing');const s=await snap();assert(!s.opening.active);assert(!s.crashfall);assert.equal(s.campaign.salvage,before+60);assert.equal(s.campaign.onboarding.stage,'ship');evidence.defenseReward=s.campaign.salvage;
 });
 await check('Install the cell and board Kestrel to reach the main town briefing',async()=>{
  await page.evaluate(()=>{const q=window.blacklineQA,f=q.snapshot().flight;q.teleport3(f.position[0]+2,f.position[1]+.7,f.position[2]);});
  await holdUntil(()=>window.blacklineQA.snapshot().campaign.onboarding.stage==='launch');await page.keyboard.press('f');
  await page.waitForFunction(()=>window.blacklineQA.snapshot().flight.piloting&&window.blacklineQA.snapshot().campaign.onboarding.stage==='complete');
  assert.equal((await snap()).story.stage,'briefing');await page.keyboard.press('f');await page.waitForFunction(()=>!window.blacklineQA.snapshot().flight.piloting);
 });
 await check('First town has accessible Mara briefing and a resident-given optional quest',async()=>{
  await approach('mara');await page.screenshot({path:'qa/opening-first-town.png'});await talk('mara');await page.locator('[data-main-talk]').click();assert.equal((await snap()).story.stage,'coast');
  await talk('lia');assert.match(await page.locator('.resident-dialogue').innerText(),/fallen courier/);await page.locator('[data-person-quest="survey"]').click();
  assert.equal((await snap()).campaign.contracts.survey,'active');await talk('lia');assert.match(await page.locator('.resident-dialogue').innerText(),/journal can track/);await page.screenshot({path:'qa/opening-town-conversation.png'});await page.locator('[data-leave-conversation]').click();
 });
 await check('Continue preserves main story, accepted side quest and reward without replay',async()=>{
  await page.evaluate(()=>window.blacklineQA.save());const before=(await snap()).campaign.salvage;await page.reload();await ready();await page.locator('#deploy').click();await page.waitForFunction(()=>window.blacklineQA.snapshot().mode==='playing');
  const s=await snap();assert(!s.opening.active);assert(!s.crashfall);assert.equal(s.campaign.onboarding.stage,'complete');assert.equal(s.campaign.salvage,before);assert(s.campaign.story.briefed);assert.equal(s.campaign.contracts.survey,'active');
 });
 assert.deepEqual(errors,[]);
}catch(error){evidence.failure=error.stack;await page.screenshot({path:'qa/opening-rally-failure.png'}).catch(()=>{});throw error;}
finally{await writeFile('qa/opening-rally-results.json',JSON.stringify({checks,errors,evidence,snapshot:await snap().catch(()=>null)},null,2));await browser.close();}
