import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://localhost:5180');await page.waitForFunction(()=>window.blacklineQA,null,{timeout:90000});
 await page.selectOption('#quality','low',{force:true});
 const result=await page.evaluate(async()=>{
  const q=window.blacklineQA;q.start();q.teleport(354,-146);q.pause();
  const {createEnemy}=await import('/src/actors.ts');
  // Obtain the same material prototype used by the actual streamed actor module.
  const probe=createEnemy(q.flight.group.clone(false)),material=probe.hitMeshes.find(m=>m.isMesh).material;
  let prototype=Object.getPrototypeOf(material);while(!Object.hasOwn(prototype,'dispose'))prototype=Object.getPrototypeOf(prototype);
  const original=prototype.dispose,colors=new Set([0x63bcae,0xff6544,0x79d7ff,0xee88ff,0xffc170]);let released=0;
  prototype.dispose=function(){if(colors.has(this.color?.getHex()))released++;return original.call(this);};
  const samples=[];
  try{
   probe.dispose();released=0;
   for(let i=0;i<8;i++){
    q.encounters.sync({x:354,z:-146});const count=q.encounters.snapshot().scouts.length;
    const before=released;q.encounters.sync({x:0,z:-50000});
    samples.push({scouts:count,privateMaterialsReleased:released-before});
   }
  }finally{prototype.dispose=original;}
  q.encounters.sync({x:354,z:-146});q.encounters.update(0,0,q.flight.position.clone().set(354,20,-146));q.look(-Math.PI/2,0);q.photo();
  return{samples,graphics:q.snapshot().graphics};
 });
 for(const s of result.samples){assert(s.scouts>=2);assert(s.privateMaterialsReleased>=s.scouts*5,'every unloaded scout must release its private optics/effect materials');}
 await page.waitForTimeout(350);await page.screenshot({path:'qa/scout-cleanup.png'});assert.deepEqual(errors,[]);
 await writeFile('qa/scout-cleanup-results.json',JSON.stringify({...result,errors},null,2));console.log(JSON.stringify({...result,errors}));
}finally{await browser.close();}
