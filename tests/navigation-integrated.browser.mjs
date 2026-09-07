import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Users/jcrow/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',headless:true});
try{
 for(const mobile of [false,true]){
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:5180/');await page.waitForFunction(()=>!!window.blacklineQA,{timeout:60000});
  await page.evaluate(()=>{blacklineQA.start();blacklineQA.track('station');blacklineQA.look(0,0);});await page.waitForTimeout(400);
  assert.equal(await page.locator('.nav-target').getAttribute('data-target'),'station');const first=await page.locator('.nav-compass-marker').getAttribute('style');
  await page.evaluate(()=>blacklineQA.look(-Math.PI/2,0));await page.waitForTimeout(350);const second=await page.locator('.nav-compass-marker').getAttribute('style');assert.notEqual(first,second);
  await page.screenshot({path:`artifacts/navigation-qa/real-${mobile?'mobile':'desktop'}-hud.png`});
  if(mobile)await page.locator('[data-tap="Tab"]').click();else await page.keyboard.press('Tab');await page.waitForSelector('.field-map:not([hidden])');assert.match(await page.locator('.fm-tracked-summary').innerText(),/Meridian Anchorage/);assert.match(await page.locator('.fm-site.is-tracked').innerText(),/Meridian Anchorage/);await page.screenshot({path:`artifacts/navigation-qa/real-${mobile?'mobile':'desktop'}-map.png`});await page.locator('.fm-close').click();
  await page.evaluate(()=>{blacklineQA.track('kestrel');blacklineQA.flight.board(blacklineQA.flight.position);});await page.waitForTimeout(350);assert.equal(await page.locator('.nav-ship').isVisible(),false);assert.equal(await page.locator('.nav-target').isVisible(),false);assert.equal(await page.locator('.nav-flight').isVisible(),true);
  await page.evaluate(()=>blacklineQA.openJournal('equipment'));await page.locator('#expedition-systems').scrollIntoViewIfNeeded();await page.screenshot({path:`artifacts/navigation-qa/real-${mobile?'mobile':'desktop'}-journal.png`});assert.equal(await page.locator('[data-scan]').count(),1);assert.equal(await page.locator('[data-travel]').count(),2);
  console.log(JSON.stringify({mobile,first,second,errors}));await page.close();
 }
}finally{await browser.close();}
