import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {REGION_SITES,heightAt} from '../src/region-layout.mjs';

const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Users/jcrow/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),results=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
const snapshot=()=>page.evaluate(()=>window.blacklineQA.snapshot());
const advance=async(seconds,keepAlive=false)=>{const target=(await snapshot()).time+seconds;await page.waitForFunction(({target,keepAlive})=>{const q=window.blacklineQA,s=q.snapshot();if(keepAlive&&s.health<60)q.damage(-60);return s.time>=target;},{target,keepAlive},{timeout:90000});};
const test=async(name,run)=>{try{results.push({name,pass:true,detail:await run()});}catch(e){results.push({name,pass:false,error:e.message,snapshot:await snapshot()});}console.log(JSON.stringify(results.at(-1)));};
const move=async(x,z)=>{await page.evaluate(({x,y,z})=>window.blacklineQA.teleport3(x,y,z),{x,y:heightAt(x,z)+1.7,z});await advance(.15);};
const harbour=REGION_SITES.find(s=>s.id==='harbour');
try{
 await page.goto(process.env.GAME_URL||'http://localhost:5180/');await page.waitForFunction(()=>!!window.blacklineQA,{timeout:60000});
 await page.evaluate(()=>{window.blacklineQA.start();window.blacklineQA.look(0,0);});
 await move(harbour.x,harbour.z+50);assert(await page.evaluate(()=>window.blacklineQA.regroup()));
 await test('Q focuses a hostile; comrades provide limited support without clearing the camp',async()=>{
  const initial=await snapshot();const target=await page.evaluate(()=>{const s=window.blacklineQA.snapshot();return s.enemyPositions.filter(e=>e.active&&e.health>0&&e.site==='harbour').find(e=>!window.blacklineQA.blocked(s.position,[e.position[0],e.position[1]+1.3,e.position[2]]));});assert(target,'A harbour guard must be visible from approach');
  const [px,py,pz]=initial.position,dx=target.position[0]-px,dz=target.position[2]-pz;await page.evaluate(({yaw,pitch})=>window.blacklineQA.look(yaw,pitch),{yaw:Math.atan2(-dx,-dz),pitch:Math.atan2(target.position[1]+1.3-py,Math.hypot(dx,dz))});await advance(.1);await page.keyboard.press('q');
  assert.equal((await snapshot()).squad.order,'attack');await advance(13,true);const after=await snapshot();
  assert.equal(after.mode,'playing');assert.equal(after.ammo,initial.ammo);assert(after.kills-initial.kills<3);assert(after.squad.members.every(m=>m.shotsFired>0&&m.damageDealt>0));assert(after.squad.members.reduce((n,m)=>n+m.damageDealt,0)<250);
  await page.screenshot({path:'qa/adventure-squad-combat.png'});return {kills:after.kills,ammo:after.ammo,members:after.squad.members.map(({name,shotsFired,damageDealt,kills})=>({name,shotsFired,damageDealt,kills}))};
 });
 await test('B holds comrades while the player takes a separate approach',async()=>{
  if((await snapshot()).squad.order==='hold')await page.keyboard.press('b');await page.keyboard.press('b');const before=await snapshot();assert.equal(before.squad.order,'hold');
  await move(harbour.x+65,harbour.z+50);await advance(2);const after=await snapshot();assert(after.squad.members.every((m,i)=>Math.hypot(m.position[0]-before.squad.members[i].position[0],m.position[2]-before.squad.members[i].position[2])<1));return after.squad;
 });
 await test('J supplies ammunition once and enforces its cooldown',async()=>{
  await move(harbour.x+65,harbour.z+50);assert(await page.evaluate(()=>window.blacklineQA.regroup()));await page.evaluate(()=>window.blacklineQA.setAmmo(30,30));await page.keyboard.press('j');const supplied=await snapshot();assert.equal(supplied.reserve,120);assert(supplied.squad.supplyCooldown>0);await page.keyboard.press('j');assert.equal((await snapshot()).reserve,120);return {reserve:supplied.reserve,cooldown:supplied.squad.supplyCooldown};
 });
 await test('cleared pirate cargo grants salvage and leaves the adventure playing',async()=>{
  await page.evaluate(()=>window.blacklineQA.clear());await move(harbour.x+2,harbour.z+1);const before=await snapshot();await page.keyboard.down('e');try{await advance(2.8);}finally{await page.keyboard.up('e');}const after=await snapshot();assert(after.campaign.completed.includes('harbour'));assert.equal(after.campaign.salvage,before.campaign.salvage+100);assert.equal(after.campaign.raids,before.campaign.raids+1);assert.equal(after.mode,'playing');return {salvage:after.campaign.salvage,raids:after.campaign.raids,mode:after.mode};
 });
 await test('atlas pans and zooms across the planet; choosing a procedural destination does not teleport',async()=>{
  await page.keyboard.press('Tab');await page.locator('[data-testid="field-map"]').waitFor({state:'visible'});const before=await snapshot(),scale=await page.locator('.atlas-scale').innerText(),canvas=page.locator('.fm-chart canvas'),box=await canvas.boundingBox();assert(box);
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.wheel(0,400);await page.waitForTimeout(200);assert.notEqual(await page.locator('.atlas-scale').innerText(),scale);
  await page.mouse.down();await page.mouse.move(box.x+box.width*.2,box.y+box.height*.7,{steps:8});await page.mouse.up();await page.waitForTimeout(200);
  const siteId=await page.locator('button[data-site]').evaluateAll(buttons=>buttons.map(b=>b.dataset.site).find(id=>id.includes(':')));assert(siteId,'Atlas should expose procedural places');await page.screenshot({path:'qa/adventure-atlas.png'});
  await page.locator(`button[data-site="${siteId}"]`).click();const after=await snapshot();assert.equal(after.campaign.tracked,siteId);assert.equal(after.mode,'playing');assert(Math.hypot(after.position[0]-before.position[0],after.position[2]-before.position[2])<.5);return {tracked:siteId,beforePosition:before.position,afterPosition:after.position};
 });
 await test('captured pirate camp becomes a squad resupply base',async()=>{
  await page.evaluate(()=>{window.blacklineQA.setAmmo(30,30);window.blacklineQA.damage(40);});const before=await snapshot();await page.keyboard.down('e');try{await advance(1.5);}finally{await page.keyboard.up('e');}const after=await snapshot();assert.equal(after.reserve,300);assert.equal(after.health,100);assert.equal(after.campaign.salvage,before.campaign.salvage);assert.equal(after.campaign.raids,before.campaign.raids);return {health:after.health,reserve:after.reserve,salvage:after.campaign.salvage};
 });
 await test('new expedition resets kills, claimed sites and hostile health',async()=>{
  await page.evaluate(()=>window.blacklineQA.start());await advance(.15);const after=await snapshot();assert.equal(after.kills,0);assert.equal(after.campaign.salvage,0);assert.deepEqual(after.campaign.completed,[]);assert(after.enemyPositions.some(e=>e.active&&e.site==='harbour'));assert(after.enemyPositions.filter(e=>e.active).every(e=>e.health===100));return {kills:after.kills,guards:after.enemyPositions.filter(e=>e.active).length};
 });
}finally{await writeFile('qa/adventure-ground-results.json',JSON.stringify({results,errors},null,2));await browser.close();}
assert.equal(errors.length,0,errors.join('\n'));assert(results.every(r=>r.pass),'Adventure ground QA has failing checks');
