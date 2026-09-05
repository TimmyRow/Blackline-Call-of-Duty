import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Users/jcrow/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'});
const page=await browser.newPage({viewport:{width:2200,height:700}});
await page.goto('http://localhost:5180/qa/comparison.html');await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));await page.screenshot({path:'qa/comparison.png'});await browser.close();
