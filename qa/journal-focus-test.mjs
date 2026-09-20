import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const results=[];
try{for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
 const page=await browser.newPage({viewport}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.pad={index:0,id:'Xbox simulated',connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.pad]});});
 const tap=async(i,duration=150)=>{await page.evaluate(i=>window.pad.buttons[i]={pressed:true,value:1},i);await page.waitForTimeout(duration);await page.evaluate(i=>window.pad.buttons[i]={pressed:false,value:0},i);await page.waitForTimeout(180);};
 const focused=()=>page.evaluate(()=>document.activeElement?.dataset.focus);
 await page.goto('http://localhost:5180');await page.waitForFunction(()=>window.blacklineQA,null,{timeout:90000});await page.selectOption('#quality','low',{force:true});
 // Completed rescue and defense fixture; interact with the actual resident using X.
 await page.evaluate(()=>{const q=window.blacklineQA;q.start();q.save();const key='blackline.expedition.v1',s=JSON.parse(localStorage.getItem(key));s.campaign.contracts['op-rescue']='complete';s.campaign.contracts['op-defense']='complete';s.campaign.operations={'op-rescue':{stage:3},'op-defense':{stage:4}};localStorage.setItem(key,JSON.stringify(s));q.load();q.teleport(17,78);});
 await tap(2);await tap(2,1700);await page.locator('[data-debrief="op-rescue"]').waitFor();
 assert.equal(await focused(),'debrief:op-rescue');await tap(0);
 console.log(JSON.stringify({viewport:viewport.width,afterClaim:await focused()}));
 assert.equal(await focused(),'debrief:op-defense','claiming the first cache should focus the next available action, not a journal tab');
 assert(await page.locator('[data-debrief="op-rescue"]').isDisabled());
 const box=await page.locator('[data-debrief="op-defense"]').boundingBox();assert(box.y>=-1&&box.y+box.height<=viewport.height+1);
 await page.screenshot({path:`qa/journal-focus-${viewport.width}.png`});
 await tap(0);assert.equal(await focused(),'personQuest:signals');
 const c=await page.evaluate(()=>window.blacklineQA.snapshot().campaign);assert.deepEqual(c.baseLocker,{reserve:120,grenades:2});assert.equal(c.contracts.signals,undefined);
 // Releasing A between presses and navigating backwards skips both disabled claims.
 await tap(12);assert.equal(await focused(),'section:people');await tap(13);assert.equal(await focused(),'personQuest:signals');
 // B still closes the journal; Menu opens the map and View pauses.
 await tap(1);assert(await page.locator('#expedition-panel').isHidden());await tap(9);assert(await page.locator('.field-map').isVisible());await tap(1);await tap(8);assert.equal(await page.evaluate(()=>window.blacklineQA.snapshot().mode),'paused');
 assert.deepEqual(errors,[]);results.push({viewport:viewport.width,nextActions:['debrief:op-defense','personQuest:signals'],errors});await page.close();
 }await writeFile('qa/journal-focus-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
