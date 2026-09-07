import {chromium,devices} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}),checks=[],errors=[];
async function start(page){page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:5180');await page.waitForFunction(()=>window.blacklineQA,null,{timeout:90000});await page.evaluate(()=>{const q=window.blacklineQA;q.start();const s=q.flight.position;q.teleport3(s.x+6,s.y-.45,s.z);});}
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 await page.addInitScript(()=>{window.pad={index:0,id:'Xbox simulated',connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.pad]});});
 await start(page);await page.keyboard.press('f');await page.keyboard.down('Shift');await page.keyboard.down('Space');await page.waitForFunction(()=>window.blacklineQA.snapshot().flight.altitude>400);await page.keyboard.up('Space');await page.keyboard.up('Shift');await page.waitForTimeout(700);
 await page.keyboard.down('w');await page.keyboard.down('Shift');await page.keyboard.down('c');await page.waitForFunction(()=>{const v=window.blacklineQA.snapshot().flight.velocity;return v[1]<-80&&v[2]<-100;});await page.keyboard.up('c');await page.keyboard.up('Shift');await page.keyboard.up('w');
 checks.push('W + Shift + C boosts forward and descends without browser modifiers');
 await page.waitForTimeout(800);await page.evaluate(()=>window.pad.buttons[1]={pressed:true,value:1});await page.waitForFunction(()=>window.blacklineQA.snapshot().flight.velocity[1]<-20);await page.evaluate(()=>window.pad.buttons[1]={pressed:false,value:0});
 checks.push('Xbox B still descends after the input remap');
 await page.keyboard.down('Control');assert(!(await page.evaluate(()=>window.blacklineQA.snapshot().input.held)).includes('ControlLeft'));await page.keyboard.up('Control');
 await page.waitForTimeout(5300);assert(await page.evaluate(()=>{const s=window.blacklineQA.snapshot(),saved=JSON.parse(localStorage.getItem('blackline.expedition.v1'));return s.time-saved.state.time<=5.2;}));
 checks.push('Ctrl is excluded from gameplay and flight progress saves every five seconds');await page.close();
 const mobile=await browser.newPage({...devices['iPhone 13'],viewport:{width:844,height:390}});await start(mobile);await mobile.locator('#touch-vehicle').tap();const cdp=await mobile.context().newCDPSession(mobile);
 async function hold(id,predicate){const r=await mobile.locator(id).boundingBox();assert(r);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:r.x+r.width/2,y:r.y+r.height/2}]});try{await mobile.waitForFunction(predicate,null,{timeout:15000});}finally{await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}}
 await hold('#touch-up',()=>window.blacklineQA.snapshot().flight.altitude>100);await mobile.waitForTimeout(500);await hold('#touch-down',()=>window.blacklineQA.snapshot().flight.velocity[1]<-20);assert.equal(await mobile.locator('#touch-down').getAttribute('data-hold'),'KeyC');
 checks.push('Touch Rise and Descend retain their behavior');await mobile.screenshot({path:'qa/flight-touch-controls.png'});await mobile.close();assert.deepEqual(errors,[]);
}finally{await writeFile('qa/flight-inputs-results.json',JSON.stringify({checks,errors},null,2));await browser.close();}
console.log(JSON.stringify({checks,errors}));
