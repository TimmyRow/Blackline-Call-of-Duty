import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {HANGAR,SHIP_BERTH} from '../src/ship-purchase.mjs';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.pad={index:0,id:'Xbox simulated',connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.pad]});});
const snap=()=>page.evaluate(()=>window.blacklineQA.snapshot());
const ready=()=>page.waitForFunction(()=>window.blacklineQA,null,{timeout:90000});
try{
 await page.goto('http://localhost:5180');await ready();await page.selectOption('#quality','low',{force:true});
 await page.evaluate(()=>{const q=window.blacklineQA;q.newStory();q.skipArrival();});
 assert(!(await snap()).shipPurchase.owned);assert.equal((await snap()).flight.position[0],SHIP_BERTH.x);
 await page.evaluate(p=>{window.blacklineQA.teleport3(p.x+6,p.y-.45,p.z);},SHIP_BERTH);await page.keyboard.press('f');assert(!(await snap()).flight.piloting);
 checks.push('Fresh arrival has no ship at Pathfinder; hangar ship cannot be boarded early');
 // A saved fixture isolates the completed ground chapters; the opening has a separate real-input test.
 await page.evaluate(h=>{const q=window.blacklineQA;q.save();const key='blackline.expedition.v1',v=JSON.parse(localStorage.getItem(key));v.campaign.onboarding.stage='complete';v.campaign.story.briefed=true;v.campaign.completed.push('harbour','relay');v.campaign.contracts.coast='complete';v.campaign.contracts.array='complete';v.campaign.salvage=299;v.position=[h.x,h.elevation+1.7,h.z+2.5];localStorage.setItem(key,JSON.stringify(v));q.load();q.look(0,0);},HANGAR);
 await page.waitForFunction(()=>window.blacklineQA.snapshot().story.stage==='ship-purchase');
 await page.keyboard.down('e');await page.waitForTimeout(2100);await page.keyboard.up('e');assert(!(await snap()).shipPurchase.owned);assert.equal((await snap()).campaign.salvage,299);
 checks.push('City quest and terminal reject insufficient funds without charging');
 await page.evaluate(()=>window.blacklineQA.grantSalvage(300));await page.waitForTimeout(200);
 await page.screenshot({path:'qa/ship-hangar-sale.png'});
 await page.evaluate(()=>window.pad.buttons[2]={pressed:true,value:1});
 await page.waitForFunction(()=>window.blacklineQA.snapshot().shipPurchase.owned,null,{timeout:15000});await page.evaluate(()=>window.pad.buttons[2]={pressed:false,value:0});
 assert.equal((await snap()).campaign.salvage,0);assert.equal((await snap()).story.stage,'raider');
 checks.push('Xbox X purchases at the physical terminal and unlocks the next main chapter');
 await page.evaluate(()=>window.blacklineQA.save());await page.reload();await ready();await page.locator('#deploy').click();await page.waitForFunction(()=>window.blacklineQA.snapshot().mode==='playing');
 assert((await snap()).shipPurchase.owned);assert.equal((await snap()).campaign.salvage,0);
 await page.evaluate(p=>{window.blacklineQA.teleport3(p.x+6,p.y-.45,p.z);},SHIP_BERTH);await page.keyboard.press('f');
 await page.waitForFunction(()=>window.blacklineQA.snapshot().flight.piloting);await page.keyboard.down('Space');await page.waitForFunction(()=>window.blacklineQA.snapshot().flight.altitude>25,null,{timeout:15000});await page.keyboard.up('Space');
 assert((await snap()).flight.health>95);checks.push('Purchased ownership survives reload and the hangar permits collision-free takeoff');
 await page.evaluate(()=>window.blacklineQA.look(.45,-.42));await page.screenshot({path:'qa/port-astra-first-flight.png'});
 assert.deepEqual(errors,[]);
}catch(e){await page.screenshot({path:'qa/ship-purchase-failure.png'});throw e;}
finally{await writeFile('qa/ship-purchase-results.json',JSON.stringify({checks,errors},null,2));await browser.close();}
console.log(JSON.stringify({checks,errors}));
