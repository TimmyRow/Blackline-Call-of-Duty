import {chromium} from '@playwright/test';
const browser=await chromium.launch({executablePath:'C:/Users/jcrow/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',headless:true});
const page=await browser.newPage();
try{
 await page.goto('http://localhost:5180/');
 console.log(JSON.stringify(await page.evaluate(async()=>{
  const source=await (await fetch('/src/encounters.ts')).text();
  const THREE=await import(source.match(/from "([^"]*deps\/three\.js[^"]*)"/)[1]);
  const RAPIER=(await import(source.match(/from "([^"]*deps\/@dimforge_rapier3d-compat[^"]*)"/)[1])).default;
  await RAPIER.init();
  const {createEncounters}=await import('/src/encounters.ts');
  const scene=new THREE.Scene(),world=new RAPIER.World({x:0,y:-9.81,z:0}),encounters=createEncounters(scene,world),player=new THREE.Vector3(354,22,-146);
  encounters.sync(player);encounters.update(.016,0,player);world.step();
  const initial=encounters.snapshot(),p=initial.scouts[0].position;
  const target={position:new THREE.Vector3(p[0]+12,p[1],p[2]),health:1000,active:true};let shots=0,friendly=0,pirate=0;
  for(let n=0;n<1800;n++){const t=n/60;encounters.battle(1/60,t,player,[target],(a,b,f)=>{shots++;if(f==='friendly')friendly++;else pirate++;},(e,d)=>e.health-=d);encounters.update(1/60,t,player);world.step();}
  const after=encounters.snapshot();
  if(!(friendly>0&&pirate>0&&target.health<1000&&after.scouts.some(s=>s.health<100)))throw new Error('Two-way battle failed '+JSON.stringify({friendly,pirate,target:target.health,after}));
  const current=after.scouts[0].position;target.position.set(current[0]+12,current[1],current[2]);
  const wall=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(current[0]+6,current[1]+3,current[2]));world.createCollider(RAPIER.ColliderDesc.cuboid(.5,5,30),wall);world.step();
  const beforeShots=shots;
  for(let n=0;n<600;n++){const t=30+n/60;encounters.battle(1/60,t,player,[target],()=>shots++,(e,d)=>e.health-=d);}
  if(shots!==beforeShots)throw new Error('Scouts shot through solid cover');
  return{friendly,pirate,targetHealth:target.health,scouts:after.scouts,blockedShots:shots-beforeShots};
 })));
}finally{await browser.close();}
