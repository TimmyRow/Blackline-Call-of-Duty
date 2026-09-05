import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildEnvironment } from './environment';
import { createWeapon, createEnemy } from './actors';
import { Sound } from './audio';
import { bulletDamage, reloadAmmo, canInteract, grenadeDamage, RELOAD_SECONDS } from './rules.mjs';
import './style.css';

const $ = <T extends HTMLElement = HTMLElement>(id:string) => document.getElementById(id) as T;
$('app').innerHTML=`<div id="viewport"></div><div id="vignette"></div><div id="damage"></div>
<div id="hud" hidden><div id="objective"><small id="objective-phase">01 / INFILTRATE</small><div id="objective-name">Clear the container yard</div><div id="objective-detail">Hostiles remaining: 6</div></div><div id="compass">W · · · N · · · E<strong id="bearing">000</strong></div><div id="telemetry">COLD HARBOUR<br><span id="fps"></span></div><div id="health-cluster"><span>VIPER 1 <span id="health-value">100</span></span><div id="health-track"><div id="health-fill"></div></div><span id="stance">STANDING</span></div><div id="ammo-cluster"><div id="weapon-name">MK18 MOD 1 &nbsp; / &nbsp; AUTO</div><div><span id="ammo">30</span> <span id="reserve">/ 180</span></div><div id="utility">G &nbsp; FRAG × <span id="grenades">3</span></div></div><div id="crosshair"></div><div id="hitmarker">×</div><div id="toast"></div><div id="prompt" hidden><span id="prompt-text"></span><div id="terminal-progress"></div></div><div id="subtitle" hidden></div></div>
<main id="menu"><header class="masthead"><div class="brand"><span class="brand-mark"></span>BLACKLINE</div><div class="classification">SPECIAL OPERATIONS DIVISION &nbsp; / &nbsp; 07</div></header><section class="menu-content" id="menu-content"><div class="eyebrow" id="eyebrow">SINGLE PLAYER · NIGHT OPERATION</div><h1 id="title">BLACKLINE</h1><h2 id="mission-title">OPERATION COLD HARBOUR</h2><p class="mission-copy" id="mission-copy">A stolen uplink. A port gone dark.<br>Infiltrate the yard, recover the signal, and get out.</p><div class="mission-meta" id="mission-meta"><div>LOCATION<span>NORTH ATLANTIC</span></div><div>LOCAL TIME<span>03:47 AM</span></div><div>CONDITIONS<span>HEAVY RAIN</span></div></div><div id="result-stats" hidden></div><button class="primary" id="deploy" disabled><span id="deploy-label">PREPARING OPERATION</span><span>↗</span></button><div id="loading">Establishing uplink…</div><div id="mobile-note">Keyboard and mouse required. Open on a desktop to deploy.</div><button class="secondary" id="controls-button">CONTROLS & SETTINGS</button></section><section id="settings" hidden><h3>FIELD SETTINGS</h3><div class="control-grid"><span><b>W A S D</b> &nbsp; Move</span><span><b>MOUSE</b> &nbsp; Look</span><span><b>LEFT CLICK</b> &nbsp; Fire</span><span><b>RIGHT CLICK</b> &nbsp; Aim</span><span><b>SHIFT</b> &nbsp; Sprint</span><span><b>SPACE</b> &nbsp; Jump</span><span><b>C / CTRL</b> &nbsp; Crouch</span><span><b>R</b> &nbsp; Reload</span><span><b>G</b> &nbsp; Grenade</span><span><b>E</b> &nbsp; Interact</span><span><b>ESC / P</b> &nbsp; Pause</span><span><b>M</b> &nbsp; Mute</span></div><label>Mouse sensitivity<input id="sensitivity" type="range" min="0.3" max="2" step="0.05" value="1"></label><label>Visual quality<select id="quality"><option value="high">High — atmospheric lighting</option><option value="low">Performance — reduced effects</option></select></label><button class="secondary" id="audio-toggle">SOUND ON</button><br><button class="secondary" id="settings-close">← RETURN TO OPERATION</button></section><footer class="bottomline"><div><span class="status-dot"></span>UPLINK <strong>ESTABLISHED</strong><br><span style="display:block;margin-top:7px">THREE.JS &nbsp; / &nbsp; TACTICAL FPS</span></div><div class="coordinate">58° 42′ 09″ N &nbsp; 07° 13′ 41″ W<br><strong>CLASSIFIED / EYES ONLY</strong></div></footer></main>`;

type Mode='menu'|'playing'|'paused'|'won'|'dead';
const state={mode:'menu' as Mode,health:100,ammo:30,reserve:180,grenades:3,kills:0,shots:0,hits:0,time:0,stage:0,upload:0,reload:0,lastShot:-10,lastDamage:-10,recoil:0,yaw:0,pitch:0,vertical:0,grounded:false};
const sound=new Sound(), keys=new Set<string>();
let firing=false,aiming=false,dragging=false,sensitivity=1,ready=false,accumulator=0,total=0,stepTime=0,toastUntil=0,subtitleUntil=0,hitUntil=0,crouched=false;
const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.045,200);
// Renderer creation stays in the guarded boot path so an unavailable GPU has a readable failure state.
let renderer:THREE.WebGLRenderer,composer:EffectComposer;
let env:ReturnType<typeof buildEnvironment>,weapon:ReturnType<typeof createWeapon>;
let world:RAPIER.World,body:RAPIER.RigidBody,collider:RAPIER.Collider,controller:RAPIER.KinematicCharacterController;
const ray=new THREE.Raycaster(), v=new THREE.Vector3(), forward=new THREE.Vector3(), targetPos=new THREE.Vector3();
type Enemy={visual:ReturnType<typeof createEnemy>,position:THREE.Vector3,health:number,timer:number,alert:number,seed:number,body:RAPIER.RigidBody,collider:RAPIER.Collider,controller:RAPIER.KinematicCharacterController};
const enemies:Enemy[]=[];
const spawnPoints=[[-9,-7],[8,-13],[-3,-21],[-12,-28],[13,-30],[3,-31]];
type Particle={mesh:THREE.Mesh,velocity:THREE.Vector3,life:number,max:number};
const particles:Particle[]=[];
const traces:{line:THREE.Line,life:number}[]=[];
const grenades:{body:RAPIER.RigidBody,mesh:THREE.Mesh,life:number}[]=[];
const particleGeometry=new THREE.SphereGeometry(.035,4,3),sparkMaterial=new THREE.MeshBasicMaterial({color:0xffc47b});
const grenadeGeometry=new THREE.SphereGeometry(.11,10,8),grenadeMaterial=new THREE.MeshStandardMaterial({color:0x445647,metalness:.7,roughness:.5});
const terminal=new THREE.Vector3(0,0,-32),extraction=new THREE.Vector3(0,0,15);
let terminalScreen:THREE.Mesh,beacon:THREE.Mesh;

function toast(text:string,seconds=2){$('toast').textContent=text;toastUntil=total+seconds;$('toast').style.opacity='1';}
function subtitle(text:string,seconds=5){$('subtitle').innerHTML=`<b>OVERWATCH</b> &nbsp; ${text}`;$('subtitle').hidden=false;subtitleUntil=total+seconds;}
function setMenu(mode:Mode){
 state.mode=mode;const playing=mode==='playing';$('menu').hidden=playing;$('hud').hidden=!playing;firing=false;aiming=false;keys.clear();dragging=false;
 $('settings').hidden=true;$('menu-content').hidden=false;
 if(!playing&&document.pointerLockElement)document.exitPointerLock();
 $('menu').classList.toggle('paused',mode!=='menu');
 if(mode==='paused'){ $('title').textContent='ON HOLD';$('eyebrow').textContent='OPERATION PAUSED';$('mission-copy').textContent='The mission is paused. Resume when you’re ready.';$('deploy-label').textContent='RESUME OPERATION';$('mission-meta').hidden=true; }
 if(mode==='won'||mode==='dead'){
  $('title').textContent=mode==='won'?'SIGNAL SECURED':'SIGNAL LOST';$('eyebrow').textContent=mode==='won'?'OPERATION COMPLETE':'OPERATOR DOWN';$('mission-title').textContent=mode==='won'?'EXTRACTION CONFIRMED':'OPERATION COLD HARBOUR';$('mission-copy').textContent=mode==='won'?'Uplink recovered. Your extraction is clear.':'Use cover to break line of sight. Your health regenerates after a short delay.';$('deploy-label').textContent='REDEPLOY';$('mission-meta').hidden=true;$('result-stats').hidden=false;
  $('result-stats').textContent=`${state.kills} / 6 hostiles neutralized  ·  ${Math.floor(state.time/60)}:${String(Math.floor(state.time%60)).padStart(2,'0')} elapsed  ·  ${state.shots?Math.round(state.hits/state.shots*100):0}% accuracy`;
 }
}
function reset(){
 Object.assign(state,{health:100,ammo:30,reserve:180,grenades:3,kills:0,shots:0,hits:0,time:0,stage:0,upload:0,reload:0,lastShot:-10,lastDamage:-10,recoil:0,yaw:0,pitch:0,vertical:0});
 crouched=false;collider.setHalfHeight(.65);body.setTranslation({x:0,y:1,z:15},true);body.setNextKinematicTranslation({x:0,y:1,z:15});
 camera.position.set(0,1.7,15);camera.rotation.set(0,0,0);accumulator=0;
 enemies.forEach((e,i)=>{e.position.set(spawnPoints[i][0],0,spawnPoints[i][1]);e.health=100;e.timer=1.5+i*.25;e.alert=0;e.visual.group.position.copy(e.position);e.visual.group.rotation.set(0,0,0);e.body.setTranslation({x:e.position.x,y:.95,z:e.position.z},true);e.body.setNextKinematicTranslation({x:e.position.x,y:.95,z:e.position.z});e.collider.setEnabled(true);});
 for(const g of grenades){world.removeRigidBody(g.body);scene.remove(g.mesh);}grenades.length=0;
 for(const p of particles)scene.remove(p.mesh);particles.length=0;
 for(const t of traces){scene.remove(t.line);t.line.geometry.dispose();(t.line.material as THREE.Material).dispose();}traces.length=0;
 $('result-stats').hidden=true;$('damage').style.opacity='0';subtitle('Viper One, you’re in. Clear the yard and reach the uplink terminal.',6);updateHud();
}
async function deploy(){
 if(!ready)return;
 sound.start(); if(state.mode!=='paused')reset();setMenu('playing');
 try{await renderer.domElement.requestPointerLock();}catch{toast('POINTER CAPTURE UNAVAILABLE · HOLD LEFT MOUSE TO LOOK',5);}
}
$('deploy').addEventListener('click',()=>void deploy());
$('controls-button').onclick=()=>{$('settings').hidden=false;$('menu-content').hidden=true;};
$('settings-close').onclick=()=>{$('settings').hidden=true;$('menu-content').hidden=false;};
$<HTMLInputElement>('sensitivity').oninput=e=>{sensitivity=+(e.target as HTMLInputElement).value;};
function toggleSound(){sound.toggle();$('audio-toggle').textContent=sound.muted?'SOUND OFF':'SOUND ON';}
$('audio-toggle').onclick=toggleSound;
$<HTMLSelectElement>('quality').onchange=()=>{if(!renderer)return;const high=$<HTMLSelectElement>('quality').value==='high';renderer.setPixelRatio(Math.min(devicePixelRatio,high?1.5:1));renderer.shadowMap.enabled=high;composer.passes[1].enabled=high;resize();};
window.addEventListener('keydown',e=>{
 if(['Space','Tab','ControlLeft','ControlRight'].includes(e.code))e.preventDefault();
 if(e.code==='KeyM'&&!e.repeat)toggleSound();
 if((e.code==='KeyP'||e.code==='Escape')&&state.mode==='playing'){setMenu('paused');return;}
 if(state.mode!=='playing')return; keys.add(e.code);
 if(!e.repeat&&e.code==='KeyR')reload();if(!e.repeat&&e.code==='KeyG')throwGrenade();
 if(e.code==='Space'&&!e.repeat&&state.grounded){state.vertical=5.6;state.grounded=false;}
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{if(state.mode==='playing')setMenu('paused');});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.mode==='playing')setMenu('paused');});
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&state.mode==='playing')setMenu('paused');});
window.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('mousedown',e=>{if(state.mode!=='playing'||e.target!==renderer.domElement)return;if(e.button===0){firing=true;dragging=true;}if(e.button===2)aiming=true;});
window.addEventListener('mouseup',e=>{if(e.button===0){firing=false;dragging=false;}if(e.button===2)aiming=false;});
window.addEventListener('mousemove',e=>{if(state.mode!=='playing'||(!document.pointerLockElement&&!dragging))return;const scale=.0018*sensitivity*(aiming?.55:1);state.yaw-=e.movementX*scale;state.pitch=THREE.MathUtils.clamp(state.pitch-e.movementY*scale,-1.45,1.45);});

function reload(){if(state.reload>0||state.ammo===30||state.reserve===0)return;state.reload=RELOAD_SECONDS;sound.reload();toast('RELOADING',1.85);}
function blocked(from:THREE.Vector3,to:THREE.Vector3){v.subVectors(to,from);const distance=v.length();if(distance<.001)return false;ray.set(from,v.normalize());ray.far=distance-.15;return ray.intersectObjects(env.occluders,false).length>0;}
function tracer(from:THREE.Vector3,to:THREE.Vector3,color=0xffd9a0){const geometry=new THREE.BufferGeometry().setFromPoints([from,to]);const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity:.8}));scene.add(line);traces.push({line,life:.06});}
function sparks(at:THREE.Vector3,count=8){for(let i=0;i<count;i++){if(particles.length>180)break;const mesh=new THREE.Mesh(particleGeometry,sparkMaterial);mesh.position.copy(at);scene.add(mesh);const life=.15+Math.random()*.4;particles.push({mesh,velocity:new THREE.Vector3((Math.random()-.5)*6,Math.random()*4,(Math.random()-.5)*6),life,max:life});}}
function damageEnemy(e:Enemy,damage:number,at:THREE.Vector3){if(e.health<=0)return;e.health-=damage;e.alert=8;sparks(at,5);sound.hit();hitUntil=total+.13;$('hitmarker').style.opacity='1';if(e.health<=0){state.kills++;e.collider.setEnabled(false);toast('HOSTILE NEUTRALIZED',1);if(state.kills===enemies.length){state.stage=1;subtitle('Yard is clear. Move to the uplink terminal. Hold E to recover the signal.');}}}
function fire(){
 if(state.reload>0||state.time-state.lastShot<.1)return;
 if(state.ammo===0){reload();return;}state.lastShot=state.time;state.ammo--;state.shots++;state.recoil=Math.min(.09,state.recoil+.026);state.pitch=Math.min(1.4,state.pitch+(aiming?.0025:.006));weapon.flash();sound.shot();
 scene.updateMatrixWorld(true);ray.setFromCamera(new THREE.Vector2((Math.random()-.5)*(aiming?.0008:.008),(Math.random()-.5)*(aiming?.0008:.008)),camera);ray.far=120;
 const targets=enemies.filter(e=>e.health>0).flatMap(e=>e.visual.hitMeshes);const hits=ray.intersectObjects([...env.occluders,...targets],false);
 const hit=hits[0],end=hit?hit.point.clone():ray.ray.at(100,new THREE.Vector3());const muzzle=weapon.muzzle.getWorldPosition(new THREE.Vector3());tracer(muzzle,end);
 if(hit){const enemy=enemies.find(e=>e.visual.hitMeshes.includes(hit.object));if(enemy){state.hits++;damageEnemy(enemy,bulletDamage(!!hit.object.userData.head,hit.distance),hit.point);}else sparks(hit.point);}
 enemies.forEach(e=>{if(e.position.distanceTo(camera.position)<28)e.alert=6;});
}
function hurt(amount:number){state.health=Math.max(0,state.health-amount);state.lastDamage=state.time;sound.noise(.2,.3,500);if(state.health===0)setMenu('dead');}
function throwGrenade(){
 if(!state.grenades)return;state.grenades--;camera.getWorldDirection(forward);const pos=camera.position.clone().addScaledVector(forward,.7);
 const rb=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x,pos.y,pos.z).setCcdEnabled(true));
 world.createCollider(RAPIER.ColliderDesc.ball(.11).setRestitution(.35).setFriction(.8).setDensity(4),rb);rb.setLinvel({x:forward.x*13,y:forward.y*13+4,z:forward.z*13},true);
 const mesh=new THREE.Mesh(grenadeGeometry,grenadeMaterial);mesh.position.copy(pos);scene.add(mesh);grenades.push({body:rb,mesh,life:2.4});sound.reload();
}
function explode(position:THREE.Vector3){
 sound.explosion();sparks(position,65);const light=new THREE.PointLight(0xff9f42,80,18,2);light.position.copy(position);scene.add(light);
 const flash=new THREE.Mesh(new THREE.SphereGeometry(.6,12,8),new THREE.MeshBasicMaterial({color:0xffb34e,transparent:true,opacity:.8}));flash.position.copy(position);scene.add(flash);
 window.setTimeout(()=>{scene.remove(light,flash);flash.geometry.dispose();(flash.material as THREE.Material).dispose();},160);
 enemies.forEach(e=>{targetPos.copy(e.position).y=1;const d=targetPos.distanceTo(position);if(e.health>0&&d<7&&!blocked(position,targetPos))damageEnemy(e,grenadeDamage(d),targetPos.clone());});
 const distance=position.distanceTo(camera.position);if(distance<6&&!blocked(position,camera.position))hurt(grenadeDamage(distance)*.5);
}
function fixedStep(dt:number){
 state.time+=dt;let p=body.translation();const wantsCrouch=keys.has('KeyC')||keys.has('ControlLeft');
 if(wantsCrouch&&!crouched){collider.setHalfHeight(.35);body.setTranslation({x:p.x,y:p.y-.3,z:p.z},true);crouched=true;p=body.translation();}
 else if(!wantsCrouch&&crouched){let occupied=false;world.intersectionsWithShape({x:p.x,y:p.y+.3,z:p.z},{x:0,y:0,z:0,w:1},new RAPIER.Capsule(.64,.29),()=>{occupied=true;return false;},undefined,undefined,collider,body);if(!occupied){collider.setHalfHeight(.65);body.setTranslation({x:p.x,y:p.y+.3,z:p.z},true);crouched=false;p=body.translation();}}
 const crouching=crouched,sprinting=(keys.has('ShiftLeft')||keys.has('ShiftRight'))&&!aiming&&!crouching;
 let x=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),z=(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0);const magnitude=Math.hypot(x,z)||1;x/=magnitude;z/=magnitude;
 const speed=crouching?2.3:sprinting?7:4.2,cs=Math.cos(state.yaw),sn=Math.sin(state.yaw);state.vertical=Math.max(-22,state.vertical-17*dt);
 controller.computeColliderMovement(collider,{x:(x*cs+z*sn)*speed*dt,y:state.vertical*dt,z:(z*cs-x*sn)*speed*dt});const movement=controller.computedMovement();state.grounded=controller.computedGrounded();if(state.grounded&&state.vertical<0)state.vertical=0;
 body.setNextKinematicTranslation({x:p.x+movement.x,y:p.y+movement.y,z:p.z+movement.z});
 if(Math.hypot(movement.x,movement.z)>.001&&state.grounded){stepTime+=dt;if(stepTime>(sprinting?.3:.46)){sound.step();stepTime=0;}}
 if(state.reload>0){state.reload-=dt;if(state.reload<=0){Object.assign(state,reloadAmmo(state.ammo,state.reserve));sound.reload();}}
 if(firing&&!sprinting)fire();
 if(state.time-state.lastDamage>4.5)state.health=Math.min(100,state.health+dt*12);
 for(const e of enemies){
  if(e.health<=0)continue;e.timer-=dt;e.alert-=dt;const distance=e.position.distanceTo(camera.position);targetPos.copy(e.position).y=1.55;const sees=distance<30&&!blocked(targetPos,camera.position);
  if(sees)e.alert=6;
  if(e.alert>0){
   const dx=camera.position.x-e.position.x,dz=camera.position.z-e.position.z;e.visual.group.rotation.y=Math.atan2(-dx,-dz);
   const drift=Math.sin(state.time*.8+e.seed)*.35;const advance=distance>13?.75:distance<7?-.6:0;
   const len=Math.hypot(dx,dz)||1;const mx=(dx/len*advance+dz/len*drift)*dt,mz=(dz/len*advance-dx/len*drift)*dt;
   e.controller.computeColliderMovement(e.collider,{x:mx,y:-.04,z:mz});const m=e.controller.computedMovement();const ep=e.body.translation();e.body.setNextKinematicTranslation({x:ep.x+m.x,y:ep.y+m.y,z:ep.z+m.z});
   if(sees&&e.timer<=0){e.timer=.8+Math.random()*.7;const muzzle=targetPos.clone();muzzle.y=1.3;tracer(muzzle,camera.position.clone().add(new THREE.Vector3((Math.random()-.5)*1.2,-.15,0)),0xff8755);sound.shot(true);if(Math.random()<(sprinting?.3:crouching?.38:.55))hurt(5+Math.random()*4);}
  }
 }
 world.timestep=dt;world.step();
 const bp=body.translation();const targetEye=bp.y+(crouching?.48:.7);camera.position.x=bp.x;camera.position.z=bp.z;camera.position.y=THREE.MathUtils.lerp(camera.position.y,targetEye,.25);
 if(camera.position.y < -10){hurt(100);}
 for(const e of enemies){const ep=e.body.translation();e.position.set(ep.x,ep.y-.95,ep.z);e.visual.group.position.copy(e.position);}
 for(let i=grenades.length-1;i>=0;i--){const g=grenades[i];g.life-=dt;const gp=g.body.translation();g.mesh.position.set(gp.x,gp.y,gp.z);g.mesh.quaternion.copy(g.body.rotation());if(g.life<=0){explode(g.mesh.position.clone());scene.remove(g.mesh);world.removeRigidBody(g.body);grenades.splice(i,1);}}
 if(state.stage===1&&canInteract(camera.position,terminal,enemies.length-state.kills)&&keys.has('KeyE')){state.upload+=dt;if(state.upload>=3){state.stage=2;subtitle('Signal secured. Return to the insertion point for extraction.',6);toast('UPLINK RECOVERED',3);}}else if(state.stage===1)state.upload=Math.max(0,state.upload-dt*.8);
 if(state.stage===2&&camera.position.distanceTo(extraction)<3&&keys.has('KeyE'))setMenu('won');
}
function updateHud(){
 $('ammo').textContent=String(state.ammo).padStart(2,'0');$('reserve').textContent=`/ ${state.reserve}`;$('grenades').textContent=String(state.grenades);$('health-value').textContent=String(Math.ceil(state.health));$('health-fill').style.width=`${state.health}%`;$('health-cluster').classList.toggle('danger',state.health<35);
 $('stance').textContent=keys.has('KeyC')||keys.has('ControlLeft')?'CROUCHED':keys.has('ShiftLeft')?'SPRINTING':'STANDING';
 $('objective-phase').textContent=['01 / INFILTRATE','02 / RECOVER','03 / EXTRACT'][state.stage];$('objective-name').textContent=['Clear the container yard','Recover the uplink','Return to insertion point'][state.stage];
 const distance=Math.round(camera.position.distanceTo(state.stage===2?extraction:terminal));$('objective-detail').textContent=state.stage===0?`Hostiles remaining: ${enemies.length-state.kills}`:`${state.stage===1?'Terminal':'Extraction'} · ${distance} m`;
 $('bearing').textContent=String(Math.round(((-state.yaw*180/Math.PI)%360+360)%360)).padStart(3,'0');$('crosshair').classList.toggle('aiming',aiming);
 let prompt='';if(state.reload>0)prompt='RELOADING';else if(state.stage===1&&canInteract(camera.position,terminal,0))prompt='HOLD E  ·  RECOVER UPLINK';else if(state.stage===2&&distance<3)prompt='E  ·  EXTRACT';else if(state.ammo===0)prompt='R  ·  RELOAD';
 $('prompt').hidden=!prompt;$('prompt-text').textContent=prompt;$('terminal-progress').style.width=`${state.stage===1?state.upload/3*100:0}%`;
 $('damage').style.opacity=String(Math.max(state.health<30?.25:0,1-(state.time-state.lastDamage)*1.5)*.7);
}
function resize(){if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);}
window.addEventListener('resize',resize);
let last=performance.now(),frames=0,frameSum=0,lastRenderMs=0;
function animate(now:number){
 requestAnimationFrame(animate);const realElapsed=(now-last)/1000,elapsed=Math.min(.05,realElapsed);last=now;total+=elapsed;frames++;frameSum+=realElapsed;
 if(frameSum>=1){$('fps').textContent=`${Math.round(frames/frameSum)} FPS`;frames=0;frameSum=0;}
 if(state.mode==='playing'){
  accumulator+=elapsed;while(accumulator>=1/60){fixedStep(1/60);accumulator-=1/60;if(state.mode!=='playing'){accumulator=0;break;}}
  camera.rotation.set(state.pitch+state.recoil*.2,state.yaw,0,'YXZ');state.recoil*=Math.exp(-elapsed*15);
  const targetFov=aiming?52:keys.has('ShiftLeft')?80:75;camera.fov=THREE.MathUtils.lerp(camera.fov,targetFov,1-Math.exp(-elapsed*12));camera.updateProjectionMatrix();updateHud();
 }else if(state.mode==='menu'){camera.position.set(.5,2.1,15);camera.rotation.set(-.025,Math.sin(total*.055)*.05,0,'YXZ');}
 const moving=state.mode==='playing'&&['KeyW','KeyA','KeyS','KeyD'].some(k=>keys.has(k))?1:0;
 weapon.update(elapsed,{time:total,moving,sprinting:keys.has('ShiftLeft')&&!aiming,aiming,reload:state.reload>0?1-state.reload/RELOAD_SECONDS:0,recoil:state.recoil});
 for(const e of enemies)e.visual.update(state.mode==='playing'?elapsed:0,{time:state.time+e.seed,moving:e.health>0&&e.alert>0,firing:e.health>0&&e.timer>1.35&&e.alert>0,dead:e.health<=0});
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=elapsed;p.velocity.y-=elapsed*9;p.mesh.position.addScaledVector(p.velocity,elapsed);p.mesh.scale.setScalar(Math.max(0,p.life/p.max));if(p.life<=0){scene.remove(p.mesh);particles.splice(i,1);}}
 for(let i=traces.length-1;i>=0;i--){const t=traces[i];t.life-=elapsed;if(t.life<=0){scene.remove(t.line);t.line.geometry.dispose();(t.line.material as THREE.Material).dispose();traces.splice(i,1);}}
 env.update(elapsed,total,camera.position);beacon.position.copy(state.stage===2?extraction:terminal);beacon.position.y=.06;beacon.rotation.z=total*.3;beacon.visible=state.stage>0;terminalScreen.material instanceof THREE.MeshStandardMaterial&&(terminalScreen.material.emissiveIntensity=1.2+Math.sin(total*2)*.2);
 if(total>toastUntil)$('toast').style.opacity='0';if(total>subtitleUntil)$('subtitle').hidden=true;if(total>hitUntil)$('hitmarker').style.opacity='0';
 renderer.info.reset();const renderStart=performance.now();composer.render();lastRenderMs=performance.now()-renderStart;
}
async function boot(){
 try{
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.outputColorSpace=THREE.SRGBColorSpace;$('viewport').append(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();setMenu('paused');$('loading').textContent='Graphics context interrupted. Restoring…';});renderer.domElement.addEventListener('webglcontextrestored',()=>location.reload());
  scene.add(camera);renderer.info.autoReset=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  env=buildEnvironment(scene);weapon=createWeapon(camera);weapon.group.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=false;o.receiveShadow=false;}});camera.position.set(0,1.7,15);
  composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.23,.5,1.2));composer.addPass(new OutputPass());
  await RAPIER.init();world=new RAPIER.World({x:0,y:-17,z:0});
  for(const c of env.colliders)world.createCollider(RAPIER.ColliderDesc.cuboid(c.hx,c.hy,c.hz).setTranslation(c.x,c.y,c.z));
  for(const c of [{x:-22.5,z:-10,hx:.5,hz:33},{x:22.5,z:-10,hx:.5,hz:33},{x:0,z:-42.5,hx:23,hz:.5},{x:0,z:20.5,hx:23,hz:.5}])world.createCollider(RAPIER.ColliderDesc.cuboid(c.hx,10,c.hz).setTranslation(c.x,10,c.z));
  body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,1,15));collider=world.createCollider(RAPIER.ColliderDesc.capsule(.65,.3),body);controller=world.createCharacterController(.025);controller.enableAutostep(.35,.25,true);controller.enableSnapToGround(.3);controller.setApplyImpulsesToDynamicBodies(true);
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;const shadowContext=shadowCanvas.getContext('2d')!;const shadowGradient=shadowContext.createRadialGradient(32,32,2,32,32,31);shadowGradient.addColorStop(0,'rgba(0,0,0,.65)');shadowGradient.addColorStop(1,'rgba(0,0,0,0)');shadowContext.fillStyle=shadowGradient;shadowContext.fillRect(0,0,64,64);const blobMaterial=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),blobGeometry=new THREE.PlaneGeometry(1.3,1.3);
  spawnPoints.forEach(([x,z],i)=>{const visual=createEnemy(scene),rb=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x,.95,z));visual.group.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=false;});const blob=new THREE.Mesh(blobGeometry,blobMaterial);blob.rotation.x=-Math.PI/2;blob.position.y=.08;visual.group.add(blob);const ec=world.createCollider(RAPIER.ColliderDesc.capsule(.6,.28),rb),ctrl=world.createCharacterController(.025);ctrl.enableSnapToGround(.3);visual.group.position.set(x,0,z);enemies.push({visual,position:new THREE.Vector3(x,0,z),health:100,timer:2+i*.3,alert:0,seed:i*2.7,body:rb,collider:ec,controller:ctrl});});
  const terminalGroup=new THREE.Group();terminalGroup.position.copy(terminal);scene.add(terminalGroup);
  const box=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.3,.7),new THREE.MeshStandardMaterial({color:0x30444b,metalness:.7,roughness:.4}));box.position.y=.65;box.castShadow=true;terminalGroup.add(box);
  terminalScreen=new THREE.Mesh(new THREE.BoxGeometry(.85,.48,.035),new THREE.MeshStandardMaterial({color:0x80d9bf,emissive:0x2be4ba,emissiveIntensity:1.3}));terminalScreen.position.set(0,1.05,.37);terminalGroup.add(terminalScreen);world.createCollider(RAPIER.ColliderDesc.cuboid(.55,.65,.35).setTranslation(terminal.x,.65,terminal.z));env.occluders.push(box);
  const ring=new THREE.RingGeometry(.35,.4,4);beacon=new THREE.Mesh(ring,new THREE.MeshBasicMaterial({color:0xedb76c,side:THREE.DoubleSide,depthTest:false}));scene.add(beacon);beacon.rotation.x=-Math.PI/2;beacon.visible=false;
  world.step();scene.updateMatrixWorld(true);await renderer.compileAsync(scene,camera);ready=true;$<HTMLButtonElement>('deploy').disabled=false;$('deploy-label').textContent='DEPLOY TO HARBOUR';$('loading').textContent='WASD to move · Mouse to aim · Headphones recommended';
  last=performance.now();requestAnimationFrame(animate);
  // Read-only diagnostics in every build; deterministic QA controls only in local development.
  const diagnostics={snapshot:()=>({mode:state.mode,health:state.health,ammo:state.ammo,reserve:state.reserve,grenades:state.grenades,kills:state.kills,stage:state.stage,upload:state.upload,time:state.time,position:camera.position.toArray(),enemyPositions:enemies.map(e=>({position:e.position.toArray(),health:e.health})),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,renderCpuMs:lastRenderMs})};
  Object.assign(window,{blackline:diagnostics});
  type ToolContext={registerTool:(tool:{name:string,description:string,inputSchema:object,annotations:object,execute:(input:unknown)=>unknown},options:{signal:AbortSignal})=>void|Promise<void>};
  const context=(document as Document&{modelContext?:ToolContext}).modelContext;
  if(context?.registerTool){const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});for(const tool of [{name:'read_mission_status',description:'Read the current Blackline mission status, ammunition, health, and objective.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>diagnostics.snapshot()},{name:'pause_operation',description:'Pause the Blackline operation and open its visible pause menu.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute:()=>{if(state.mode!=='playing')throw new Error('No operation is running.');setMenu('paused');return diagnostics.snapshot();}}]){try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(console.warn);}catch(e){console.warn(e);}}}
  if(import.meta.env.DEV)Object.assign(window,{blacklineQA:{...diagnostics,start:()=>{weapon.group.visible=true;reset();setMenu('playing');},pause:()=>setMenu('paused'),photo:()=>{setMenu('paused');$('menu').hidden=true;weapon.group.visible=false;},look:(yaw:number,pitch:number)=>{state.yaw=yaw;state.pitch=pitch;},teleport:(x:number,z:number)=>{body.setTranslation({x,y:1,z},true);body.setNextKinematicTranslation({x,y:1,z});camera.position.set(x,1.7,z);},fire,damage:(amount:number)=>hurt(amount),setEnemyHealth:(index:number,health:number)=>{enemies[index].health=health;},clear:()=>{enemies.forEach(e=>damageEnemy(e,1000,e.position.clone()));},setAmmo:(ammo:number,reserve:number)=>Object.assign(state,{ammo,reserve})}});
 }catch(error){console.error(error);$('loading').textContent=`Unable to start graphics: ${error instanceof Error?error.message:String(error)}. Try a browser with WebGL 2 hardware acceleration.`;$('deploy-label').textContent='GRAPHICS UNAVAILABLE';}
}
void boot();
