import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {getWorldSites} from '../src/region-layout.mjs';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:2}),cdp=await page.context().newCDPSession(page),errors=[],samples=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('crash',()=>errors.push('Edge tab crashed'));
const snap=()=>page.evaluate(()=>window.blacklineQA.snapshot());
try{
 await page.goto('http://localhost:5180');await page.waitForFunction(()=>window.blacklineQA,null,{timeout:90000});
 await page.evaluate(()=>{window.stabilitySession='same-page';const q=window.blacklineQA;q.start();const p=q.flight.position;q.teleport3(p.x+6,p.y-.45,p.z);});await page.waitForTimeout(150);await page.keyboard.press('f');assert((await snap()).flight.piloting);
 await page.keyboard.down('Space');await page.keyboard.down('Shift');await page.waitForTimeout(1800);await page.keyboard.up('Space');await page.keyboard.down('w');await page.waitForTimeout(8000);await page.keyboard.up('w');await page.keyboard.up('Shift');assert((await snap()).flight.altitude>100);checks.push('Real Edge takeoff and boost flight');
 const sites=getWorldSites(6000,6000,3500).filter(s=>s.kind==='outpost'||s.kind==='camp').slice(0,6);assert(sites.length===6);
 for(let lap=0;lap<3;lap++){
  for(const site of sites){await page.evaluate(s=>{const q=window.blacklineQA;q.flight.position.set(s.x,s.elevation+180,s.z);q.flight.velocity.set(0,0,0);q.teleport3(s.x,s.elevation+180,s.z);q.flight.repair();},site);await page.waitForTimeout(250);const s=await snap();assert(s.graphics.enemyPool<=48);assert(s.world.terrainChunks<=49);assert(s.encounters.loaded<=6);}
  await cdp.send('HeapProfiler.collectGarbage');await page.waitForTimeout(200);const s=await snap(),heap=await cdp.send('Runtime.getHeapUsage');samples.push({lap,graphics:s.graphics,world:s.world,heap:heap.usedSize});console.log('streaming lap '+lap+': '+JSON.stringify(samples.at(-1)));
 }
 assert(samples[2].graphics.geometries<=samples[1].graphics.geometries+20);assert(samples[2].graphics.textures<=samples[1].graphics.textures+2);assert(samples[2].heap<samples[1].heap+25_000_000);checks.push('18 settlement transitions: bounded scene resources and enemy pool');
 await page.setViewportSize({width:3840,height:2160});await page.waitForTimeout(200);const pixels=await page.evaluate(()=>{const c=document.querySelector('#viewport canvas');return c.width*c.height;});assert(pixels<=3686400);checks.push('4K resize keeps framebuffer allocation within 3.69 megapixels');await page.setViewportSize({width:1440,height:900});
 await page.evaluate(()=>window.blacklineQA.pause());const baselineTextures=(await snap()).graphics.textures;
 for(const quality of ['low','high','low','high','low']){await page.selectOption('#quality',quality,{force:true});await page.waitForTimeout(150);}
 assert((await snap()).graphics.textures<baselineTextures);checks.push('Performance mode releases unused bloom buffers across repeated quality changes');
 for(let attempt=0;attempt<2;attempt++){
  const before=await snap();await page.evaluate(()=>{window.lossExtension=document.querySelector('#viewport canvas').getContext('webgl2').getExtension('WEBGL_lose_context');if(!window.lossExtension)throw Error('Context loss extension missing');window.lossExtension.loseContext();});
  await page.waitForFunction(()=>window.blackline.snapshot().graphics.lost);assert(await page.locator('#deploy').isDisabled());await page.keyboard.press('Escape');assert.notEqual((await snap()).mode,'playing');
  await page.evaluate(()=>window.lossExtension.restoreContext());await page.waitForFunction(()=>!window.blackline.snapshot().graphics.lost);await page.waitForTimeout(300);const after=await snap();assert.equal(await page.evaluate(()=>window.stabilitySession),'same-page');assert.equal(after.graphics.recoveries,attempt+1);assert.deepEqual(after.flight.position,before.flight.position);assert.equal(after.campaign.salvage,before.campaign.salvage);assert.equal(after.flight.piloting,true);assert.equal(await page.locator('#quality').inputValue(),'low');assert(await page.locator('#deploy').isEnabled());
  if(attempt===0){await page.screenshot({path:'qa/stability-recovered.png'});await page.locator('#deploy').click();await page.waitForTimeout(200);assert.equal((await snap()).mode,'playing');await page.keyboard.press('Escape');}
 }
 checks.push('Two forced GPU interruptions preserve the same page, ship, progress, and resume controls');
 await page.locator('#deploy').click();await page.waitForTimeout(300);await page.screenshot({path:'qa/stability-flight.png'});assert.equal((await snap()).mode,'playing');assert.deepEqual(errors,[]);
}finally{await writeFile('qa/stability-results.json',JSON.stringify({browser:browser.version(),checks,samples,errors,note:'Windows Edge automated flight and repeated streaming; GPU interruptions injected deliberately. The reported spontaneous tab exit was not reproduced.'},null,2));await browser.close();}
console.log(JSON.stringify({checks,errors}));
