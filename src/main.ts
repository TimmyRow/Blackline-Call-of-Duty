import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildEnvironment } from './environment';
import { createWeapon, createEnemy } from './actors';
import { Sound } from './audio';
import { bulletDamage, reloadAmmo, grenadeDamage, RELOAD_SECONDS } from './rules.mjs';
import {REGION_START,REGION_SITES,ENEMY_SPAWNS,heightAt,regionName} from './region-layout.mjs';
import {createCampaign,advanceCampaign,trackedSite,regionalEffects} from './campaign.mjs';
import {createFieldMap} from './field-map';
import {createSquad} from './squad';
import './style.css';
import './region-hud.css';

const $ = <T extends HTMLElement = HTMLElement>(id:string) => document.getElementById(id) as T;
$('app').innerHTML=`<div id="viewport"></div><div id="vignette"></div><div id="damage"></div>
<div id="hud" hidden><div id="objective"><small id="objective-phase">01 / INFILTRATE</small><div id="objective-name">Clear the container yard</div><div id="objective-detail">Hostiles remaining: 6</div></div><div id="compass">W · · · N · · · E<strong id="bearing">000</strong></div><div id="telemetry">COLD HARBOUR<br><span id="fps"></span></div><div id="health-cluster"><span>VIPER 1 <span id="health-value">100</span></span><div id="health-track"><div id="health-fill"></div></div><span id="stance">STANDING</span></div><div id="ammo-cluster"><div id="weapon-name">MK18 MOD 1 &nbsp; / &nbsp; AUTO</div><div><span id="ammo">30</span> <span id="reserve">/ 180</span></div><div id="utility">G &nbsp; FRAG × <span id="grenades">3</span></div></div><div id="crosshair"></div><div id="hitmarker">×</div><div id="toast"></div><div id="prompt" hidden><span id="prompt-text"></span><div id="terminal-progress"></div></div><div id="subtitle" hidden></div></div>
<main id="menu"><header class="masthead"><div class="brand"><span class="brand-mark"></span>BLACKLINE</div><div class="classification">SPECIAL OPERATIONS DIVISION &nbsp; / &nbsp; 07</div></header><section class="menu-content" id="menu-content"><div class="eyebrow" id="eyebrow">SINGLE PLAYER · NIGHT OPERATION</div><h1 id="title">BLACKLINE</h1><h2 id="mission-title">OPERATION COLD HARBOUR</h2><p class="mission-copy" id="mission-copy">A stolen uplink. A port gone dark.<br>Infiltrate the yard, recover the signal, and get out.</p><div class="mission-meta" id="mission-meta"><div>LOCATION<span>NORTH ATLANTIC</span></div><div>LOCAL TIME<span>03:47 AM</span></div><div>CONDITIONS<span>HEAVY RAIN</span></div></div><div id="result-stats" hidden></div><button class="primary" id="deploy" disabled><span id="deploy-label">PREPARING OPERATION</span><span>↗</span></button><div id="loading">Establishing uplink…</div><div id="mobile-note">Keyboard and mouse required. Open on a desktop to deploy.</div><button class="secondary" id="controls-button">CONTROLS & SETTINGS</button></section><section id="settings" hidden><h3>FIELD SETTINGS</h3><div class="control-grid"><span><b>W A S D</b> &nbsp; Move</span><span><b>MOUSE</b> &nbsp; Look</span><span><b>LEFT CLICK</b> &nbsp; Fire</span><span><b>RIGHT CLICK</b> &nbsp; Aim</span><span><b>SHIFT</b> &nbsp; Sprint</span><span><b>SPACE</b> &nbsp; Jump</span><span><b>C / CTRL</b> &nbsp; Crouch</span><span><b>R</b> &nbsp; Reload</span><span><b>G</b> &nbsp; Grenade</span><span><b>E</b> &nbsp; Interact</span><span><b>ESC / P</b> &nbsp; Pause</span><span><b>M</b> &nbsp; Mute</span></div><label>Mouse sensitivity<input id="sensitivity" type="range" min="0.3" max="2" step="0.05" value="1"></label><label>Visual quality<select id="quality"><option value="high">High — atmospheric lighting</option><option value="low">Performance — reduced effects</option></select></label><button class="secondary" id="audio-toggle">SOUND ON</button><br><button class="secondary" id="settings-close">← RETURN TO OPERATION</button></section><footer class="bottomline"><div><span class="status-dot"></span>UPLINK <strong>ESTABLISHED</strong><br><span style="display:block;margin-top:7px">THREE.JS &nbsp; / &nbsp; TACTICAL FPS</span></div><div class="coordinate">58° 42′ 09″ N &nbsp; 07° 13′ 41″ W<br><strong>CLASSIFIED / EYES ONLY</strong></div></footer></main>`;

type Mode='menu'|'playing'|'paused'|'won'|'dead';
const state={mode:'menu' as Mode,health:100,ammo:30,reserve:180,grenades:3,kills:0,shots:0,hits:0,time:0,stage:0,upload:0,reload:0,lastShot:-10,lastDamage:-10,recoil:0,yaw:0,pitch:0,vertical:0,grounded:false};
let campaign=createCampaign(),mapOpen=false,currentRegion='South Landing',regionToastUntil=0,waterExposure=0;
let squad:ReturnType<typeof createSquad>;
$('app').insertAdjacentHTML('beforeend','<div id="field-map-root"></div>');
$('hud').insertAdjacentHTML('beforeend','<div id="squad-cluster"><span id="squad-order">SQUAD / FOLLOWING</span><span id="squad-members">VALE · ROOK</span><small>B · HOLD / FOLLOW &nbsp; TAB · FIELD MAP</small></div><div id="network-status">HOSTILE NETWORK <b id="network-strength">100%</b></div><div id="world-waypoint"><span>◇</span><small id="waypoint-label"></small></div><div id="region-arrival"><small>ASH COAST</small><strong id="region-title">SOUTH LANDING</strong></div>');
$('mission-title').textContent='ASH COAST / FRONTIER WAR';$('eyebrow').textContent='CONNECTED CAMPAIGN · SQUAD OPERATIONS';$('mission-copy').textContent='The fleet holds orbit. Your squad holds the coast. Walk between enemy facilities, cut their invasion network, and choose when to fight together or move alone.';
$('mission-meta').innerHTML='<div>THEATRE<span>ASH COAST</span></div><div>UNIT<span>VALE / ROOK / YOU</span></div><div>INSERTION<span>KESTREL DROPSHIP</span></div>';
document.querySelector('.control-grid')?.insertAdjacentHTML('beforeend','<span><b>TAB</b> &nbsp; Field map</span><span><b>B</b> &nbsp; Squad hold / follow</span>');
const fieldMap=createFieldMap($('field-map-root'),{onTrack:id=>{campaign.tracked=id;closeMap();},onClose:()=>closeMap()});
const sound=new Sound(), keys=new Set<string>();
let firing=false,aiming=false,dragging=false,sensitivity=1,ready=false,accumulator=0,total=0,stepTime=0,toastUntil=0,subtitleUntil=0,hitUntil=0,crouched=false;
const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.045,650);
// Renderer creation stays in the guarded boot path so an unavailable GPU has a readable failure state.
let renderer:THREE.WebGLRenderer,composer:EffectComposer;
let env:ReturnType<typeof buildEnvironment>,weapon:ReturnType<typeof createWeapon>;
let world:RAPIER.World,body:RAPIER.RigidBody,collider:RAPIER.Collider,controller:RAPIER.KinematicCharacterController;
const ray=new THREE.Raycaster(), v=new THREE.Vector3(), forward=new THREE.Vector3(), targetPos=new THREE.Vector3();
type Enemy={visual:ReturnType<typeof createEnemy>,position:THREE.Vector3,health:number,timer:number,alert:number,seed:number,body:RAPIER.RigidBody,collider:RAPIER.Collider,controller:RAPIER.KinematicCharacterController,lastSeen:THREE.Vector3,flashUntil:number,moving:boolean};
const enemies:Enemy[]=[];
const spawnPoints=ENEMY_SPAWNS.map(s=>[s.x,s.z]);
type Particle={mesh:THREE.Mesh,velocity:THREE.Vector3,life:number,max:number};
const particles:Particle[]=[];
const traces:{line:THREE.Line,life:number}[]=[];
const grenades:{body:RAPIER.RigidBody,mesh:THREE.Mesh,life:number}[]=[];
const particleGeometry=new THREE.SphereGeometry(.035,4,3),sparkMaterial=new THREE.MeshBasicMaterial({color:0xffc47b});
const grenadeGeometry=new THREE.SphereGeometry(.11,10,8),grenadeMaterial=new THREE.MeshStandardMaterial({color:0x445647,metalness:.7,roughness:.5});
const extraction=new THREE.Vector3(REGION_START.x,heightAt(REGION_START.x,REGION_START.z),REGION_START.z);
const terminalScreens:THREE.Mesh<THREE.BoxGeometry,THREE.MeshStandardMaterial>[]=[];
let beacon:THREE.Mesh,revivePrompt:{name:string,progress:number}|null=null;

function mapSnapshot(){return {position:{x:camera.position.x,z:camera.position.z},yaw:state.yaw,completed:campaign.completed,discovered:campaign.discovered,tracked:campaign.tracked,patrols:enemies.map(e=>({x:e.position.x,z:e.position.z,alive:e.health>0})),intel:regionalEffects(campaign).patrolIntel,allies:squad?.members.map(m=>({x:m.position.x,z:m.position.z,alive:m.health>0}))??[]};}
function openMap(){if(state.mode!=='playing')return;setMenu('paused');mapOpen=true;$('menu').hidden=true;fieldMap.open(mapSnapshot());}
function closeMap(){if(!mapOpen)return;mapOpen=false;fieldMap.close();setMenu('playing');void renderer.domElement.requestPointerLock().catch(()=>{});}

function toast(text:string,seconds=2){$('toast').textContent=text;toastUntil=total+seconds;$('toast').style.opacity='1';}
function subtitle(text:string,seconds=5){$('subtitle').innerHTML=`<b>OVERWATCH</b> &nbsp; ${text}`;$('subtitle').hidden=false;subtitleUntil=total+seconds;}
function setMenu(mode:Mode){
 if(mapOpen){mapOpen=false;fieldMap.close();}
 state.mode=mode;const playing=mode==='playing';$('menu').hidden=playing;$('hud').hidden=!playing;firing=false;aiming=false;keys.clear();dragging=false;
 $('settings').hidden=true;$('menu-content').hidden=false;
 if(!playing&&document.pointerLockElement)document.exitPointerLock();
 $('menu').classList.toggle('paused',mode!=='menu');
 if(mode==='paused'){ $('title').textContent='ON HOLD';$('eyebrow').textContent='OPERATION PAUSED';$('mission-copy').textContent='The mission is paused. Resume when you’re ready.';$('deploy-label').textContent='RESUME OPERATION';$('mission-meta').hidden=true; }
 if(mode==='won'||mode==='dead'){
  $('title').textContent=mode==='won'?'COAST SECURED':'SIGNAL LOST';$('eyebrow').textContent=mode==='won'?'REGIONAL OPERATION COMPLETE':'OPERATOR DOWN';$('mission-title').textContent=mode==='won'?'KESTREL EXTRACTION CONFIRMED':'ASH COAST / FRONTIER WAR';$('mission-copy').textContent=mode==='won'?'The invasion network is silent. Your squad has opened the coast for the fleet.':'Use cover and your squad. Order them to hold outside a camp for a solo approach.';$('deploy-label').textContent='REDEPLOY';$('mission-meta').hidden=true;$('result-stats').hidden=false;
  $('result-stats').textContent=`${campaign.completed.length} / 3 facilities disabled · ${state.kills} hostiles neutralized · ${Math.round(campaign.distanceWalked)} m on foot · ${Math.floor(state.time/60)}:${String(Math.floor(state.time%60)).padStart(2,'0')}`;
 }
}
function reset(){
 campaign=createCampaign();waterExposure=0;currentRegion='South Landing';regionToastUntil=0;
 Object.assign(state,{health:100,ammo:30,reserve:180,grenades:3,kills:0,shots:0,hits:0,time:0,stage:0,upload:0,reload:0,lastShot:-10,lastDamage:-10,recoil:0,yaw:0,pitch:0,vertical:0});
 const initialY=heightAt(REGION_START.x,REGION_START.z);crouched=false;collider.setHalfHeight(.65);body.setTranslation({x:REGION_START.x,y:initialY+1,z:REGION_START.z},true);body.setNextKinematicTranslation({x:REGION_START.x,y:initialY+1,z:REGION_START.z});
 camera.position.set(REGION_START.x,initialY+1.7,REGION_START.z);camera.rotation.set(0,0,0);accumulator=0;
 enemies.forEach((e,i)=>{e.position.set(spawnPoints[i][0],heightAt(spawnPoints[i][0],spawnPoints[i][1]),spawnPoints[i][1]);e.health=100;e.timer=1.5+i*.25;e.alert=0;e.visual.group.position.copy(e.position);e.visual.group.rotation.set(0,0,0);e.body.setTranslation({x:e.position.x,y:e.position.y+.95,z:e.position.z},true);e.body.setNextKinematicTranslation({x:e.position.x,y:e.position.y+.95,z:e.position.z});e.collider.setEnabled(true);});
 squad.reset();REGION_SITES.forEach(site=>env.setSiteComplete?.(site.id,false));
 for(const g of grenades){world.removeRigidBody(g.body);scene.remove(g.mesh);}grenades.length=0;
 for(const p of particles)scene.remove(p.mesh);particles.length=0;
 for(const t of traces){scene.remove(t.line);t.line.geometry.dispose();(t.line.material as THREE.Material).dispose();}traces.length=0;
 $('result-stats').hidden=true;$('damage').style.opacity='0';subtitle('Vale and Rook are with you. Three enemy facilities feed the invasion network. Choose your route. Tab opens your field map; B orders the squad to hold.',9);updateHud();
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
 if(mapOpen){if(e.code==='Escape'){e.preventDefault();closeMap();}return;}
 if(['Space','Tab','ControlLeft','ControlRight'].includes(e.code))e.preventDefault();
 if(e.code==='Tab'&&!e.repeat&&state.mode==='playing'){openMap();return;}
 if(e.code==='KeyM'&&!e.repeat)toggleSound();
 if((e.code==='KeyP'||e.code==='Escape')&&state.mode==='playing'){setMenu('paused');return;}
 if(state.mode!=='playing')return; keys.add(e.code);
 if(e.code==='KeyB'&&!e.repeat){const order=squad.toggle();toast(order==='hold'?'SQUAD HOLDING POSITION':'SQUAD FOLLOWING');subtitle(order==='hold'?'Vale: We’ll hold here. Call us when you need support.':'Rook: Moving with you.');}
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
function blocked(from:THREE.Vector3,to:THREE.Vector3){v.subVectors(to,from);const distance=v.length();if(distance<.15)return false;v.normalize();return world.castRay(new RAPIER.Ray(from,v),distance-.15,true,RAPIER.QueryFilterFlags.ONLY_FIXED)!==null;}
function tracer(from:THREE.Vector3,to:THREE.Vector3,color=0xffd9a0){const geometry=new THREE.BufferGeometry().setFromPoints([from,to]);const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity:.8}));scene.add(line);traces.push({line,life:.06});}
function sparks(at:THREE.Vector3,count=8){for(let i=0;i<count;i++){if(particles.length>180)break;const mesh=new THREE.Mesh(particleGeometry,sparkMaterial);mesh.position.copy(at);scene.add(mesh);const life=.15+Math.random()*.4;particles.push({mesh,velocity:new THREE.Vector3((Math.random()-.5)*6,Math.random()*4,(Math.random()-.5)*6),life,max:life});}}
function damageEnemy(e:Enemy,damage:number,at:THREE.Vector3){if(e.health<=0)return;e.health-=damage;e.alert=8;sparks(at,5);sound.hit();hitUntil=total+.13;$('hitmarker').style.opacity='1';if(e.health<=0){state.kills++;e.collider.setEnabled(false);toast('HOSTILE NEUTRALIZED',1);}}
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
 const effects=regionalEffects(campaign);
 for(const [index,e] of enemies.entries()){
  if(e.health<=0)continue;e.timer-=dt;e.alert-=dt;const eye=e.position.clone().add(new THREE.Vector3(0,1.55,0));
  const threats=[{position:camera.position,index:-1,range:32*effects.detectionScale*(crouching?.6:1)},...squad.members.flatMap((m,i)=>m.health>0?[{position:m.position.clone().add(new THREE.Vector3(0,1.5,0)),index:i,range:32*effects.detectionScale}]:[])];
  const threat=threats.sort((a,b)=>a.position.distanceTo(eye)-b.position.distanceTo(eye)).find(t=>t.position.distanceTo(eye)<t.range&&!blocked(eye,t.position));
  if(threat){e.alert=5;e.lastSeen.copy(threat.position);}
  const home=spawnPoints[index],patrol=new THREE.Vector3(home[0]+Math.sin(state.time*.22+e.seed)*3,heightAt(home[0],home[1]),home[1]+Math.cos(state.time*.22+e.seed)*3);
  const goal=e.alert>0?e.lastSeen:patrol;const dx=goal.x-e.position.x,dz=goal.z-e.position.z,distance=Math.hypot(dx,dz),len=distance||1;
  const speed=e.alert>0?(distance>12?1.55:distance<6?-.45:0):distance>1?.85:0;
  const drift=e.alert>0?Math.sin(state.time*.8+e.seed)*.35:0;
  if(speed!==0||threat)e.visual.group.rotation.y=Math.atan2(-dx,-dz);
  e.controller.computeColliderMovement(e.collider,{x:(dx/len*speed+dz/len*drift)*dt,y:-.25,z:(dz/len*speed-dx/len*drift)*dt});const m=e.controller.computedMovement(),ep=e.body.translation();e.body.setNextKinematicTranslation({x:ep.x+m.x,y:ep.y+m.y,z:ep.z+m.z});e.moving=Math.hypot(m.x,m.z)>.002;
  if(threat&&e.timer<=0){e.timer=(.85+Math.random()*.7)*effects.fireDelayScale;e.flashUntil=state.time+.12;const muzzle=eye.clone();muzzle.y-=.15;tracer(muzzle,threat.position.clone().add(new THREE.Vector3((Math.random()-.5)*1.2,-.15,0)),0xff8755);if(eye.distanceTo(camera.position)<55)sound.shot(true);if(Math.random()<(threat.index<0?(sprinting?.3:crouching?.36:.52):.7)){if(threat.index<0)hurt(5+Math.random()*4);else squad.hurt(threat.index,5+Math.random()*5);}}
 }
 squad.step(dt,state.time,camera.position,state.yaw,enemies,blocked,(target,from,to)=>{tracer(from,to,0x7dd9ff);if(from.distanceTo(camera.position)<50)sound.shot(true);damageEnemy(target as Enemy,19,to);});
 world.timestep=dt;world.step();
 const bp=body.translation();campaign.distanceWalked+=Math.hypot(bp.x-camera.position.x,bp.z-camera.position.z);const targetEye=bp.y+(crouching?.48:.7);camera.position.x=bp.x;camera.position.z=bp.z;camera.position.y=THREE.MathUtils.lerp(camera.position.y,targetEye,.25);
 if(bp.y< -1.5){waterExposure+=dt;if(waterExposure>2&&state.time-state.lastDamage>.5)hurt(12);}else waterExposure=0;
 if(camera.position.y < -10){hurt(100);}
 for(const e of enemies){const ep=e.body.translation();e.position.set(ep.x,ep.y-.95,ep.z);e.visual.group.position.copy(e.position);}
 for(let i=grenades.length-1;i>=0;i--){const g=grenades[i];g.life-=dt;const gp=g.body.translation();g.mesh.position.set(gp.x,gp.y,gp.z);g.mesh.quaternion.copy(g.body.rotation());if(g.life<=0){explode(g.mesh.position.clone());scene.remove(g.mesh);world.removeRigidBody(g.body);grenades.splice(i,1);}}
 const completed=advanceCampaign(campaign,camera.position,keys.has('KeyE'),dt);
 if(completed){const site=REGION_SITES.find(s=>s.id===completed)!;env.setSiteComplete?.(completed,true);state.reserve=Math.min(240,state.reserve+45);state.grenades=Math.min(4,state.grenades+1);toast(`${site.name.toUpperCase()} · NETWORK NODE OFFLINE`,3);subtitle(`${site.effect}. ${campaign.completed.length===3?'All facilities are down. Kestrel is ready at South Landing. You can keep exploring or return for extraction.':'Choose your next approach. The region remains open.'}`,7);}
 state.stage=campaign.completed.length;revivePrompt=squad.reviveNear(camera.position,keys.has('KeyE'),dt);
 const nextRegion=regionName(camera.position.x,camera.position.z);if(nextRegion!==currentRegion){currentRegion=nextRegion;$('region-title').textContent=currentRegion.toUpperCase();regionToastUntil=total+3;}
 if(campaign.extracted)setMenu('won');
}
function updateHud(){
 $('ammo').textContent=String(state.ammo).padStart(2,'0');$('reserve').textContent=`/ ${state.reserve}`;$('grenades').textContent=String(state.grenades);$('health-value').textContent=String(Math.ceil(state.health));$('health-fill').style.width=`${state.health}%`;$('health-cluster').classList.toggle('danger',state.health<35);
 $('stance').textContent=keys.has('KeyC')||keys.has('ControlLeft')?'CROUCHED':keys.has('ShiftLeft')?'SPRINTING':'STANDING';
 const localSite=REGION_SITES.find(s=>!campaign.completed.includes(s.id)&&Math.hypot(camera.position.x-s.x,camera.position.z-s.z)<s.radius),site=localSite??trackedSite(camera.position,campaign);
 const distance=Math.round(Math.hypot(camera.position.x-(site?.x??extraction.x),camera.position.z-(site?.z??extraction.z)));
 $('objective-phase').textContent=`ASH COAST / ${campaign.completed.length} OF 3 NODES OFFLINE`;$('objective-name').textContent=localSite?localSite.action:site?`Reach ${site.name}`:'Return to South Landing';
 $('objective-detail').textContent=localSite?'Approach freely · Hold E at the marked terminal':site?`${distance} m on foot · Tab to choose your route`:'All facilities disabled · Explore or extract';
 $('telemetry').firstChild!.textContent=currentRegion.toUpperCase();$('network-strength').textContent=`${regionalEffects(campaign).signalStrength}%`;
 $('squad-order').textContent=`SQUAD / ${squad.order==='follow'?'FOLLOWING':'HOLDING POSITION'}`;$('squad-members').textContent=squad.members.map(m=>`${m.name} ${m.health<=0?'DOWN':Math.round(m.health)}`).join('  /  ');
 $('region-arrival').style.opacity=total<regionToastUntil?'1':'0';
 const worldTarget=new THREE.Vector3(site?.x??extraction.x,(site?.elevation??extraction.y)+3,site?.z??extraction.z);camera.updateMatrixWorld();const behind=worldTarget.clone().applyMatrix4(camera.matrixWorldInverse).z>0;worldTarget.project(camera);
 const screenX=behind?.5:THREE.MathUtils.clamp((worldTarget.x+1)/2,.08,.92),screenY=behind?.76:THREE.MathUtils.clamp((1-worldTarget.y)/2,.2,.75);
 $('world-waypoint').style.left=`${screenX*100}%`;$('world-waypoint').style.top=`${screenY*100}%`;$('world-waypoint').querySelector('span')!.textContent=behind?'↶':'◇';$('waypoint-label').textContent=`${site?.name??'Kestrel Landing'} · ${distance} m`;
 $('bearing').textContent=String(Math.round(((-state.yaw*180/Math.PI)%360+360)%360)).padStart(3,'0');$('crosshair').classList.toggle('aiming',aiming);
 const near=REGION_SITES.find(s=>!campaign.completed.includes(s.id)&&Math.hypot(camera.position.x-s.x,camera.position.z-s.z)<2.8);
 let prompt='';if(waterExposure>0)prompt='DEEP WATER · RETURN TO SHORE';else if(state.reload>0)prompt='RELOADING';else if(near)prompt=`HOLD E · ${near.verb}`;else if(revivePrompt)prompt=`HOLD E · REVIVE ${revivePrompt.name}`;else if(campaign.completed.length===3&&distance<4)prompt='E · BOARD KESTREL';else if(state.ammo===0)prompt='R · RELOAD';
 state.upload=near?(campaign.progress[near.id]??0):0;$('prompt').hidden=!prompt;$('prompt-text').textContent=prompt;$('terminal-progress').style.width=`${near?state.upload/near.holdSeconds*100:(revivePrompt?.progress??0)*100}%`;
 $('damage').style.opacity=String(Math.max(state.health<30?.25:0,1-(state.time-state.lastDamage)*1.5)*.7);
}
function resize(){if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);}
window.addEventListener('resize',resize);
let last=performance.now(),frames=0,frameSum=0,lastRenderMs=0,shadowCell='';
function animate(now:number){
 requestAnimationFrame(animate);const realElapsed=(now-last)/1000,elapsed=Math.min(.05,realElapsed);last=now;total+=elapsed;frames++;frameSum+=realElapsed;
 if(frameSum>=1){$('fps').textContent=`${Math.round(frames/frameSum)} FPS`;frames=0;frameSum=0;}
 if(state.mode==='playing'){
  accumulator+=elapsed;while(accumulator>=1/60){fixedStep(1/60);accumulator-=1/60;if(state.mode!=='playing'){accumulator=0;break;}}
  camera.rotation.set(state.pitch+state.recoil*.2,state.yaw,0,'YXZ');state.recoil*=Math.exp(-elapsed*15);
  const targetFov=aiming?52:keys.has('ShiftLeft')?80:75;camera.fov=THREE.MathUtils.lerp(camera.fov,targetFov,1-Math.exp(-elapsed*12));camera.updateProjectionMatrix();updateHud();
 }else if(state.mode==='menu'){camera.position.set(REGION_START.x,heightAt(REGION_START.x,REGION_START.z)+2.1,REGION_START.z);camera.rotation.set(.035,Math.sin(total*.055)*.1,0,'YXZ');}
 const moving=state.mode==='playing'&&['KeyW','KeyA','KeyS','KeyD'].some(k=>keys.has(k))?1:0;
 weapon.update(elapsed,{time:total,moving,sprinting:keys.has('ShiftLeft')&&!aiming,aiming,reload:state.reload>0?1-state.reload/RELOAD_SECONDS:0,recoil:state.recoil});
 for(const e of enemies){e.visual.group.visible=e.position.distanceTo(camera.position)<155;if(e.visual.group.visible)e.visual.update(state.mode==='playing'?elapsed:0,{time:state.time+e.seed,moving:e.health>0&&e.moving,firing:e.health>0&&state.time<e.flashUntil,dead:e.health<=0});}
 squad.render(state.mode==='playing'?elapsed:0,state.time,camera.position);
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=elapsed;p.velocity.y-=elapsed*9;p.mesh.position.addScaledVector(p.velocity,elapsed);p.mesh.scale.setScalar(Math.max(0,p.life/p.max));if(p.life<=0){scene.remove(p.mesh);particles.splice(i,1);}}
 for(let i=traces.length-1;i>=0;i--){const t=traces[i];t.life-=elapsed;if(t.life<=0){scene.remove(t.line);t.line.geometry.dispose();(t.line.material as THREE.Material).dispose();traces.splice(i,1);}}
 env.update(elapsed,total,camera.position);beacon.position.copy(extraction);beacon.position.y+=.08;beacon.rotation.z=total*.3;beacon.visible=campaign.completed.length===3;terminalScreens.forEach((screen,i)=>{const done=campaign.completed.includes(REGION_SITES[i].id);screen.material.emissive.set(done?0x2be4ba:0xe8a548);screen.material.emissiveIntensity=done?.7:1.2+Math.sin(total*2)*.2;});
 if(total>toastUntil)$('toast').style.opacity='0';if(total>subtitleUntil)$('subtitle').hidden=true;if(total>hitUntil)$('hitmarker').style.opacity='0';
 const nextShadowCell=`${Math.floor(camera.position.x/32)},${Math.floor(camera.position.y/8)},${Math.floor(camera.position.z/32)}`;if(nextShadowCell!==shadowCell){shadowCell=nextShadowCell;renderer.shadowMap.needsUpdate=true;}
 renderer.info.reset();const renderStart=performance.now();composer.render();lastRenderMs=performance.now()-renderStart;
}
async function boot(){
 try{
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.outputColorSpace=THREE.SRGBColorSpace;$('viewport').append(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();setMenu('paused');$('loading').textContent='Graphics context interrupted. Restoring…';});renderer.domElement.addEventListener('webglcontextrestored',()=>location.reload());
  scene.add(camera);renderer.info.autoReset=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  env=buildEnvironment(scene);weapon=createWeapon(camera);weapon.group.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=false;o.receiveShadow=false;}});camera.position.set(REGION_START.x,heightAt(REGION_START.x,REGION_START.z)+1.7,REGION_START.z);
  composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.23,.5,1.2));composer.addPass(new OutputPass());
  await RAPIER.init();world=new RAPIER.World({x:0,y:-17,z:0});
  for(const c of env.colliders)world.createCollider(RAPIER.ColliderDesc.cuboid(c.hx,c.hy,c.hz).setTranslation(c.x,c.y,c.z));
  if(env.terrain)world.createCollider(RAPIER.ColliderDesc.trimesh(env.terrain.vertices,env.terrain.indices).setFriction(.9));
  body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(REGION_START.x,heightAt(REGION_START.x,REGION_START.z)+1,REGION_START.z));collider=world.createCollider(RAPIER.ColliderDesc.capsule(.65,.3),body);controller=world.createCharacterController(.025);controller.enableAutostep(.4,.25,true);controller.enableSnapToGround(.6);controller.setMaxSlopeClimbAngle(Math.PI/3);controller.setApplyImpulsesToDynamicBodies(true);
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;const shadowContext=shadowCanvas.getContext('2d')!;const shadowGradient=shadowContext.createRadialGradient(32,32,2,32,32,31);shadowGradient.addColorStop(0,'rgba(0,0,0,.65)');shadowGradient.addColorStop(1,'rgba(0,0,0,0)');shadowContext.fillStyle=shadowGradient;shadowContext.fillRect(0,0,64,64);const blobMaterial=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),blobGeometry=new THREE.PlaneGeometry(1.3,1.3);
  spawnPoints.forEach(([x,z],i)=>{const y=heightAt(x,z),visual=createEnemy(scene),rb=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x,y+.95,z));visual.group.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=false;});const blob=new THREE.Mesh(blobGeometry,blobMaterial);blob.rotation.x=-Math.PI/2;blob.position.y=.08;visual.group.add(blob);const ec=world.createCollider(RAPIER.ColliderDesc.capsule(.6,.28),rb),ctrl=world.createCharacterController(.025);ctrl.enableSnapToGround(.6);ctrl.enableAutostep(.4,.2,true);visual.group.position.set(x,y,z);enemies.push({visual,position:new THREE.Vector3(x,y,z),health:100,timer:2+i*.3,alert:0,seed:i*2.7,body:rb,collider:ec,controller:ctrl,lastSeen:new THREE.Vector3(x,y,z),flashUntil:0,moving:false});});
  squad=createSquad(scene,world);
  for(const site of REGION_SITES){const terminalGroup=new THREE.Group();terminalGroup.position.set(site.x,site.elevation,site.z);scene.add(terminalGroup);
   const box=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.3,.7),new THREE.MeshStandardMaterial({color:0x30444b,metalness:.7,roughness:.4}));box.position.y=.65;box.castShadow=true;terminalGroup.add(box);
   const screen=new THREE.Mesh(new THREE.BoxGeometry(.85,.48,.035),new THREE.MeshStandardMaterial({color:0x80d9bf,emissive:0xe8a548,emissiveIntensity:1.3}));screen.position.set(0,1.05,.37);terminalGroup.add(screen);terminalScreens.push(screen);world.createCollider(RAPIER.ColliderDesc.cuboid(.55,.65,.35).setTranslation(site.x,site.elevation+.65,site.z));env.occluders.push(box);
  }
  const ring=new THREE.RingGeometry(.35,.4,4);beacon=new THREE.Mesh(ring,new THREE.MeshBasicMaterial({color:0xedb76c,side:THREE.DoubleSide,depthTest:false}));scene.add(beacon);beacon.rotation.x=-Math.PI/2;beacon.visible=false;
  world.step();scene.updateMatrixWorld(true);await renderer.compileAsync(scene,camera);ready=true;$<HTMLButtonElement>('deploy').disabled=false;$('deploy-label').textContent='LAND ON ASH COAST';$('loading').textContent='WASD to move · Tab for field map · B for squad orders';
  last=performance.now();requestAnimationFrame(animate);
  // Read-only diagnostics in every build; deterministic QA controls only in local development.
  const diagnostics={snapshot:()=>({mode:state.mode,health:state.health,ammo:state.ammo,reserve:state.reserve,grenades:state.grenades,kills:state.kills,stage:state.stage,upload:state.upload,time:state.time,position:camera.position.toArray(),region:currentRegion,campaign:JSON.parse(JSON.stringify(campaign)),effects:regionalEffects(campaign),squad:squad.snapshot(),enemyPositions:enemies.map(e=>({position:e.position.toArray(),health:e.health})),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,renderCpuMs:lastRenderMs})};
  Object.assign(window,{blackline:diagnostics});
  type ToolContext={registerTool:(tool:{name:string,description:string,inputSchema:object,annotations:object,execute:(input:unknown)=>unknown},options:{signal:AbortSignal})=>void|Promise<void>};
  const context=(document as Document&{modelContext?:ToolContext}).modelContext;
  if(context?.registerTool){const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});for(const tool of [{name:'read_mission_status',description:'Read the current Blackline mission status, ammunition, health, and objective.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>diagnostics.snapshot()},{name:'pause_operation',description:'Pause the Blackline operation and open its visible pause menu.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute:()=>{if(state.mode!=='playing')throw new Error('No operation is running.');setMenu('paused');return diagnostics.snapshot();}}]){try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(console.warn);}catch(e){console.warn(e);}}}
  if(import.meta.env.DEV)Object.assign(window,{blacklineQA:{...diagnostics,blocked:(a:number[],b:number[])=>blocked(new THREE.Vector3().fromArray(a),new THREE.Vector3().fromArray(b)),start:()=>{weapon.group.visible=true;reset();setMenu('playing');},pause:()=>setMenu('paused'),photo:()=>{setMenu('paused');$('menu').hidden=true;weapon.group.visible=false;},look:(yaw:number,pitch:number)=>{state.yaw=yaw;state.pitch=pitch;},teleport:(x:number,z:number)=>{const y=heightAt(x,z);body.setTranslation({x,y:y+1,z},true);body.setNextKinematicTranslation({x,y:y+1,z});camera.position.set(x,y+1.7,z);},fire,damage:(amount:number)=>hurt(amount),hurtAlly:(index:number,amount:number)=>squad.hurt(index,amount),setEnemyHealth:(index:number,health:number)=>{enemies[index].health=health;},clear:()=>{enemies.forEach(e=>damageEnemy(e,1000,e.position.clone()));},setAmmo:(ammo:number,reserve:number)=>Object.assign(state,{ammo,reserve})}});
 }catch(error){console.error(error);$('loading').textContent=`Unable to start graphics: ${error instanceof Error?error.message:String(error)}. Try a browser with WebGL 2 hardware acceleration.`;$('deploy-label').textContent='GRAPHICS UNAVAILABLE';}
}
void boot();
