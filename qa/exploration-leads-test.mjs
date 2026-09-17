import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
const snap=()=>page.evaluate(()=>window.blacklineQA.snapshot());
async function hold(){await page.keyboard.down('e');await page.waitForTimeout(1800);await page.keyboard.up('e');}
try{
 await page.goto('http://localhost:5180');await page.waitForFunction(()=>window.blacklineQA,null,{timeout:90000});
 await page.selectOption('#quality','low',{force:true});
 await page.evaluate(()=>{const q=window.blacklineQA;q.start();q.setClimate({hour:11,weather:'clear'});q.teleport(-147,58);});
 const before=(await snap()).campaign;await hold();
 let c=(await snap()).campaign;assert(c.clues.includes('clue:evacuation-stop'));assert.equal(c.activeMission,before.activeMission);
 await page.evaluate(()=>window.blacklineQA.openJournal());
 const lead=page.locator('[data-lead="clue:basalt-gate"]');await lead.waitFor();
 await page.screenshot({path:'qa/exploration-leads-desktop.png'});
 await lead.click();c=(await snap()).campaign;assert.equal(c.activeMission,'free');assert.equal(c.tracked,'clue:basalt-gate');assert(c.discovered.includes(c.tracked));
 await page.evaluate(()=>{window.blacklineQA.save();window.blacklineQA.load();});
 c=(await snap()).campaign;assert.equal(c.tracked,'clue:basalt-gate');assert.equal(c.trackedTarget.id,c.tracked);assert(Number.isFinite(c.trackedTarget.elevation));
 assert.equal(await page.locator('.nav-compass-marker').getAttribute('data-target'),'clue:basalt-gate');
 checks.push('A real recovered roadside record unlocks a journal lead; choosing it saves the marked destination without accepting a side quest');
 await page.keyboard.press('Tab');await page.waitForTimeout(300);await page.screenshot({path:'qa/exploration-leads-map.png'});await page.keyboard.press('Escape');
 await page.evaluate(()=>window.blacklineQA.teleport(-286.6,-216));await hold();
 c=(await snap()).campaign;assert(c.clues.includes('clue:basalt-gate'));assert(c.blueprints.includes('scanner'));assert.equal(c.tracked,null);
 await page.evaluate(()=>window.blacklineQA.openJournal());assert.equal(await page.locator('[data-lead="clue:basalt-gate"]').count(),0);
 checks.push('Following the destination awards its existing schematic once, clears its pin and closes the resolved lead');
 // Fixture represents an existing save with two earlier recovered records.
 await page.evaluate(()=>{const q=window.blacklineQA;q.save();const key='blackline.expedition.v1',s=JSON.parse(localStorage.getItem(key));s.campaign.clues.push('clue:roadside-repair','clue:coast-lookout');localStorage.setItem(key,JSON.stringify(s));q.load();q.openJournal();});
 await page.setViewportSize({width:390,height:844});await page.locator('[data-lead="clue:wayfarer-buoy"]').scrollIntoViewIfNeeded();await page.screenshot({path:'qa/exploration-leads-phone.png'});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.locator('[data-lead="clue:wayfarer-buoy"]').click();assert.equal((await snap()).campaign.tracked,'clue:wayfarer-buoy');
 checks.push('Older saves expose recovered-record leads immediately; the phone journal has no horizontal overflow and can track the ocean buoy');
 assert.deepEqual(errors,[]);await writeFile('qa/exploration-leads-results.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
