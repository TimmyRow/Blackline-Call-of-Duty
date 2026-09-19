import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
const snap=()=>page.evaluate(()=>window.blacklineQA.snapshot());
async function talk(){await page.keyboard.down('e');await page.waitForTimeout(1700);await page.keyboard.up('e');await page.locator('[data-debrief="op-rescue"]').waitFor();}
try{
 await page.goto('http://localhost:5180');await page.waitForFunction(()=>window.blacklineQA,null,{timeout:90000});await page.selectOption('#quality','low',{force:true});
 // Existing-save fixture: two completed operations, no prior debrief field.
 await page.evaluate(()=>{const q=window.blacklineQA;q.start();q.save();const key='blackline.expedition.v1',s=JSON.parse(localStorage.getItem(key));s.campaign.contracts['op-rescue']='complete';s.campaign.contracts['op-defense']='complete';s.campaign.operations={'op-rescue':{stage:3},'op-defense':{stage:4}};delete s.campaign.debriefedOperations;localStorage.setItem(key,JSON.stringify(s));q.load();q.teleport(17,78);});
 await talk();assert.equal(await page.locator('[data-debrief]').count(),2);
 await page.screenshot({path:'qa/operation-debriefs-desktop.png'});
 const before=(await snap()).campaign;
 await page.locator('[data-debrief="op-rescue"]').click();
 let c=(await snap()).campaign;assert.deepEqual(c.baseLocker,{reserve:60,grenades:1});assert.equal(c.salvage,before.salvage);assert.equal(c.activeMission,before.activeMission);assert.equal(c.tracked,before.tracked);assert(await page.locator('[data-debrief="op-rescue"]').isDisabled());
 checks.push('A real conversation with Tomas offers completed-operation debriefs; accepting a cache preserves salvage and mission tracking');
 await page.locator('[data-section="equipment"]').click();await page.locator('[data-service="withdraw"]').click();assert.deepEqual((await snap()).campaign.baseLocker,{reserve:0,grenades:0});assert.equal((await snap()).reserve,240);assert.equal((await snap()).grenades,4);
 checks.push('The awarded cache can be withdrawn into usable ammunition and grenades at Pathfinder');
 await page.locator('[data-close]').click();await page.evaluate(()=>{window.blacklineQA.save();window.blacklineQA.load();});await talk();
 assert(await page.locator('[data-debrief="op-rescue"]').isDisabled());assert.equal((await snap()).campaign.baseLocker.reserve,0);
 await page.setViewportSize({width:390,height:844});await page.locator('[data-debrief="op-defense"]').scrollIntoViewIfNeeded();await page.screenshot({path:'qa/operation-debriefs-phone.png'});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.locator('[data-debrief="op-defense"]').click();assert.deepEqual((await snap()).campaign.baseLocker,{reserve:60,grenades:1});
 checks.push('Claimed caches remain claimed after reload; a second operation can be debriefed in the phone layout without horizontal overflow');
 assert.deepEqual(errors,[]);await writeFile('qa/operation-debriefs-results.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
