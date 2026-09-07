import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Users/jcrow/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',headless:true});
const folder='artifacts/world-destinations';await mkdir(folder,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5180/');await page.waitForFunction(()=>window.blacklineQA,{timeout:120000});
 const captures=[
  ['vesper-port',42000,59.9,45,0,0],
  ['vesper-desert',42400,80,200,-1,.1],
  ['station-spine',1150,1801.9,460,0,0],
  ['station-observation',1150,1801.9,414,Math.PI/2,0],
  ['station-hangar',1084,1801.9,491,0,0],
  ['corsair-boarding',-650,10.9,1130,0,0],
  ['corsair-bridge',-650,10.9,1095,0,0]
 ];
 const results=[];
 for(const [name,x,y,z,yaw,pitch]of captures){
  await page.evaluate(({x,y,z,yaw,pitch})=>{blacklineQA.start();blacklineQA.setClimate({hour:12,weather:'clear'});blacklineQA.teleport3(x,y,z);blacklineQA.clear();blacklineQA.look(yaw,pitch);},{x,y,z,yaw,pitch});
  await page.waitForTimeout(800);await page.evaluate(()=>blacklineQA.photo());await page.waitForTimeout(100);await page.screenshot({path:`${folder}/${name}.png`});
  const result=await page.evaluate(()=>{const s=blacklineQA.snapshot();return {position:s.position,planet:s.planet,region:s.region,graphics:s.graphics,drawCalls:s.drawCalls};});results.push({name,...result});
 }
 const routes=await page.evaluate(()=>{
  const result=[];
  for(const route of [{name:'station',x:1150,y:1801.4,from:461,to:399},{name:'corsair',x:-650,y:10.4,from:1130,to:1078}]){
   blacklineQA.teleport3(route.x,route.y+.3,route.from);
   for(const dx of [-.5,0,.5])result.push({name:route.name,dx,blocked:blacklineQA.blocked([route.x+dx,route.y,route.from],[route.x+dx,route.y,route.to])});
  }return result;
 });
 await writeFile(`${folder}/report.json`,JSON.stringify({results,routes,errors},null,2));console.log(JSON.stringify({results,routes,errors}));
 for(const route of routes)assert.equal(route.blocked,false,`${route.name} route blocked at ${route.dx}`);assert.deepEqual(errors,[]);
}finally{await browser.close();}
