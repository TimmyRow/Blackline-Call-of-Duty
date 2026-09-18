import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
const snap=()=>page.evaluate(()=>window.blacklineQA.snapshot());
try{
 await page.goto('http://localhost:5180');await page.waitForFunction(()=>window.blacklineQA,null,{timeout:90000});await page.selectOption('#quality','low',{force:true});
 // Existing expedition fixture: survivors just freed, mission accepted from its resident.
 await page.evaluate(()=>{const q=window.blacklineQA;q.start();q.save();const key='blackline.expedition.v1',s=JSON.parse(localStorage.getItem(key));s.campaign.operations={'op-rescue':{stage:2}};s.campaign.contracts['op-rescue']='active';s.campaign.activeMission='op-rescue';s.campaign.onboarding.stage='complete';localStorage.setItem(key,JSON.stringify(s));q.load();q.teleport(-158,158);q.setClimate({hour:11,weather:'clear'});q.clear();});
 await page.waitForTimeout(4500);
 const before=await page.evaluate(()=>{const q=window.blacklineQA,before=q.snapshot().survivors;q.save();q.load();return before;});assert(before.every(s=>s.visible));await page.waitForTimeout(100);
 const after=(await snap()).survivors,displacements=after.map((s,i)=>Math.hypot(...s.position.map((n,k)=>n-before[i].position[k])));
 console.log(JSON.stringify({reloadDisplacements:displacements}));
 assert(displacements.every(d=>d<1),'reloading an escort must not send survivors back to their capture point');
 await page.evaluate(()=>window.blacklineQA.look(2.2,-.15));await page.waitForTimeout(100);await page.screenshot({path:'qa/rescue-save-restored.png'});
 checks.push('Both freed survivors resume within 1m of their saved escort positions');
 // Loading again before the next actor update must preserve the saved positions too.
 await page.evaluate(()=>{const q=window.blacklineQA;q.load();q.save();q.load();});await page.waitForTimeout(100);
 assert((await snap()).survivors.every((s,i)=>Math.hypot(s.position[0]-after[i].position[0],s.position[2]-after[i].position[2])<1));
 checks.push('Immediate load/save/load preserves pending survivor state');
 await page.evaluate(()=>{window.blacklineQA.teleport(-140,168);window.blacklineQA.clear();});await page.waitForTimeout(6000);
 await page.keyboard.down('e');await page.waitForTimeout(1700);await page.keyboard.up('e');
 assert.equal((await snap()).campaign.contracts['op-rescue'],'complete');
 const salvage=(await snap()).campaign.salvage;
 await page.evaluate(()=>{window.blacklineQA.save();window.blacklineQA.load();});await page.waitForTimeout(200);
 assert.equal((await snap()).campaign.salvage,salvage);assert((await snap()).survivors.every(s=>!s.visible));
 checks.push('Resumed survivors reach extraction; completed mission and reward remain stable on reload');
 assert.deepEqual(errors,[]);await writeFile('qa/rescue-save-results.json',JSON.stringify({checks,reloadDisplacements:displacements,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();}
