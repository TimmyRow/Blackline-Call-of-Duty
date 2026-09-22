import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
const snap=()=>page.evaluate(()=>window.blacklineQA.snapshot());
async function launch(){
 await page.evaluate(()=>{const q=window.blacklineQA,p=q.flight.position;q.teleport3(p.x,p.y+1,p.z);});await page.keyboard.press('f');
 assert((await snap()).flight.piloting);
 await page.evaluate(()=>{const q=window.blacklineQA,p=q.flight.position;q.flight.repair();if(!q.flight.transferTo({x:p.x,y:500,z:p.z}))throw Error('QA launch failed');q.setTime(1000);});await page.waitForTimeout(200);
}
try{
 await page.goto('http://localhost:5180');await page.waitForFunction(()=>window.blacklineQA,null,{timeout:90000});await page.selectOption('#quality','low',{force:true});
 await page.evaluate(()=>{const q=window.blacklineQA;q.start();q.save();const key='blackline.expedition.v1',s=JSON.parse(localStorage.getItem(key));s.campaign.clues=['clue:evacuation-stop'];localStorage.setItem(key,JSON.stringify(s));q.load();q.openJournal();});
 await page.locator('[data-lead="clue:basalt-gate"]').click();await launch();
 const before=(await snap()).campaign.trackedTarget;
 await page.evaluate(()=>window.blacklineQA.travel('vesper'));
 let c=(await snap()).campaign;console.log(JSON.stringify({afterJump:c.tracked,savedTarget:c.trackedTarget}));assert.equal(c.planet,'vesper');assert.equal(c.tracked,'clue:basalt-gate');assert.equal(c.activeMission,'free');assert.deepEqual(c.trackedTarget,before);
 await page.evaluate(()=>{window.blacklineQA.save();window.blacklineQA.load();});c=(await snap()).campaign;assert.equal(c.tracked,'clue:basalt-gate');assert.deepEqual(c.trackedTarget,before);
 checks.push('A tracked exploration clue survives an actual Orison-to-Vesper jump and validated save/load with identical coordinates');
 // Track the main quest from Vesper, jump home, and check identity/coordinates stay paired.
 await page.evaluate(()=>window.blacklineQA.openJournal());await page.locator('[data-main-quest]').click();await launch();await page.evaluate(()=>window.blacklineQA.travel('orison'));
 c=(await snap()).campaign;assert.equal(c.planet,'orison');assert.equal(c.activeMission,'main');assert.equal(c.tracked,'person:mara');assert.equal(c.trackedTarget.id,'person:mara');assert.equal(c.trackedTarget.x,10);assert.equal(c.trackedTarget.z,97);
 await page.evaluate(()=>{window.blacklineQA.save();window.blacklineQA.load();});assert.equal((await snap()).campaign.trackedTarget.id,'person:mara');
 checks.push('Main-quest tracking retains Mara’s canonical ID and coordinates across the return jump and save/load');
 assert.deepEqual(errors,[]);await writeFile('qa/jump-tracking-results.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
