import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Users/jcrow/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',headless:true});
await mkdir('artifacts/navigation-qa',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.route('**/navigation-harness',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/style.css"><link rel="stylesheet" href="/src/discovery.css"><link rel="stylesheet" href="/src/mobile.css"></head><body><div id="hud"><div id="objective"><small>ORISON / EXPEDITION</small><div id="objective-name">Find the missing expedition</div><div id="objective-detail">Track signals across the frontier</div></div><div id="compass"><div id="compass-tape">W · · N · · E</div><strong>N · 000°</strong></div></div><div id="app"></div></body></html>'}));
 await page.goto('http://localhost:5180/navigation-harness');
 await page.evaluate(async()=>{
  const {createNavigationUI}=await import('/src/navigation-ui.ts'),{createFieldMap}=await import('/src/field-map.ts'),{createExpeditionUI}=await import('/src/expedition-ui.ts');
  window.nav=createNavigationUI(document.querySelector('#hud'));window.navData={position:{x:0,y:30,z:0},yaw:0,tracked:{id:'test',name:'Missing expedition',x:-700,z:400,elevation:110},ship:{id:'kestrel',name:'Kestrel',x:50,y:20,z:90},aboard:false};nav.update(navData);
  window.map=createFieldMap(document.querySelector('#app'),{onTrack(){},onClose(){map.close();}});
  window.journal=createExpeditionUI(document.querySelector('#app'),{close(){journal.close();},accept(){},buy(){},track(){},save(){},scan(){window.scans=(window.scans??0)+1;},travel(id){window.travelled=id;}});
  window.journalData={campaign:{salvage:200,discovered:[],raids:0,completed:[],encountersCompleted:[],airKills:0},atBase:true,saveMessage:'Expedition saved',planetName:'Orison',scanner:{cooldown:0,range:500},destinations:[{id:'vesper',name:'Vesper',description:'Explore the frozen frontier.',available:true},{id:'orison',name:'Orison',description:'Home to the Ash Coast.',available:false,reason:'Already on this world.'}],war:{label:'Ash Coast resistance',description:'Pirate supply disrupted · Friendly patrols reinforcing.'},boarding:{label:'Boarding operation',description:'Disable the carrier shield, land on the deck, then breach the command core.'}};
 });
 await page.screenshot({path:'artifacts/navigation-qa/desktop-hud.png'});
 assert.match(await page.locator('.nav-target').innerText(),/Missing expedition.*\n.*↑ 80 m/s);
 await page.evaluate(()=>nav.update({...navData,aboard:true,flying:true,speed:29,altitude:25,tracked:{...navData.tracked,kind:'carrier',faction:'pirate'}}));
 assert.equal(await page.locator('.nav-ship').isVisible(),false);
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.body.classList.add('touch-device'));await page.screenshot({path:'artifacts/navigation-qa/mobile-hud.png'});
 const overlap=await page.evaluate(()=>{const a=document.querySelector('#objective').getBoundingClientRect(),b=document.querySelector('.nav-target').getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;});assert.equal(overlap,false);
 await page.evaluate(()=>journal.open(journalData,'equipment'));await page.locator('[data-scan]').click();await page.locator('[data-travel="vesper"]').click();assert.equal(await page.evaluate(()=>window.scans),1);assert.equal(await page.evaluate(()=>window.travelled),'vesper');assert.equal(await page.locator('[data-travel="orison"]').isDisabled(),true);await page.locator('#expedition-systems').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/navigation-qa/mobile-journal.png'});
 await page.evaluate(()=>{journal.close();map.open({position:navData.position,yaw:0,completed:[],discovered:[],tracked:'test',target:navData.tracked,signals:[navData.tracked],patrols:[],intel:true});});assert.match(await page.locator('.fm-tracked-summary').innerText(),/Missing expedition/);await page.screenshot({path:'artifacts/navigation-qa/mobile-map.png'});
 console.log('Navigation HUD, aboard visibility, mobile overlap, scanner/travel callbacks and atlas tracking passed.');
}finally{await browser.close();}
