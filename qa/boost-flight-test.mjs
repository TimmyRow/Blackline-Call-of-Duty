import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const label=process.env.BOOST_LABEL||'baseline';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:2}),errors=[],samples=[];
page.on('crash',()=>errors.push('TAB CRASH'));page.on('close',()=>errors.push('TAB CLOSED'));page.on('pageerror',e=>errors.push(e.message));
const cdp=await page.context().newCDPSession(page),root=await browser.newBrowserCDPSession();
const gpu=await root.send('SystemInfo.getInfo');
await page.addInitScript(()=>{window.longTasks={count:0,max:0,total:0};new PerformanceObserver(list=>{for(const e of list.getEntries()){window.longTasks.count++;window.longTasks.max=Math.max(window.longTasks.max,e.duration);window.longTasks.total+=e.duration;}}).observe({type:'longtask',buffered:true});});
try{
 await page.goto('http://localhost:5180');await page.waitForFunction(()=>window.blacklineQA,null,{timeout:90000});
 await page.evaluate(()=>{const q=window.blacklineQA;q.start();q.flight.restoreAt({x:-1120,y:56.31,z:-995});q.teleport3(-1114,55.86,-995);});await page.keyboard.press('f');
 await page.keyboard.down('Space');await page.keyboard.down('Shift');await page.waitForTimeout(2000);await page.keyboard.up('Space');
 await page.evaluate(()=>{window.blacklineQA.look(Math.atan2(-470,-2135),0);window.longTasks={count:0,max:0,total:0};window.boostAlive='same-tab';});
 await page.keyboard.down('w');
 for(let i=0;i<12;i++){
  await page.waitForTimeout(5000);const s=await page.evaluate(()=>{const q=window.blacklineQA;q.flight.repair();const s=q.snapshot();return {mode:s.mode,position:s.flight.position,speed:s.flight.speed,graphics:s.graphics,world:s.world,drawCalls:s.drawCalls,triangles:s.triangles,renderCpuMs:s.renderCpuMs,simulationSeconds:s.time,longTasks:window.longTasks};});
  const heap=await cdp.send('Runtime.getHeapUsage');samples.push({...s,heap:heap.usedSize});console.log(JSON.stringify({sample:i,...samples.at(-1)}));assert.equal(s.mode,'playing');if(s.world.streaming){assert(s.world.streaming.maxBuilds<=2);assert(s.world.terrainChunks+s.world.streaming.pendingTerrain<=49);assert.equal(s.graphics.antialias,false);}assert.equal(await page.evaluate(()=>window.boostAlive),'same-tab');
 }
 await page.keyboard.up('w');await page.keyboard.up('Shift');await page.screenshot({path:`qa/boost-${label}.png`});assert.deepEqual(errors,[]);
}finally{await writeFile(`qa/boost-${label}.json`,JSON.stringify({gpu:gpu.gpu.devices,featureStatus:gpu.gpu.featureStatus,samples,errors},null,2));await browser.close();}
