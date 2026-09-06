import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {getLandingPads} from '../src/region-layout.mjs';

const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Users/jcrow/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));
const snapshot=()=>page.evaluate(()=>window.blacklineQA.snapshot());
const advance=async seconds=>{const t=(await snapshot()).time+seconds;await page.waitForFunction(t=>window.blacklineQA.snapshot().time>=t,t,{timeout:45000});};
const reset=async()=>{for(const key of ['w','a','s','d','Shift','Control','c','e','f','Space'])await page.keyboard.up(key);await page.mouse.up();await page.evaluate(()=>window.blacklineQA.start());await advance(.15);};
const board=async()=>{await page.evaluate(()=>{const p=window.blacklineQA.flight.position;window.blacklineQA.teleport3(p.x+6,p.y-.45,p.z);});await advance(.12);await page.keyboard.press('f');await advance(.1);assert.equal((await snapshot()).flight.piloting,true);};
async function run(name,fn){try{await reset();results.push({name,pass:true,detail:await fn()});}catch(e){results.push({name,pass:false,error:e.message,snapshot:await snapshot()});}console.log(JSON.stringify(results.at(-1)));}
try{
 await page.goto(process.env.GAME_URL||'http://localhost:5180/');await page.waitForFunction(()=>!!window.blacklineQA,null,{timeout:90000});
 await page.locator('#quality').selectOption('low',{force:true});
 await run('real boarding, takeoff, boost travel, airborne exit denial',async()=>{
  await board();assert.equal((await snapshot()).squad.embarked,true);
  const before=(await snapshot()).flight.position;await page.keyboard.down('Space');await advance(1.8);await page.keyboard.up('Space');
  await page.keyboard.down('w');await page.keyboard.down('Shift');await advance(2);await page.keyboard.up('w');await page.keyboard.up('Shift');
  const after=await snapshot();assert.ok(after.flight.position[1]>before[1]+60);assert.ok(before[2]-after.flight.position[2]>350);
  await page.keyboard.press('f');assert.equal((await snapshot()).flight.piloting,true);assert.match(await page.locator('#prompt-text').textContent(),/CTRL|LAND|SPACE/i);
  await page.screenshot({path:'qa/adventure-cockpit.png'});return {before,after:after.flight.position,distanceFlown:after.campaign.distanceFlown};
 });
 for(const [id,x,z] of [['carrier',240,900],['station',1150,470],['corsair',-650,1140]])await run(`real descent and squad disembark on ${id}`,async()=>{
  const pad=getLandingPads(x,z,120).find(p=>p.id===id);assert.ok(pad);await board();await page.keyboard.down('Space');await advance(.2);await page.keyboard.up('Space');
  // Arrange the approach, then exercise actual landing controls and physics against the visible deck.
  await page.evaluate(p=>{const q=window.blacklineQA;q.flight.position.set(p.x,p.y+48,p.z);q.flight.velocity.set(0,0,0);q.teleport3(p.x,p.y+49,p.z);q.look(0,-.05);},pad);
  await page.keyboard.down('Control');await page.waitForFunction(()=>window.blacklineQA.snapshot().flight.landed,null,{timeout:25000});await page.keyboard.up('Control');
  const landed=await snapshot();assert.ok(Math.abs(landed.flight.position[1]-(pad.y+2.15))<.2,JSON.stringify(landed.flight));
  await page.keyboard.press('f');await advance(.6);let s=await snapshot();assert.equal(s.flight.piloting,false);assert.equal(s.squad.embarked,false);assert.ok(Math.abs(s.position[1]-(pad.y+1.7))<.4,`player eye ${s.position[1]} deck ${pad.y}`);
  for(const member of s.squad.members)assert.ok(Math.abs(member.position[1]-pad.y)<1,`${member.name} y=${member.position[1]} deck=${pad.y}`);
  await page.screenshot({path:`qa/adventure-${id}.png`});
  if(id==='carrier'){
   await page.evaluate(()=>{const q=window.blacklineQA;q.teleport3(240,13.9,901);q.setAmmo(3,0);q.damage(25);q.flight.hurt(40);});await advance(.15);
   await page.keyboard.down('e');await advance(1.5);await page.keyboard.up('e');s=await snapshot();assert.equal(s.health,100);assert.equal(s.reserve,300);assert.equal(s.flight.health,100);assert.ok(s.campaign.visited.carrier);
  }
  return {landed:landed.flight.position,player:s.position,squad:s.squad.members.map(m=>({name:m.name,position:m.position})),resupplied:id==='carrier'?s.campaign.visited.carrier:undefined};
 });
 await run('real cockpit fire destroys a moving pirate interceptor',async()=>{
  await board();await page.keyboard.down('Space');await advance(.15);await page.keyboard.up('Space');
  await page.evaluate(()=>{const q=window.blacklineQA;q.flight.position.set(0,400,100);q.flight.velocity.set(0,0,0);q.teleport3(0,400,100);});await advance(.4);
  assert.ok((await snapshot()).airPirates.length>0);await page.mouse.move(720,440);await page.mouse.down();
  for(let i=0;i<35&&(await snapshot()).campaign.airKills<1;i++){
   await page.evaluate(()=>{const q=window.blacklineQA,s=q.snapshot(),target=s.airPirates[0];if(!target)return;const p=q.flight.position,a=target.position,dx=a[0]-p.x,dy=a[1]-(p.y+.7),dz=a[2]-p.z;q.look(Math.atan2(-dx,-dz),Math.atan2(dy,Math.hypot(dx,dz)));});await advance(.08);
  }
  await page.mouse.up();const s=await snapshot();assert.ok(s.campaign.airKills>=1);return {airKills:s.campaign.airKills,salvage:s.campaign.salvage,energy:s.flight.energy};
 });
}finally{await browser.close();await writeFile('qa/adventure-flight-results.json',JSON.stringify({results,errors},null,2));}
assert.equal(errors.length,0,errors.join('\n'));assert.equal(results.filter(r=>!r.pass).length,0,'Flight browser checks failed; inspect qa/adventure-flight-results.json');
