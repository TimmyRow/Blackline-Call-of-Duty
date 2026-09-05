import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Users/jcrow/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:900}});await page.goto('http://localhost:5180/');await page.waitForFunction(()=>window.blacklineQA,undefined,{timeout:90000});
console.log(await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2');const ext=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable'};}));
for(const quality of ['high','low']){
 await page.selectOption('#quality',quality,{force:true});await page.evaluate(()=>window.blacklineQA.start());await page.waitForTimeout(1500);await page.keyboard.down('w');await page.mouse.move(720,450);await page.mouse.down();
 const timing=await page.evaluate(()=>new Promise(resolve=>{const times=[];let prev=performance.now();function step(now){times.push(now-prev);prev=now;if(times.length<100)requestAnimationFrame(step);else{times.sort((a,b)=>a-b);resolve({medianMs:times[50],p95Ms:times[95],fps:100000/times.reduce((a,b)=>a+b,0)});}}requestAnimationFrame(step);}));
 await page.keyboard.up('w');await page.mouse.up();console.log(JSON.stringify({quality,scenario:'active gameplay, forward movement and automatic fire',timing,snapshot:await page.evaluate(()=>window.blackline.snapshot())}));
}
await browser.close();
