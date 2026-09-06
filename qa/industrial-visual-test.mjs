import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:'C:/Users/jcrow/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{await page.goto('http://localhost:5180');await page.waitForFunction(()=>window.blacklineQA,null,{timeout:90000});
for(const [name,x,y,z,yaw]of [['start',0,17.8,110,0],['harbour',0,19.8,16,0],['street',0,19.8,52,0],['relay',-690,53.8,-518,0],['carrier',245,13.9,935,0]]){await page.evaluate(({x,y,z,yaw})=>{const q=window.blacklineQA;q.start();q.clear();q.teleport3(x,y,z);q.look(yaw,-.04);q.regroup();},{x,y,z,yaw});await page.waitForTimeout(4200);await page.screenshot({path:`qa/industrial-${name}.png`});}
console.log(JSON.stringify({errors,snapshot:await page.evaluate(()=>window.blacklineQA.snapshot().world)}));await writeFile('qa/industrial-render-errors.json',JSON.stringify(errors,null,2));}finally{await browser.close();}
