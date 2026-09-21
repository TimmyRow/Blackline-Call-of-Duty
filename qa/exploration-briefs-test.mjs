import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {explorationBriefs} from '../src/frontier-discoveries.mjs';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://localhost:5180');await page.waitForFunction(()=>window.blacklineQA,null,{timeout:90000});await page.selectOption('#quality','low',{force:true});
 // Existing-save fixture containing three recovered records.
 await page.evaluate(()=>{const q=window.blacklineQA;q.start();q.save();const key='blackline.expedition.v1',s=JSON.parse(localStorage.getItem(key));s.campaign.clues=['clue:evacuation-stop','clue:coast-lookout','clue:relay-feed'];localStorage.setItem(key,JSON.stringify(s));q.load();q.teleport(105,340);q.openJournal();});
 const snap=await page.evaluate(()=>window.blacklineQA.snapshot()),[x,y,z]=snap.position,expected=explorationBriefs(snap.campaign,{x,y,z});
 assert.equal(expected[0].target.id,'clue:wayfarer-buoy');
 assert.deepEqual(await page.locator('[data-lead]').evaluateAll(items=>items.map(e=>e.dataset.lead)),expected.map(l=>l.target.id));
 assert.deepEqual(await page.locator('[data-lead-brief]').allTextContents(),expected.map(l=>l.travelLabel));
 const list=page.locator('#exploration-leads');assert.match(await list.textContent(),/Bring a launch/);assert.match(await list.textContent(),/Cave archive/);assert.match(await list.textContent(),/Wreck interior/);
 await page.locator('[data-lead]').first().scrollIntoViewIfNeeded();await page.screenshot({path:'qa/exploration-briefs-desktop.png'});
 await page.locator('[data-lead]').first().click();await page.waitForTimeout(150);assert.equal(await page.locator('.nav-compass-marker').getAttribute('data-target'),'clue:wayfarer-buoy');
 checks.push('Journal sorts nearby leads, presents distance/bearing/elevation and cave/wreck/ocean approach hints, and tracks the selected destination on the compass');
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.blacklineQA.openJournal());await page.locator('[data-lead]').first().scrollIntoViewIfNeeded();await page.screenshot({path:'qa/exploration-briefs-phone.png'});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 checks.push('Distance and approach information fit the 390px phone layout without horizontal overflow');
 await page.locator('[data-close]').click();await page.evaluate(()=>{const q=window.blacklineQA;q.teleport(42000,35);q.openJournal();});
 const remote=await page.locator('[data-lead-brief]').allTextContents();assert.equal(remote.length,3);assert(remote.every(text=>text==='Return to Orison · Planet jump required'));
 checks.push('Viewing Orison leads from Vesper shows planet-jump guidance instead of a false walkable distance');
 assert.deepEqual(errors,[]);await writeFile('qa/exploration-briefs-results.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
