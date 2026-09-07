import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const p=await browser.newPage({viewport:{width:1280,height:800}}),checks=[],errors=[];
p.on('pageerror',e=>errors.push(e.message));
const snap=()=>p.evaluate(()=>window.blacklineQA.snapshot());
async function approach(id){await p.evaluate(id=>{const q=window.blacklineQA,s=q.snapshot().encounters.sites.find(s=>s.id===id);q.teleport3(s.x+s.interaction.x,s.elevation+1.7,s.z+s.interaction.z);},id);await p.waitForTimeout(180);}
try{
 await p.goto('http://localhost:5180');await p.waitForFunction(()=>window.blacklineQA,null,{timeout:90000});await p.selectOption('#quality','low',{force:true});await p.evaluate(()=>window.blacklineQA.start());
 for(const [id,kind] of [['encounter:wreck:landing','wreck'],['encounter:distress:coast','distress']]){
  let s=(await snap()).encounters.sites.find(s=>s.id===id);assert(s);
  await approach(id);await p.evaluate(()=>window.blacklineQA.clear());await approach(id);
  const before=(await snap()).campaign.salvage;
  await p.keyboard.down('e');await p.waitForFunction(id=>window.blacklineQA.snapshot().encounters.sites.find(s=>s.id===id)?.step===1,id,{timeout:10000});await p.keyboard.up('e');
  assert.equal((await snap()).campaign.salvage,before);
  await approach(id);assert((await p.locator('#prompt-text').innerText()).includes('(2/2)'));
  await p.screenshot({path:`qa/encounter-${kind}-second-step.png`});
  await p.keyboard.down('e');await p.waitForFunction(id=>window.blacklineQA.snapshot().campaign.encountersCompleted.includes(id),id,{timeout:10000});await p.keyboard.up('e');
  assert.equal((await snap()).campaign.salvage,before+s.reward);checks.push(`${kind}: separate actions and positions; reward only after both steps`);
 }
 await p.evaluate(()=>window.blacklineQA.save());const reward=(await snap()).campaign.salvage;
 await p.reload();await p.waitForFunction(()=>window.blacklineQA,null,{timeout:90000});await p.locator('#deploy').click();
 assert.equal((await snap()).campaign.salvage,reward);assert((await snap()).campaign.encountersCompleted.includes('encounter:wreck:landing'));assert((await snap()).campaign.encountersCompleted.includes('encounter:distress:coast'));
 checks.push('completed encounters and rewards survive reload');assert.deepEqual(errors,[]);
}finally{await writeFile('qa/encounter-variety-results.json',JSON.stringify({checks,errors},null,2));await browser.close();}
console.log(JSON.stringify({checks,errors}));
