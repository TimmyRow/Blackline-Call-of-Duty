import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-webgl','--ignore-gpu-blocklist']});
const p=await browser.newPage({viewport:{width:1440,height:900}}),checks=[],errors=[];
p.on('pageerror',e=>errors.push(e.message));
await p.addInitScript(()=>{window.uiPad={index:0,id:'Xbox One simulated UI QA',connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.uiPad]});});
const tap=async(i)=>{await p.evaluate(i=>window.uiPad.buttons[i]={pressed:true,value:1},i);await p.waitForTimeout(170);await p.evaluate(i=>window.uiPad.buttons[i]={pressed:false,value:0},i);await p.waitForTimeout(200);};
const active=()=>p.locator('[data-section][aria-pressed=true]').getAttribute('data-section');
try {
 await p.goto('http://localhost:5180');await p.waitForFunction(()=>window.blacklineQA,null,{timeout:90000});await p.selectOption('#quality','low',{force:true});await p.evaluate(()=>window.blacklineQA.start());await tap(8);
 assert.equal(await active(),'missions');await tap(5);assert.equal(await active(),'equipment');await tap(5);assert.equal(await active(),'squad');await tap(5);assert.equal(await active(),'missions');await tap(4);assert.equal(await active(),'squad');checks.push('RB cycles missions/equipment/squad and LB reverses');
 await tap(1);await p.evaluate(()=>window.blacklineQA.openJournal('people','kito'));await p.waitForTimeout(250);assert.equal(await active(),'people');await tap(5);assert.equal(await active(),'missions');await tap(4);assert.equal(await active(),'people');assert(await p.locator('[data-person-quest]').count()>0);checks.push('Conversation remains reachable in bumper cycle');
 await tap(5);await tap(5);assert.equal(await active(),'equipment');assert.equal(await p.locator('[data-scan]').innerText(),'A · SCAN SURROUNDINGS');await p.screenshot({path:'qa/controller-complete-journal.png'});await tap(1);
 await tap(13);assert(await p.locator('.field-map').isVisible());const before=await p.locator('.fm-chart canvas').evaluate(c=>c.toDataURL());
 await p.evaluate(()=>window.uiPad.axes=[0,0,.8,.4]);await p.waitForTimeout(900);await p.evaluate(()=>window.uiPad.axes=[0,0,0,0]);await p.waitForTimeout(250);
 const after=await p.locator('.fm-chart canvas').evaluate(c=>c.toDataURL());assert.notEqual(before,after);assert(await p.evaluate(()=>document.querySelector('.field-map').contains(document.activeElement)));checks.push('Right stick visibly changes map canvas; focus remains inside map');
 for(let i=0;i<5;i++)await tap(13);const focusBefore=await p.evaluate(()=>document.activeElement.dataset.site??null);assert(focusBefore);await p.evaluate(()=>window.uiPad.axes=[0,0,.3,0]);await p.waitForTimeout(350);await p.evaluate(()=>window.uiPad.axes=[0,0,0,0]);await p.waitForTimeout(220);assert.equal(await p.evaluate(()=>document.activeElement.dataset.site),focusBefore);checks.push('Focused destination remains selected after pan rebuild');
 const scale=await p.locator('.atlas-scale').innerText();await tap(5);assert.notEqual(await p.locator('.atlas-scale').innerText(),scale);checks.push('Map RB zoom changes map scale');await p.screenshot({path:'qa/controller-complete-map.png'});await tap(1);assert(await p.locator('.field-map').isHidden());assert.deepEqual(errors,[]);
} finally {await writeFile('qa/controller-ui-results.json',JSON.stringify({checks,errors},null,2));await browser.close();}
console.log(JSON.stringify({checks,errors}));
