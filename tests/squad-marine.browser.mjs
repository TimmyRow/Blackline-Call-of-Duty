import {chromium} from '@playwright/test';
const browser=await chromium.launch({executablePath:'C:/Users/jcrow/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',headless:true});
const page=await browser.newPage();
try{
 await page.goto('http://localhost:5180/');
 console.log(JSON.stringify(await page.evaluate(async()=>{
  const source=await (await fetch('/src/squad.ts')).text();
  const THREE=await import(source.match(/from "([^"]*deps\/three\.js[^"]*)"/)[1]);
  const RAPIER=(await import(source.match(/from "([^"]*deps\/@dimforge_rapier3d-compat[^"]*)"/)[1])).default;
  await RAPIER.init();
  const {createSquad}=await import('/src/squad.ts'),{createMarine}=await import('/src/marine.ts');
  const scene=new THREE.Scene(),world=new RAPIER.World({x:0,y:-9.81,z:0}),marine=createMarine(scene,world),squad=createSquad(scene,world);
  marine.collider.parent().userData={squadPlatform:true};world.step();
  if(!marine.board(new THREE.Vector3(275,13.7,950)))throw new Error('Boarding failed');
  squad.embark();const exit=marine.tryExit();if(!exit)throw new Error('Boat exit failed');
  if(!squad.disembark(exit,0))throw new Error('Squad cannot find deck positions');
  for(let n=0;n<360;n++){squad.step(1/60,n/60,exit,0,[],()=>false,()=>{});world.step();squad.render(1/60,n/60,exit);}
  const result=squad.snapshot(),deck=marine.snapshot().deckY;
  if(result.embarked||result.members.some(m=>Math.abs(m.position[1]-deck)>.3))throw new Error('Squad fell off deck '+JSON.stringify(result));
  const untagged=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,30,0));world.createCollider(RAPIER.ColliderDesc.cuboid(5,.2,5),untagged);world.step();
  squad.embark();if(squad.disembark(new THREE.Vector3(0,31.9,0),0))throw new Error('Untagged actor/platform was accepted as safe ground');
  return{deckY:deck,members:result.members.map(m=>({name:m.name,position:m.position})),untaggedRejected:true};
 })));
}finally{await browser.close();}
