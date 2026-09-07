import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}),p=await b.newPage({viewport:{width:1280,height:850}}),checks=[],errors=[];
p.on('pageerror',e=>errors.push(e.message));
await p.addInitScript(()=>{window.pad={id:'Xbox Wireless Controller (test)',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>window.pad.connected?[window.pad]:[]});});
const snap=()=>p.evaluate(()=>window.blacklineQA.snapshot()),wait=ms=>p.waitForTimeout(ms);
const button=async(i,v)=>{await p.evaluate(({i,v})=>window.pad.buttons[i]={pressed:v,value:+v},{i,v});await wait(160);};
const tap=async i=>{await button(i,true);await button(i,false);};
try{
 await p.goto('http://localhost:5180');await p.waitForFunction(()=>window.blacklineQA,null,{timeout:90000});await p.selectOption('#quality','low',{force:true});await tap(0);await tap(0);
 await p.evaluate(()=>{window.blacklineQA.teleport(0,130);window.blacklineQA.look(0,0);});await wait(600);
 const ammo=(await snap()).ammo,y=(await snap()).position[1];
 await button(0,true);assert((await snap()).position[1]>y+.1);await p.mouse.move(640,420);await p.mouse.down();await wait(200);await p.mouse.up();await button(0,false);
 assert.equal((await snap()).ammo,ammo);assert((await snap()).input.controller);assert.equal((await snap()).input.inputMode,'controller');checks.push('A plus an emulated left mouse click jumps without firing or switching input mode');
 await wait(650);const start=await snap();await p.evaluate(()=>window.pad.axes=[1,0,0,0]);await p.mouse.down();await p.mouse.move(980,540,{steps:12});await wait(550);await p.mouse.up();await p.evaluate(()=>window.pad.axes=[0,0,0,0]);await wait(180);
 const moved=await snap();assert(moved.position[0]>start.position[0]+.5);assert.equal(moved.input.yaw,start.input.yaw);assert.equal(moved.ammo,ammo);checks.push('Left stick plus emulated mouse movement walks without turning the camera');
 await p.evaluate(()=>window.pad.axes=[0,0,.8,0]);await wait(300);await p.evaluate(()=>window.pad.axes=[0,0,0,0]);assert((await snap()).input.yaw<moved.input.yaw);await button(7,true);await button(7,false);assert((await snap()).ammo<ammo);checks.push('Right stick still turns camera and RT still fires');
 await p.keyboard.press('Space');assert.equal((await snap()).input.inputMode,'controller');await tap(8);await wait(350);await p.locator('#controls-button').click();await p.locator('#pad-test-toggle').click();
 await button(0,true);await button(0,false);assert.match(await p.locator('#pad-input-test').innerText(),/Last button: A/);assert.equal((await snap()).mode,'paused');assert((await snap()).input.testing);
 await p.evaluate(()=>window.pad.axes=[.7,-.4,0,0]);await wait(200);assert.match(await p.locator('#pad-input-test').innerText(),/LEFT STICK 0.70, -0.40/);await p.evaluate(()=>window.pad.axes=[0,0,0,0]);await wait(150);await p.screenshot({path:'qa/controller-real-input-display.png'});checks.push('Live diagnostic displays actual button and stick channels without menu actions');
 await p.evaluate(()=>window.pad.connected=false);await wait(200);assert.match(await p.locator('#pad-device-status').innerText(),/No controller input received/);await p.evaluate(()=>window.pad.connected=true);await wait(150);
 await button(1,true);await wait(1200);await button(1,false);assert(!(await snap()).input.testing);checks.push('Hold B exits the diagnostic using only the controller');await wait(350);if(await p.locator('#settings').isHidden())await p.locator('#controls-button').click();await p.selectOption('#input-mode','keyboard');await p.locator('#settings-close').click();await p.locator('#deploy').click();await p.mouse.move(600,400);await p.mouse.down();await wait(150);await p.mouse.up();assert(!(await snap()).input.controller);assert.equal((await snap()).input.inputMode,'keyboard');checks.push('Explicit keyboard/mouse selection restores normal mouse input');
 assert.deepEqual(errors,[]);
}finally{await writeFile('qa/controller-desktop-overlap-results.json',JSON.stringify({checks,errors},null,2));await b.close();}
console.log(JSON.stringify({checks,errors}));
