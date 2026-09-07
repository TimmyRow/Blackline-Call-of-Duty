import {chromium,devices} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Users/jcrow/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const results=[],errors=[];
async function setup(options){const page=await browser.newPage(options);page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:5180');await page.waitForFunction(()=>window.blacklineQA,null,{timeout:90000});await page.locator('#quality').selectOption('low',{force:true});await page.evaluate(()=>{const q=window.blacklineQA;q.start();const p=q.flight.position;q.teleport3(p.x+6,p.y-.45,p.z);});await page.waitForTimeout(200);await page.keyboard.press('f');await page.waitForFunction(()=>window.blacklineQA.snapshot().flight.piloting);return page;}
const snap=p=>p.evaluate(()=>window.blacklineQA.snapshot());
async function orientation(page,label){await page.mouse.move(650,300);await page.waitForTimeout(100);const a=await snap(page);await page.mouse.move(750,400,{steps:6});await page.waitForTimeout(150);const b=await snap(page);assert(b.flight.yaw<a.flight.yaw,'right turns right');assert(b.flight.pitch<a.flight.pitch,'down looks down');assert(!b.input.firing);assert.equal(b.flight.energy,100);await page.mouse.move(650,300,{steps:6});await page.waitForTimeout(150);const c=await snap(page);assert(c.flight.yaw>b.flight.yaw,'left turns left');assert(c.flight.pitch>b.flight.pitch,'up looks up');results.push({name:label,pass:true});}
try{
 const desktop=await setup({viewport:{width:1440,height:900}});
 assert.equal(await desktop.evaluate(()=>!!document.pointerLockElement),false);
 await orientation(desktop,'Mouse look in all four directions without holding fire, including pointer-lock fallback');
 await desktop.keyboard.down('Space');await desktop.waitForTimeout(2200);await desktop.keyboard.up('Space');await desktop.waitForTimeout(900);assert((await snap(desktop)).flight.altitude>30);
 await desktop.evaluate(()=>window.blacklineQA.look(0,-.65));await desktop.waitForTimeout(300);await desktop.screenshot({path:'qa/flight-clear-down.png'});
 await desktop.evaluate(()=>window.blacklineQA.look(0,0));await desktop.waitForTimeout(300);await desktop.screenshot({path:'qa/flight-clear-forward.png'});
 await desktop.evaluate(()=>document.querySelector('#viewport canvas').requestPointerLock());
 await desktop.waitForFunction(()=>!!document.pointerLockElement);await orientation(desktop,'Captured mouse look in all four directions');
 await desktop.mouse.down();await desktop.waitForTimeout(250);await desktop.mouse.up();assert((await snap(desktop)).flight.energy<100);results.push({name:'Cannons still fire on left click',pass:true});await desktop.close();
 for(const [name,options] of [['iPhone landscape',{...devices['iPhone 13'],viewport:{width:844,height:390}}],['iPad landscape',{...devices['iPad (gen 7) landscape']} ]]){
  const p=await setup(options),cdp=await p.context().newCDPSession(p);
  for(const id of ['touch-aim','touch-reload','touch-use'])assert.equal(await p.locator('#'+id).isVisible(),false);
  for(const id of ['touch-fire','touch-up','touch-down','touch-run','touch-vehicle']){const r=await p.locator('#'+id).boundingBox();assert(r&&r.width>=44&&r.height>=44);}
  const r=await p.locator('.touch-actions').boundingBox();assert(r.height<=48);
  const a=await snap(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:460,y:210}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:505,y:240}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(200);const b=await snap(p);assert(b.flight.yaw<a.flight.yaw&&b.flight.pitch<a.flight.pitch);assert(!b.input.firing);
  await p.screenshot({path:`qa/flight-clear-${name.split(' ')[0].toLowerCase()}.png`});
  await p.locator('#touch-vehicle').tap();await p.waitForTimeout(200);assert(!(await snap(p)).flight.piloting);assert(await p.locator('#touch-use').isVisible());assert(await p.locator('#touch-reload').isVisible());
  results.push({name:name+' compact controls, swipe look and infantry controls restored after exit',pass:true});await p.close();
 }
 assert.deepEqual(errors,[]);
}finally{await writeFile('qa/flight-view-results.json',JSON.stringify({results,errors},null,2));await browser.close();}
console.log(JSON.stringify({results,errors},null,2));
