import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Users/jcrow/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await mkdir('artifacts/world-destinations',{recursive:true});
 await page.goto('http://localhost:5180/');await page.waitForFunction(()=>window.blacklineQA,{timeout:120000});
 await page.evaluate(()=>{blacklineQA.start();blacklineQA.setClimate({hour:9.2,weather:'clear'});blacklineQA.teleport3(42000,279,35);blacklineQA.clear();blacklineQA.flight.board(blacklineQA.flight.position.clone());if(!blacklineQA.flight.transferTo({x:42000,y:278.35,z:35}))throw new Error('Flight transfer failed');blacklineQA.look(0,0);});
 await page.waitForTimeout(2000);await page.screenshot({path:'artifacts/world-destinations/vesper-flight-level.png'});
 await page.evaluate(()=>blacklineQA.look(0,-.35));await page.waitForTimeout(700);await page.screenshot({path:'artifacts/world-destinations/vesper-flight-down.png'});
 const s=await page.evaluate(()=>blacklineQA.snapshot());const report={position:s.position,planet:s.planet,flight:s.flight,graphics:s.graphics,drawCalls:s.drawCalls,errors};await writeFile('artifacts/world-destinations/horizon-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert(s.flight.piloting&&s.planet==='vesper');assert.deepEqual(errors,[]);
}finally{await browser.close();}
