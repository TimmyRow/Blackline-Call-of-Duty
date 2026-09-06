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
import {REGION_START,REGION_SITES,WORLD_LANDMARKS,SEA_LEVEL,getWorldSites,getLandingPads,heightAt,regionName} from './region-layout.mjs';
import {createAdventure,stepAdventure,siteDistance,interactionLabel} from './adventure.mjs';
import {createFlight} from './flight';
import {createSpacePirates} from './space-pirates';
import {createFieldMap} from './field-map';
import {createSquad} from './squad';
import {createMarine} from './marine';
import {createEncounters} from './encounters';
import {isEncounterId} from './encounter-layout.mjs';
import {ensureProgression,readSave,writeSave,journal,acceptContract,resolveContracts,buyUpgrade,CONTRACTS} from './progression.mjs';
import {createExpeditionUI} from './expedition-ui';
import './style.css';
import './region-hud.css';

const $ = <T extends HTMLElement = HTMLElement>(id:string) => document.getElementById(id) as T;
$('app').innerHTML=`<div id="viewport"></div><div id="vignette"></div><div id="damage"></div>
<div id="hud" hidden><div id="objective"><small id="objective-phase">01 / INFILTRATE</small><div id="objective-name">Clear the container yard</div><div id="objective-detail">Hostiles remaining: 6</div></div><div id="compass">W · · · N · · · E<strong id="bearing">000</strong></div><div id="telemetry">COLD HARBOUR<br><span id="fps"></span></div><div id="health-cluster"><span>VIPER 1 <span id="health-value">100</span></span><div id="health-track"><div id="health-fill"></div></div><span id="stance">STANDING</span></div><div id="ammo-cluster"><div id="weapon-name">MK18 MOD 1 &nbsp; / &nbsp; AUTO</div><div><span id="ammo">30</span> <span id="reserve">/ 180</span></div><div id="utility">G &nbsp; FRAG × <span id="grenades">3</span></div></div><div id="crosshair"></div><div id="hitmarker">×</div><div id="toast"></div><div id="prompt" hidden><span id="prompt-text"></span><div id="terminal-progress"></div></div><div id="subtitle" hidden></div></div>
<main id="menu"><header class="masthead"><div class="brand"><span class="brand-mark"></span>BLACKLINE</div><div class="classification">SPECIAL OPERATIONS DIVISION &nbsp; / &nbsp; 07</div></header><section class="menu-content" id="menu-content"><div class="eyebrow" id="eyebrow">SINGLE PLAYER · NIGHT OPERATION</div><h1 id="title">BLACKLINE</h1><h2 id="mission-title">OPERATION COLD HARBOUR</h2><p class="mission-copy" id="mission-copy">A stolen uplink. A port gone dark.<br>Infiltrate the yard, recover the signal, and get out.</p><div class="mission-meta" id="mission-meta"><div>LOCATION<span>NORTH ATLANTIC</span></div><div>LOCAL TIME<span>03:47 AM</span></div><div>CONDITIONS<span>HEAVY RAIN</span></div></div><div id="result-stats" hidden></div><button class="primary" id="deploy" disabled><span id="deploy-label">PREPARING OPERATION</span><span>↗</span></button><div id="loading">Establishing uplink…</div><div id="mobile-note">Keyboard and mouse required. Open on a desktop to deploy.</div><button class="secondary" id="controls-button">CONTROLS & SETTINGS</button></section><section id="settings" hidden><h3>FIELD SETTINGS</h3><div class="control-grid"><span><b>W A S D</b> &nbsp; Move</span><span><b>MOUSE</b> &nbsp; Look</span><span><b>LEFT CLICK</b> &nbsp; Fire</span><span><b>RIGHT CLICK</b> &nbsp; Aim</span><span><b>SHIFT</b> &nbsp; Sprint</span><span><b>SPACE</b> &nbsp; Jump</span><span><b>C / CTRL</b> &nbsp; Crouch</span><span><b>R</b> &nbsp; Reload</span><span><b>G</b> &nbsp; Grenade</span><span><b>E</b> &nbsp; Interact</span><span><b>ESC / P</b> &nbsp; Pause</span><span><b>M</b> &nbsp; Mute</span></div><label>Mouse sensitivity<input id="sensitivity" type="range" min="0.3" max="2" step="0.05" value="1"></label><label>Visual quality<select id="quality"><option value="auto" selected>Auto — balance detail and frame rate</option><option value="high">High — atmospheric lighting</option><option value="low">Performance — reduced effects</option></select></label><button class="secondary" id="audio-toggle">SOUND ON</button><br><button class="secondary" id="settings-close">← RETURN TO OPERATION</button></section><footer class="bottomline"><div><span class="status-dot"></span>UPLINK <strong>ESTABLISHED</strong><br><span style="display:block;margin-top:7px">THREE.JS &nbsp; / &nbsp; TACTICAL FPS</span></div><div class="coordinate">ORISON / EXPEDITION 07<br><strong>CLASSIFIED / EYES ONLY</strong></div></footer></main>`;

type Mode='menu'|'playing'|'paused'|'won'|'dead';
const state={mode:'menu' as Mode,health:100,ammo:30,reserve:180,grenades:3,kills:0,shots:0,hits:0,time:0,stage:0,upload:0,reload:0,lastShot:-10,lastDamage:-10,recoil:0,yaw:0,pitch:0,vertical:0,grounded:false};
let campaign:any=createAdventure(),mapOpen=false,currentRegion='South Landing',regionToastUntil=0,waterExposure=0;
let marine:ReturnType<typeof createMarine>,encounters:ReturnType<typeof createEncounters>;let flight:ReturnType<typeof createFlight>;let spacePirates:ReturnType<typeof createSpacePirates>;

let squad:ReturnType<typeof createSquad>;
$('app').insertAdjacentHTML('beforeend','<div id="field-map-root"></div>');
$('hud').insertAdjacentHTML('beforeend','<div id="squad-cluster"><span id="squad-order">SQUAD / FOLLOWING</span><span id="squad-members">VALE · ROOK</span><small>B · HOLD / FOLLOW &nbsp; TAB · FIELD MAP</small></div><div id="network-status">HOSTILE NETWORK <b id="network-strength">100%</b></div><div id="world-waypoint"><span>◇</span><small id="waypoint-label"></small></div><div id="region-arrival"><small>ORISON FRONTIER</small><strong id="region-title">SOUTH LANDING</strong></div>');
$('mission-title').textContent='ORISON / THE OPEN FRONTIER';$('eyebrow').textContent='PLANET EXPEDITION · GROUND / OCEAN / SPACE';$('mission-copy').textContent='An uncharted world beneath a contested sky. Raid pirate settlements, hunt for relics, make a carrier your home, and pilot Kestrel to the station above the clouds.';
$('mission-meta').innerHTML='<div>THEATRE<span>ORISON</span></div><div>UNIT<span>VALE / ROOK / YOU</span></div><div>INSERTION<span>KESTREL DROPSHIP</span></div>';
document.querySelector('.control-grid')?.insertAdjacentHTML('beforeend','<span><b>TAB</b> &nbsp; Field map</span><span><b>B</b> &nbsp; Squad hold / follow</span>');
const fieldMap=createFieldMap($('field-map-root'),{onTrack:(id,site)=>{if(site)knownSites.set(id,site);campaign.tracked=id;closeMap();},onClose:()=>closeMap()});
let journalOpen=false,saveMessage='Progress saves on this browser',lastSave=0;
const parkedShipPosition=new THREE.Vector3();
const safePosition=new THREE.Vector3(REGION_START.x,heightAt(REGION_START.x,REGION_START.z)+1.7,REGION_START.z);
const expeditionUI=createExpeditionUI($('app'),{close:closeJournal,accept(id){acceptContract(campaign,id);settleContracts();refreshJournal();saveGame();},buy(id){const result=buyUpgrade(campaign,id,atBase());saveMessage=result.ok?`${result.name} installed`:result.reason||'Unable to refit';if(result.ok){flight.setUpgrades(campaign.upgrades);saveGame();}refreshJournal();},track(id){const site=knownSites.get(id)||getWorldSites(0,0,2500).find(s=>s.id===id);if(site){knownSites.set(id,site);campaign.tracked=id;}closeJournal();},save(){saveGame();refreshJournal();}});
$('hud').insertAdjacentHTML('beforeend','<div id="climate-status"></div><div id="journal-hint">I · JOURNAL / CONTRACTS / REFIT</div>');
$('deploy').insertAdjacentHTML('afterend','<button class="secondary" id="new-expedition" hidden>START NEW EXPEDITION</button>');
const sound=new Sound(), keys=new Set<string>();
let firing=false,aiming=false,dragging=false,sensitivity=1,ready=false,accumulator=0,total=0,stepTime=0,toastUntil=0,subtitleUntil=0,hitUntil=0,crouched=false;
const blastLight=new THREE.PointLight(0xff9f42,0,18,2);
const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.08,22000);
// Renderer creation stays in the guarded boot path so an unavailable GPU has a readable failure state.
let renderer:THREE.WebGLRenderer,composer:EffectComposer;
let env:ReturnType<typeof buildEnvironment>,weapon:ReturnType<typeof createWeapon>;
let world:RAPIER.World,body:RAPIER.RigidBody,collider:RAPIER.Collider,controller:RAPIER.KinematicCharacterController;
const ray=new THREE.Raycaster(), v=new THREE.Vector3(), forward=new THREE.Vector3(), targetPos=new THREE.Vector3();
type Enemy={id:string,site:string,active:boolean,home:THREE.Vector3,visual:ReturnType<typeof createEnemy>,position:THREE.Vector3,health:number,timer:number,alert:number,seed:number,body:RAPIER.RigidBody,collider:RAPIER.Collider,controller:RAPIER.KinematicCharacterController,lastSeen:THREE.Vector3,flashUntil:number,moving:boolean,scan:number,threat:{position:THREE.Vector3,index:number,range:number}|null};
const enemies:Enemy[]=[];
type Site=ReturnType<typeof getWorldSites>[number];let nearbySites:Site[]=[];const knownSites=new Map<string,Site>(),enemyHealth=new Map<string,number>();let streamAt=-1;
const guardCount=(id:string)=>enemies.filter(e=>e.active&&e.site===id&&e.health>0).length;
type Particle={mesh:THREE.Mesh,velocity:THREE.Vector3,life:number,max:number};
const particles:Particle[]=[];
const traces:{line:THREE.Line,life:number}[]=[];
const grenades:{body:RAPIER.RigidBody,mesh:THREE.Mesh,life:number}[]=[];
const particleGeometry=new THREE.SphereGeometry(.035,4,3),sparkMaterial=new THREE.MeshBasicMaterial({color:0xffc47b});
const grenadeGeometry=new THREE.SphereGeometry(.11,10,8),grenadeMaterial=new THREE.MeshStandardMaterial({color:0x445647,metalness:.7,roughness:.5});
const extraction=new THREE.Vector3(REGION_START.x,heightAt(REGION_START.x,REGION_START.z),REGION_START.z);
const terminalScreens:THREE.Mesh<THREE.BoxGeometry,THREE.MeshStandardMaterial>[]=[];
let beacon:THREE.Mesh,revivePrompt:{name:string,progress:number}|null=null;

function mapSnapshot(){return {position:{x:camera.position.x,y:camera.position.y,z:camera.position.z},yaw:state.yaw,completed:[...campaign.completed,...campaign.encountersCompleted],signals:encounters?.sites()??[],boat:marine?{x:marine.position.x,z:marine.position.z}:undefined,discovered:campaign.discovered,tracked:campaign.tracked,patrols:enemies.map(e=>({x:e.position.x,z:e.position.z,alive:e.active&&e.health>0})),intel:true,ship:flight?{x:flight.position.x,z:flight.position.z}:undefined,allies:squad?.members.map(m=>({x:m.position.x,z:m.position.z,alive:m.health>0}))??[]};}
function openMap(){if(state.mode!=='playing')return;setMenu('paused');mapOpen=true;$('menu').hidden=true;fieldMap.open(mapSnapshot());}
function closeMap(){if(!mapOpen)return;mapOpen=false;fieldMap.close();setMenu('playing');void renderer.domElement.requestPointerLock().catch(()=>{});}

function toast(text:string,seconds=2){$('toast').textContent=text;toastUntil=total+seconds;$('toast').style.opacity='1';}
function subtitle(text:string,seconds=5){$('subtitle').innerHTML=`<b>OVERWATCH</b> &nbsp; ${text}`;$('subtitle').hidden=false;subtitleUntil=total+seconds;}
function setMenu(mode:Mode){
 if(ready&&mode==='paused'&&state.mode==='playing')saveGame();
 if(journalOpen){journalOpen=false;expeditionUI.close();}
 if(mapOpen){mapOpen=false;fieldMap.close();}
 state.mode=mode;const playing=mode==='playing';$('menu').hidden=playing;$('hud').hidden=!playing;firing=false;aiming=false;keys.clear();dragging=false;
 $('settings').hidden=true;$('menu-content').hidden=false;
 if(!playing&&document.pointerLockElement)document.exitPointerLock();
 $('menu').classList.toggle('paused',mode!=='menu');
 if(mode==='paused'){ $('title').textContent='ON HOLD';$('eyebrow').textContent='OPERATION PAUSED';$('mission-copy').textContent='The mission is paused. Resume when you’re ready.';$('deploy-label').textContent='RESUME OPERATION';$('mission-meta').hidden=true; }
 if(mode==='won'||mode==='dead'){
  $('title').textContent=mode==='won'?'COAST SECURED':'SIGNAL LOST';$('eyebrow').textContent=mode==='won'?'REGIONAL OPERATION COMPLETE':'OPERATOR DOWN';$('mission-title').textContent=mode==='won'?'KESTREL EXTRACTION CONFIRMED':'ASH COAST / FRONTIER WAR';$('mission-copy').textContent=mode==='won'?'The invasion network is silent. Your squad has opened the coast for the fleet.':'Use cover and your squad. Order them to hold outside a camp for a solo approach.';$('deploy-label').textContent='REDEPLOY';$('mission-meta').hidden=true;$('result-stats').hidden=false;
  $('result-stats').textContent=`${campaign.raids} raids · ${campaign.discovered.length} discoveries · ${campaign.salvage} salvage · ${Math.round(campaign.distanceWalked)} m on foot · ${Math.floor(state.time/60)}:${String(Math.floor(state.time%60)).padStart(2,'0')}`;
 }
}
function reset(){
 for(const id of campaign.completed)env.setSiteComplete(id,false);campaign=ensureProgression(createAdventure());encounters.reset();marine.reset();enemyHealth.clear();for(const e of enemies){e.active=false;e.collider.setEnabled(false);e.visual.group.visible=false;}streamAt=-1;spacePirates.reset();flight.setUpgrades(campaign.upgrades);flight.reset();parkedShipPosition.copy(flight.position);waterExposure=0;currentRegion='South Landing';regionToastUntil=0;
 Object.assign(state,{health:100,ammo:30,reserve:180,grenades:3,kills:0,shots:0,hits:0,time:0,stage:0,upload:0,reload:0,lastShot:-10,lastDamage:-10,recoil:0,yaw:0,pitch:0,vertical:0});
 const initialY=heightAt(REGION_START.x,REGION_START.z);crouched=false;collider.setHalfHeight(.65);body.setTranslation({x:REGION_START.x,y:initialY+1,z:REGION_START.z},true);body.setNextKinematicTranslation({x:REGION_START.x,y:initialY+1,z:REGION_START.z});
 camera.position.set(REGION_START.x,initialY+1.7,REGION_START.z);camera.rotation.set(0,0,0);safePosition.copy(camera.position);accumulator=0;lastSave=0;
 collider.setEnabled(true);flight.group.visible=true;squad.reset();syncEnemies();
 for(const g of grenades){world.removeRigidBody(g.body);scene.remove(g.mesh);}grenades.length=0;
 for(const p of particles)scene.remove(p.mesh);particles.length=0;
 for(const t of traces){scene.remove(t.line);t.line.geometry.dispose();(t.line.material as THREE.Material).dispose();}traces.length=0;
 $('result-stats').hidden=true;$('damage').style.opacity='0';subtitle('Vale: Your call, commander. Raid the camp ahead or take Kestrel to the sea. F boards the ship. Tab opens the planet atlas.',8);updateHud();
}
async function deploy(){
 if(!ready)return;
 sound.start(); if(state.mode!=='paused'){const saved=loadGame();if(!saved)reset();}setMenu('playing');
 try{await renderer.domElement.requestPointerLock();}catch{toast('POINTER CAPTURE UNAVAILABLE · HOLD LEFT MOUSE TO LOOK',5);}
}
$('deploy').addEventListener('click',()=>void deploy());
$('new-expedition').onclick=()=>{if(!ready)return;reset();setMenu('playing');saveGame();void renderer.domElement.requestPointerLock().catch(()=>{});};
$('controls-button').onclick=()=>{$('settings').hidden=false;$('menu-content').hidden=true;};
$('settings-close').onclick=()=>{$('settings').hidden=true;$('menu-content').hidden=false;};
$<HTMLInputElement>('sensitivity').oninput=e=>{sensitivity=+(e.target as HTMLInputElement).value;};
function toggleSound(){sound.toggle();$('audio-toggle').textContent=sound.muted?'SOUND OFF':'SOUND ON';}
$('audio-toggle').onclick=toggleSound;
$<HTMLSelectElement>('quality').onchange=()=>{if(!renderer)return;const high=$<HTMLSelectElement>('quality').value!=='low';resolutionScale=1;slowSeconds=0;renderer.setPixelRatio(Math.min(devicePixelRatio,high?1.5:1));renderer.shadowMap.enabled=high;composer.passes[1].enabled=high;resize();};
window.addEventListener('keydown',e=>{
 if(journalOpen){if(e.code==='Escape'||e.code==='KeyI'){e.preventDefault();closeJournal();}return;}
 if(mapOpen){if(e.code==='Escape'){e.preventDefault();closeMap();}return;}
 if(['Space','Tab','ControlLeft','ControlRight'].includes(e.code))e.preventDefault();
 if(e.code==='Tab'&&!e.repeat&&state.mode==='playing'){openMap();return;}
 if(e.code==='KeyM'&&!e.repeat)toggleSound();
 if((e.code==='KeyP'||e.code==='Escape')&&state.mode==='playing'){setMenu('paused');return;}
 if(state.mode!=='playing')return; keys.add(e.code);
 if(e.code==='KeyI'&&!e.repeat){openJournal();return;}
 if(e.code==='KeyF'&&!e.repeat){toggleFlight();return;}
 if(e.code==='KeyQ'&&!e.repeat&&!flight.piloting&&!marine.piloting){focusTarget();return;}
 if(e.code==='KeyJ'&&!e.repeat&&!flight.piloting&&!marine.piloting){if(squad.supply(camera.position)){state.reserve=Math.min(360,state.reserve+90);state.grenades=Math.min(5,state.grenades+1);toast('ROOK · AMMUNITION DELIVERED');}else toast('SUPPLY UNAVAILABLE · REGROUP WITH SQUAD');return;}
 if(flight.piloting)return;if(marine.piloting){if(!e.repeat&&e.code==='KeyR')reload();return;}
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

function reload(){if(state.reload>0||state.ammo===30||state.reserve===0)return;state.reload=reloadDuration();sound.reload();toast('RELOADING',1.85);}
function isWorldCover(c:RAPIER.Collider){const rb=c.parent();return !rb||rb.isFixed()||!!(rb.userData as {worldCover?:boolean}|undefined)?.worldCover;}
function blocked(from:THREE.Vector3,to:THREE.Vector3){v.subVectors(to,from);const distance=v.length();if(distance<.15)return false;v.normalize();return world.castRay(new RAPIER.Ray(from,v),distance-.15,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,undefined,isWorldCover)!==null;}
function tracer(from:THREE.Vector3,to:THREE.Vector3,color=0xffd9a0){const geometry=new THREE.BufferGeometry().setFromPoints([from,to]);const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity:.8}));scene.add(line);traces.push({line,life:.06});}
function sparks(at:THREE.Vector3,count=8){for(let i=0;i<count;i++){if(particles.length>180)break;const mesh=new THREE.Mesh(particleGeometry,sparkMaterial);mesh.position.copy(at);scene.add(mesh);const life=.15+Math.random()*.4;particles.push({mesh,velocity:new THREE.Vector3((Math.random()-.5)*6,Math.random()*4,(Math.random()-.5)*6),life,max:life});}}
function damageEnemy(e:Enemy,damage:number,at:THREE.Vector3,source?:string){if(!e.active||e.health<=0||damage<=0)return;e.visual.hit();e.health-=damage;enemyHealth.set(e.id,e.health);e.alert=8;sparks(at,5);if(!source){sound.hit();hitUntil=total+.13;$('hitmarker').style.opacity='1';}if(e.health<=0){state.kills++;e.collider.setEnabled(false);if(source){squad.registerKill(source);toast(`${source} · PIRATE DOWN`,1);}else toast('PIRATE NEUTRALIZED',1);}}
function fire(){
 if(state.reload>0||state.time-state.lastShot<.1)return;
 if(state.ammo===0){reload();return;}state.lastShot=state.time;state.ammo--;state.shots++;state.recoil=Math.min(.09,state.recoil+.026*(1-.12*(campaign.upgrades?.handling||0)));state.pitch=Math.min(1.4,state.pitch+(aiming?.0025:.006));weapon.flash();sound.shot();
 scene.updateMatrixWorld(true);ray.setFromCamera(new THREE.Vector2((Math.random()-.5)*(aiming?.0008:.008),(Math.random()-.5)*(aiming?.0008:.008)),camera);ray.far=120;
 const physical=world.castRay(new RAPIER.Ray(ray.ray.origin,ray.ray.direction),120,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,undefined,isWorldCover);ray.far=physical?.timeOfImpact??120;
 const targets=enemies.filter(e=>e.active&&e.health>0).flatMap(e=>e.visual.hitMeshes);const hits=ray.intersectObjects([...env.occluders,...targets],false);
 const hit=hits[0],boatHit=marine.hit(ray.ray.origin,ray.ray.direction,hit?.distance??physical?.timeOfImpact??120,32),end=boatHit?boatHit.position:hit?hit.point.clone():ray.ray.at(physical?.timeOfImpact??100,new THREE.Vector3());const muzzle=weapon.muzzle.getWorldPosition(new THREE.Vector3());tracer(muzzle,end);
 if(boatHit){hitUntil=total+.13;$('hitmarker').style.opacity='1';sparks(end,8);if(boatHit.killed)awardOceanKill();}else if(hit){const enemy=enemies.find(e=>e.visual.hitMeshes.includes(hit.object));if(enemy){state.hits++;damageEnemy(enemy,bulletDamage(!!hit.object.userData.head,hit.distance),hit.point);}else sparks(hit.point);}else if(physical)sparks(end);
 enemies.forEach(e=>{if(e.position.distanceTo(camera.position)<28)e.alert=6;});
}
function hurt(amount:number){state.health=Math.max(0,state.health-amount*(1-.12*(campaign.upgrades?.armor||0)));state.lastDamage=state.time;sound.noise(.2,.3,500);if(state.health===0)setMenu('dead');}
function throwGrenade(){
 if(!state.grenades)return;state.grenades--;camera.getWorldDirection(forward);const pos=camera.position.clone().addScaledVector(forward,.7);
 const rb=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x,pos.y,pos.z).setCcdEnabled(true));
 world.createCollider(RAPIER.ColliderDesc.ball(.11).setRestitution(.35).setFriction(.8).setDensity(4),rb);rb.setLinvel({x:forward.x*13,y:forward.y*13+4,z:forward.z*13},true);
 const mesh=new THREE.Mesh(grenadeGeometry,grenadeMaterial);mesh.position.copy(pos);scene.add(mesh);grenades.push({body:rb,mesh,life:2.4});sound.reload();
}
function explode(position:THREE.Vector3){
 sound.explosion();sparks(position,65);blastLight.position.copy(position);blastLight.intensity=80;
 const flash=new THREE.Mesh(new THREE.SphereGeometry(.6,12,8),new THREE.MeshBasicMaterial({color:0xffb34e,transparent:true,opacity:.8}));flash.position.copy(position);scene.add(flash);
 window.setTimeout(()=>{scene.remove(flash);flash.geometry.dispose();(flash.material as THREE.Material).dispose();},160);
 enemies.forEach(e=>{targetPos.copy(e.position).y+=1;const d=targetPos.distanceTo(position);if(e.health>0&&d<7&&!blocked(position,targetPos))damageEnemy(e,grenadeDamage(d),targetPos.clone());});
 const distance=position.distanceTo(camera.position);if(distance<6&&!blocked(position,camera.position))hurt(grenadeDamage(distance)*.5);
}
function syncEnemies(){
 env.sync(camera.position);encounters.sync(camera.position);nearbySites=[...getWorldSites(camera.position.x,camera.position.z,1200),...encounters.sites()] as Site[];for(const site of nearbySites){knownSites.set(site.id,site);if(isEncounterId(site.id)&&!campaign.discovered.includes(site.id)&&siteDistance(camera.position,site)<125){campaign.discovered.push(site.id);journal(campaign,site.name,site.description,state.time);toast(`SIGNAL DETECTED · ${site.name.toUpperCase()}`,3);}}
 for(const landmark of WORLD_LANDMARKS){const id='landmark:'+landmark.id;if(!campaign.discovered.includes(id)&&Math.hypot(camera.position.x-landmark.x,camera.position.z-landmark.z)<90){campaign.discovered.push(id);campaign.salvage+=25;journal(campaign,landmark.name,landmark.description+' · Survey reward: 25 salvage',state.time);toast(`SURVEYED · ${landmark.name.toUpperCase()} · +25 SALVAGE`,4);}}
 if(knownSites.size>8000)for(const id of [...knownSites.keys()].slice(0,1000))if(id!==campaign.tracked)knownSites.delete(id);if(enemyHealth.size>2000)for(const id of [...enemyHealth.keys()].slice(0,400))enemyHealth.delete(id);
 const desired:{id:string,site:string,x:number,y:number,z:number}[]=[];
 for(const site of nearbySites){if(site.faction!=='pirate'||(campaign.completed.includes(site.id)||campaign.encountersCompleted?.includes(site.id))||Math.abs(site.elevation-camera.position.y)>230||Math.hypot(site.x-camera.position.x,site.z-camera.position.z)>650)continue;
  const count=(site as any).guardCount??(site.kind==='pirate-ship'?8:6);for(let i=0;i<count;i++){const angle=i/count*Math.PI*2,r=isEncounterId(site.id)?6+(i%2)*3:12+(i%2)*7,x=site.x+Math.cos(angle)*r,z=site.z+Math.sin(angle)*r;desired.push({id:`${site.id}:${i}`,site:site.id,x,y:site.elevation+.2,z});}
 }
 const ids=new Set(desired.map(d=>d.id));for(const e of enemies)if(!ids.has(e.id)){e.active=false;e.collider.setEnabled(false);e.visual.group.visible=false;}
 for(const d of desired.slice(0,48)){let e=enemies.find(e=>e.id===d.id);if(e?.active){if(isEncounterId(d.site)){e.home.set(d.x,d.y,d.z);}continue;}e??=enemies.find(e=>!e.active);
  if(!e){const visual=createEnemy(scene),rb=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()),ec=world.createCollider(RAPIER.ColliderDesc.capsule(.6,.28),rb),ctrl=world.createCharacterController(.025);ctrl.enableSnapToGround(.65);ctrl.enableAutostep(.45,.2,true);e={id:'',site:'',active:false,home:new THREE.Vector3(),visual,position:new THREE.Vector3(),health:100,timer:2,alert:0,seed:enemies.length*2.7,body:rb,collider:ec,controller:ctrl,lastSeen:new THREE.Vector3(),flashUntil:0,moving:false,scan:0,threat:null};visual.group.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=false;});enemies.push(e);}
  Object.assign(e,{id:d.id,site:d.site,active:true,health:enemyHealth.get(d.id)??100,timer:1.8,alert:0,scan:0,threat:null});e.position.set(d.x,d.y,d.z);e.home.copy(e.position);e.lastSeen.copy(e.position);e.body.setTranslation({x:d.x,y:d.y+.95,z:d.z},true);e.body.setNextKinematicTranslation({x:d.x,y:d.y+.95,z:d.z});e.collider.setEnabled(e.health>0);e.visual.group.position.copy(e.position);e.visual.group.visible=true;
 }
}
function toggleFlight(){
 if(marine.piloting){const exit=marine.tryExit();if(!exit){toast('STOP THE BOAT BEFORE LEAVING THE HELM');return;}placePlayer(exit);squad.disembark(exit,state.yaw);toast('LAUNCH STOPPED · SQUAD ON DECK');return;}
 if(!flight.piloting&&marine.board(camera.position)){squad.embark();collider.setEnabled(false);toast('W/S THROTTLE · A/D RUDDER · F EXIT WHEN STOPPED',5);return;}
 if(flight.piloting){const exit=flight.tryExit();if(!exit){toast('LAND FIRST · SLOW DOWN AND DESCEND ON SOLID GROUND',3);return;}body.setTranslation({x:exit.x,y:exit.y-.7,z:exit.z},true);body.setNextKinematicTranslation({x:exit.x,y:exit.y-.7,z:exit.z});collider.setEnabled(true);camera.position.copy(exit);state.vertical=0;state.pitch=0;squad.disembark(exit,state.yaw);syncEnemies();toast('KESTREL LANDED · SQUAD DISEMBARKING');}
 else if(flight.board(camera.position)){squad.embark();collider.setEnabled(false);const pose=flight.cameraPose();state.yaw=pose.yaw;state.pitch=pose.pitch;toast('WASD THRUST · SPACE UP · CTRL DOWN · SHIFT BOOST',6);subtitle('Rook: Squad aboard. Set your heading. The carrier is a safe place to refuel and regroup.',5);}
 else toast(flight.nearbyPrompt(camera.position)??'F · BOARD KESTREL FROM BESIDE ITS HULL');
 firing=false;aiming=false;
}
function focusTarget(){camera.getWorldDirection(forward);const target=enemies.filter(e=>e.active&&e.health>0&&e.position.distanceTo(camera.position)<100).map(e=>({e,score:e.position.clone().add(new THREE.Vector3(0,1.3,0)).sub(camera.position).normalize().dot(forward)})).sort((a,b)=>b.score-a.score)[0];if(target&&target.score>.85&&squad.attack(target.e))subtitle('Vale: Target marked. Concentrating fire!',3);else toast('Q · AIM TOWARD A NEARBY PIRATE TO FOCUS SQUAD');}
function fireCannons(){const shot=flight.fire();if(!shot)return;sound.shot();const obstruction=world.castRay(new RAPIER.Ray(shot.origin,shot.direction),900,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,undefined,isWorldCover);const air=spacePirates.hit(shot.origin,shot.direction,obstruction?.timeOfImpact??900,shot.damage);let end=shot.origin.clone().addScaledVector(shot.direction,900);if(air){end=air.position;sparks(end,12);if(air.killed){campaign.airKills++;campaign.salvage+=80;toast('PIRATE INTERCEPTOR DESTROYED · +80 SALVAGE');}}
 else{const boat=marine.hit(shot.origin,shot.direction,obstruction?.timeOfImpact??900,shot.damage);if(boat){end=boat.position;sparks(end,12);if(boat.killed)awardOceanKill();}const hit=obstruction;if(hit&&!boat){end=shot.origin.clone().addScaledVector(shot.direction,hit.timeOfImpact);sparks(end,12);}for(const e of enemies){if(!e.active||e.health<=0)continue;const delta=e.position.clone().add(new THREE.Vector3(0,1,0)).sub(shot.origin),along=delta.dot(shot.direction);if(along>0&&along<shot.origin.distanceTo(end)+3&&delta.addScaledVector(shot.direction,-along).length()<3)damageEnemy(e,shot.damage,e.position.clone().add(new THREE.Vector3(0,1,0)));}}
 tracer(shot.origin,end,0x91e5ff);
}
function fixedStep(dt:number){
 state.time+=dt;encounters.update(dt,state.time,camera.position);if(state.time>streamAt){streamAt=state.time+.6;env.sync(flight.piloting?flight.position:camera.position);syncEnemies();}
 const flying=flight.piloting,boating=marine.piloting;let crouching=false,sprinting=false;
 if(!flying&&flight.landed)parkedShipPosition.copy(flight.position);
 if(flying){const before=flight.position.clone();flight.step(dt,{keys,yaw:state.yaw,pitch:state.pitch});camera.position.copy(flight.cameraPose().position);campaign.distanceFlown+=before.distanceTo(flight.position);if(firing)fireCannons();if(flight.health<=0){hurt(100);return;}}
 else if(boating){marine.step(dt,{keys,yaw:state.yaw,pitch:state.pitch});camera.position.copy(marine.cameraPose().position);advanceReload(dt);if(firing)fire();if(marine.health<=0){hurt(1000);return;}}
 else{
  let p=body.translation();const wantsCrouch=keys.has('KeyC')||keys.has('ControlLeft');
  if(wantsCrouch&&!crouched){collider.setHalfHeight(.35);body.setTranslation({x:p.x,y:p.y-.3,z:p.z},true);crouched=true;p=body.translation();}
  else if(!wantsCrouch&&crouched){let occupied=false;world.intersectionsWithShape({x:p.x,y:p.y+.3,z:p.z},{x:0,y:0,z:0,w:1},new RAPIER.Capsule(.64,.29),()=>{occupied=true;return false;},undefined,undefined,collider,body);if(!occupied){collider.setHalfHeight(.65);body.setTranslation({x:p.x,y:p.y+.3,z:p.z},true);crouched=false;p=body.translation();}}
  crouching=crouched;sprinting=(keys.has('ShiftLeft')||keys.has('ShiftRight'))&&!aiming&&!crouching;
  let x=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),z=(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0);const magnitude=Math.hypot(x,z)||1;x/=magnitude;z/=magnitude;const swimming=p.y<SEA_LEVEL+.4,speed=swimming?3.5:crouching?2.3:sprinting?8:4.6,cs=Math.cos(state.yaw),sn=Math.sin(state.yaw);state.vertical=swimming?Math.max(0,(SEA_LEVEL+.7-p.y)*4):Math.max(-35,state.vertical-17*dt);
  controller.computeColliderMovement(collider,{x:(x*cs+z*sn)*speed*dt,y:state.vertical*dt,z:(z*cs-x*sn)*speed*dt});const movement=controller.computedMovement();state.grounded=controller.computedGrounded();if(state.grounded&&state.vertical<0)state.vertical=0;body.setNextKinematicTranslation({x:p.x+movement.x,y:p.y+movement.y,z:p.z+movement.z});waterExposure=swimming?1:0;
  if(Math.hypot(movement.x,movement.z)>.001&&state.grounded){stepTime+=dt;if(stepTime>(sprinting?.3:.46)){sound.step();stepTime=0;}}
  advanceReload(dt);
  if(firing&&!sprinting)fire();if(state.time-state.lastDamage>4.5)state.health=Math.min(100,state.health+dt*10);
 }
 for(const e of enemies){
  if(!e.active||e.health<=0||e.position.distanceToSquared(camera.position)>260*260)continue;e.timer-=dt;e.alert-=dt;const eye=e.position.clone().add(new THREE.Vector3(0,1.55,0));
  e.scan-=dt;if(e.scan<=0){e.scan=.18;const threats=[...(!flying?[{position:camera.position,index:-1,range:60*(crouching?.65:1)}]:[]),...(!squad.embarked?squad.members.flatMap((m,i)=>m.health>0?[{position:m.position.clone().add(new THREE.Vector3(0,1.5,0)),index:i,range:65}]:[]):[])];
  e.threat=threats.sort((a,b)=>a.position.distanceTo(eye)-b.position.distanceTo(eye)).find(t=>t.position.distanceTo(eye)<t.range&&!blocked(eye,t.position))??null;}const threat=e.threat;if(threat){e.alert=6;e.lastSeen.copy(threat.position);}
  const patrol=e.home.clone().add(new THREE.Vector3(Math.sin(state.time*.22+e.seed)*4,0,Math.cos(state.time*.22+e.seed)*4)),goal=e.alert>0?e.lastSeen:patrol,dx=goal.x-e.position.x,dz=goal.z-e.position.z,distance=Math.hypot(dx,dz),len=distance||1,speed=e.alert>0?(e.health<35&&distance>12?0:distance>18?2.6:distance<8?-.5:0):distance>1?1.1:0,drift=e.alert>0?Math.sin(state.time*.8+e.seed)*(Math.floor(e.seed)%3===1&&distance>15?2.2:.5):0;
  if(speed!==0||threat)e.visual.group.rotation.y=Math.atan2(-dx,-dz);e.controller.computeColliderMovement(e.collider,{x:(dx/len*speed+dz/len*drift)*dt,y:-.25,z:(dz/len*speed-dx/len*drift)*dt});const m=e.controller.computedMovement(),ep=e.body.translation();e.body.setNextKinematicTranslation({x:ep.x+m.x,y:ep.y+m.y,z:ep.z+m.z});e.moving=Math.hypot(m.x,m.z)>.002;
  if(threat&&e.timer<=0){e.timer=1.2+Math.random()*1.2;e.flashUntil=state.time+.12;tracer(eye,threat.position.clone().add(new THREE.Vector3((Math.random()-.5)*1.8,-.15,0)),0xff8755);if(eye.distanceTo(camera.position)<70)sound.shotAt(eye);if(Math.random()<(threat.index<0?(sprinting?.2:crouching?.25:.4):.55)){if(threat.index<0)hurt(4+Math.random()*3);else squad.hurt(threat.index,4+Math.random()*4);}}
 }
 squad.step(dt,state.time,camera.position,state.yaw,enemies.filter(e=>e.active),blocked,(target,from,to,info)=>{tracer(from,to,0x7dd9ff);if(from.distanceTo(camera.position)<70)sound.shotAt(from);damageEnemy(target as Enemy,info?.damage??24,to,info?.name??'SQUAD');},message=>subtitle(message,3));
 encounters.battle(dt,state.time,camera.position,enemies,(a,b,faction)=>{tracer(a,b,faction==='friendly'?0x7dd9ff:0xff7850);sound.shotAt(a);},(enemy,damage,at)=>damageEnemy(enemy as Enemy,damage,at,'RECON'));
 marine.stepPatrol(dt,camera.position,boating,(a,b)=>tracer(a,b,0xff7650),n=>marine.hurt(n));
 spacePirates.step(dt,camera.position,flying,(a,b)=>tracer(a,b,0xff785a),n=>flight.hurt(n));
 world.timestep=dt;world.step();
 if(!flying&&!boating){const bp=body.translation();campaign.distanceWalked+=Math.hypot(bp.x-camera.position.x,bp.z-camera.position.z);camera.position.x=bp.x;camera.position.z=bp.z;camera.position.y=THREE.MathUtils.lerp(camera.position.y,bp.y+(crouching?.48:.7),.35);if(camera.position.y< -150)hurt(100);}
 for(const e of enemies){if(!e.active)continue;const ep=e.body.translation();e.position.set(ep.x,ep.y-.95,ep.z);e.visual.group.position.copy(e.position);}
 for(let i=grenades.length-1;i>=0;i--){const g=grenades[i];g.life-=dt;const gp=g.body.translation();g.mesh.position.set(gp.x,gp.y,gp.z);g.mesh.quaternion.copy(g.body.rotation());if(g.life<=0){explode(g.mesh.position.clone());scene.remove(g.mesh);world.removeRigidBody(g.body);grenades.splice(i,1);}}
 if(!flying&&!boating){const signal=encounters.interact(camera.position,keys.has('KeyE'),dt,guardCount);if(signal){campaign.salvage+=signal.amount;campaign.encountersCompleted.push(signal.id);if(signal.site.kind==='relic'&&!campaign.blueprints.includes('cannon')){campaign.blueprints.push('cannon');journal(campaign,'Recovered pulse lattice','Rare blueprint: cannon refits now cost 25% less.',state.time);subtitle('Rook: That lattice is intact. We can build better cannons for less salvage now.',5);}journal(campaign,signal.site.name,signal.site.description,state.time);toast(signal.message,4);saveGame();}
 const event=stepAdventure(campaign,nearbySites.filter(s=>!isEncounterId(s.id)),camera.position,keys.has('KeyE')&&!encounters.prompt(camera.position,guardCount),dt,guardCount,state.time);if(event){if(event.type==='discover'){toast(`DISCOVERED · ${event.site.name.toUpperCase()}`,3);journal(campaign,event.site.name,event.site.description,state.time);}else if(event.type==='resupply'){state.health=100;state.reserve=300;state.grenades=4;flight.repair();marine.repair();for(const m of squad.members)if(m.health>0)m.health=100;toast('SQUAD RESUPPLIED · KESTREL REPAIRED');}else{env.setSiteComplete(event.site.id,true);state.reserve=Math.min(360,state.reserve+60);toast(`${event.site.name.toUpperCase()} · CARGO RECOVERED`,3);subtitle('Rook: Cargo secured. There are more signals beyond this coast. Your call where we go next.',5);}}if(event)saveGame();revivePrompt=squad.reviveNear(camera.position,keys.has('KeyE'),dt);}
 settleContracts();if(state.time-lastSave>20)saveGame();
 if(!flying&&!boating&&state.grounded&&(heightAt(camera.position.x,camera.position.z)>0||nearbySites.some(s=>!isEncounterId(s.id)&&Math.hypot(s.x-camera.position.x,s.z-camera.position.z)<s.radius&&Math.abs(camera.position.y-s.elevation-1.7)<2)))safePosition.copy(camera.position);
 state.stage=campaign.completed.length;const nextRegion=flying&&camera.position.y>1400?'Orison High Orbit':regionName(camera.position.x,camera.position.z);if(nextRegion!==currentRegion){currentRegion=nextRegion;$('region-title').textContent=currentRegion.toUpperCase();regionToastUntil=total+3;}
}
function updateHud(){
 const fs=flight.snapshot(),flying=flight.piloting,boating=marine.piloting;$('ammo').textContent=String(Math.round(flying?fs.energy:state.ammo)).padStart(2,'0');$('reserve').textContent=flying?'% ENERGY':`/ ${state.reserve}`;$('grenades').textContent=String(state.grenades);$('health-value').textContent=String(Math.ceil(flying?flight.health:state.health));$('health-fill').style.width=`${flying?flight.health/fs.maxHealth*100:state.health}%`;$('health-cluster').classList.toggle('danger',state.health<35);$('weapon-name').textContent=flying?'KESTREL / PULSE CANNONS':'MK18 MOD 1 / AUTO';$('stance').textContent=boating?`${marine.snapshot().speed} M/S · WAYFARER LAUNCH`:flying?`${Math.round(fs.speed)} M/S · ${Math.round(camera.position.y)} M ALT`:waterExposure?'SWIMMING':crouched?'CROUCHED':keys.has('ShiftLeft')?'SPRINTING':'STANDING';
 const localSite=nearbySites.find(s=>siteDistance(camera.position,s)<s.radius),tracked=campaign.tracked?knownSites.get(campaign.tracked):null,site=tracked??null;
 $('objective-phase').textContent=`ORISON / ${campaign.discovered.length} DISCOVERED · ${campaign.raids} RAIDS`;$('objective-name').textContent=localSite?localSite.name:flying?'The horizon is yours':'Explore the open frontier';$('objective-detail').textContent=localSite?(localSite.faction==='pirate'?`${guardCount(localSite.id)} pirates here · Q focuses squad fire`:localSite.description):flying?'Space / Ctrl · Altitude   Shift · Boost   Tab · Atlas':'Raid camps · Discover relics · F boards Kestrel';$('telemetry').firstChild!.textContent=currentRegion.toUpperCase();$('network-strength').textContent=String(campaign.salvage);
 const ss=squad.snapshot();const climate=env.climate();$('climate-status').textContent=`${String(Math.floor(climate.hour)).padStart(2,'0')}:${String(Math.floor(climate.hour%1*60)).padStart(2,'0')} · ${climate.weather.toUpperCase()}`;
 $('squad-order').textContent=`SQUAD / ${squad.embarked?(boating?'ABOARD LAUNCH':'ABOARD KESTREL'):squad.order.toUpperCase()}`;$('squad-members').textContent=ss.members.map(m=>`${m.name} ${m.down?'DOWN':m.status} · ${m.kills} K`).join(' / ');$('region-arrival').style.opacity=total<regionToastUntil?'1':'0';
 $('world-waypoint').hidden=!site;if(site){const worldTarget=new THREE.Vector3(site.x,site.elevation+3,site.z);camera.updateMatrixWorld();const behind=worldTarget.clone().applyMatrix4(camera.matrixWorldInverse).z>0;worldTarget.project(camera);$('world-waypoint').style.left=`${(behind?.5:THREE.MathUtils.clamp((worldTarget.x+1)/2,.08,.92))*100}%`;$('world-waypoint').style.top=`${(behind?.76:THREE.MathUtils.clamp((1-worldTarget.y)/2,.2,.75))*100}%`;$('world-waypoint').querySelector('span')!.textContent=behind?'↶':'◇';const d=siteDistance(camera.position,site);$('waypoint-label').textContent=`${site.name} · ${d>1000?(d/1000).toFixed(1)+' km':Math.round(d)+' m'}${site.kind==='station'?' · ↑ 1800m':''}`;}
 $('bearing').textContent=String(Math.round(((-state.yaw*180/Math.PI)%360+360)%360)).padStart(3,'0');$('crosshair').classList.toggle('aiming',aiming&&!flying);
 const near=nearbySites.find(s=>siteDistance(camera.position,s)<6);const encounterPrompt=encounters.prompt(camera.position,guardCount);let prompt='';if(boating)prompt='W/S THROTTLE · A/D RUDDER · STOP THEN F TO LEAVE HELM';else if(flying)prompt=flight.landed?'F · DISEMBARK / SPACE · TAKE OFF':'SPACE ↑   CTRL ↓   SHIFT BOOST · LAND SLOWLY TO EXIT';else if(revivePrompt)prompt=`HOLD E · REVIVE ${revivePrompt.name}`;else if(encounterPrompt)prompt=encounterPrompt.text;else if(near)prompt=interactionLabel(campaign,near,guardCount(near.id),state.time);else prompt=marine.nearbyPrompt(camera.position)??flight.nearbyPrompt(camera.position)??(state.reload>0?'RELOADING':state.ammo===0?'R · RELOAD':'');
 state.upload=near?(campaign.progress[near.id]??0):0;$('prompt').hidden=!prompt;$('prompt-text').textContent=prompt;$('terminal-progress').style.width=`${encounterPrompt?encounterPrompt.progress*100:near?state.upload/(near.faction==='friendly'?1.2:2.5)*100:(revivePrompt?.progress??0)*100}%`;$('damage').style.opacity=String(Math.max(state.health<30?.25:0,1-(state.time-state.lastDamage)*1.5)*.7);
}
function resize(){if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(innerWidth,innerHeight);}
window.addEventListener('resize',resize);
let resolutionScale=1,slowSeconds=0;
let last=performance.now(),frames=0,frameSum=0,lastRenderMs=0,shadowCell='';
function animate(now:number){
 requestAnimationFrame(animate);const realElapsed=(now-last)/1000,elapsed=Math.min(.05,realElapsed);last=now;total+=elapsed;frames++;frameSum+=realElapsed;
 if(frameSum>=1){if(state.mode==='playing'&&$<HTMLSelectElement>('quality').value==='auto'){const fps=frames/frameSum;slowSeconds=fps<55?slowSeconds+1:Math.max(0,slowSeconds-1);if(slowSeconds>=3&&resolutionScale>.701){resolutionScale=Math.max(.7,resolutionScale-.1);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)*resolutionScale);resize();slowSeconds=0;}}$('fps').textContent=`${Math.round(frames/frameSum)} FPS`;frames=0;frameSum=0;}
 if(state.mode==='playing'){
  accumulator+=elapsed;while(accumulator>=1/60){fixedStep(1/60);accumulator-=1/60;if(state.mode!=='playing'){accumulator=0;break;}}
  if(flight.piloting||marine.piloting){const pose=flight.piloting?flight.cameraPose():marine.cameraPose();camera.position.copy(pose.position);camera.rotation.set(pose.pitch,pose.yaw,0,'YXZ');}else camera.rotation.set(state.pitch+state.recoil*.2,state.yaw,0,'YXZ');state.recoil*=Math.exp(-elapsed*15);
  const targetFov=aiming?52:keys.has('ShiftLeft')?80:75;camera.fov=THREE.MathUtils.lerp(camera.fov,targetFov,1-Math.exp(-elapsed*12));camera.updateProjectionMatrix();updateHud();
 }else if(state.mode==='menu'){camera.position.set(REGION_START.x,heightAt(REGION_START.x,REGION_START.z)+2.1,REGION_START.z);camera.rotation.set(.035,Math.sin(total*.055)*.1,0,'YXZ');}
 const moving=state.mode==='playing'&&['KeyW','KeyA','KeyS','KeyD'].some(k=>keys.has(k))?1:0;
 weapon.group.visible=!flight.piloting;marine.render(elapsed,state.time);flight.render(elapsed,state.time);
 weapon.update(elapsed,{time:total,moving,sprinting:keys.has('ShiftLeft')&&!aiming,aiming,reload:state.reload>0?1-state.reload/reloadDuration():0,recoil:state.recoil});
 for(const e of enemies){e.visual.group.visible=e.active&&e.position.distanceTo(camera.position)<280;if(e.visual.group.visible)e.visual.update(state.mode==='playing'?elapsed:0,{time:state.time+e.seed,moving:e.health>0&&e.moving,firing:e.health>0&&state.time<e.flashUntil,dead:e.health<=0,alert:e.alert>0,crouching:e.alert>0&&!e.moving&&e.health<60});}
 squad.render(state.mode==='playing'?elapsed:0,state.time,camera.position);
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=elapsed;p.velocity.y-=elapsed*9;p.mesh.position.addScaledVector(p.velocity,elapsed);p.mesh.scale.setScalar(Math.max(0,p.life/p.max));if(p.life<=0){scene.remove(p.mesh);particles.splice(i,1);}}
 for(let i=traces.length-1;i>=0;i--){const t=traces[i];t.life-=elapsed;if(t.life<=0){scene.remove(t.line);t.line.geometry.dispose();(t.line.material as THREE.Material).dispose();traces.splice(i,1);}}
 sound.setListener(camera.position,state.yaw);blastLight.intensity=Math.max(0,blastLight.intensity-elapsed*500);env.update(state.mode==='playing'?elapsed:0,state.time,camera.position);sound.setWeather(env.climate().rain,env.climate().wind/11);
 if(total>toastUntil)$('toast').style.opacity='0';if(total>subtitleUntil)$('subtitle').hidden=true;if(total>hitUntil)$('hitmarker').style.opacity='0';
 const nextShadowCell=`${Math.floor(camera.position.x/32)},${Math.floor(camera.position.y/8)},${Math.floor(camera.position.z/32)},${Math.floor(state.time/10)}`;if(nextShadowCell!==shadowCell){shadowCell=nextShadowCell;renderer.shadowMap.needsUpdate=true;}
 renderer.info.reset();const renderStart=performance.now();composer.render();lastRenderMs=performance.now()-renderStart;
}
function awardOceanKill(){campaign.oceanKills=(campaign.oceanKills||0)+1;campaign.salvage+=90;journal(campaign,'Coastal patrol neutralized','The Wayfarer launch route is clear. +90 salvage',state.time);toast('PIRATE PATROL DESTROYED · +90 SALVAGE');saveGame();}
function advanceReload(dt:number){if(state.reload>0){state.reload-=dt;if(state.reload<=0){Object.assign(state,reloadAmmo(state.ammo,state.reserve));sound.reload();}}}
function reloadDuration(){return RELOAD_SECONDS*(1-.12*(campaign.upgrades?.handling||0));}
function atBase(){return !flight?.piloting&&!marine?.piloting&&(camera.position.distanceTo(new THREE.Vector3(0,17.7,110))<45||nearbySites.some(s=>!isEncounterId(s.id)&&(s.faction==='friendly'||campaign.completed.includes(s.id))&&siteDistance(camera.position,s)<Math.min(s.radius,80)));}
function refreshJournal(){expeditionUI.update({campaign,atBase:atBase(),saveMessage});}
function openJournal(){if(state.mode!=='playing')return;setMenu('paused');journalOpen=true;$('menu').hidden=true;expeditionUI.open({campaign,atBase:atBase(),saveMessage});}
function closeJournal(){if(!journalOpen)return;journalOpen=false;expeditionUI.close();setMenu('playing');void renderer.domElement.requestPointerLock().catch(()=>{});}
function settleContracts(){for(const contract of resolveContracts(campaign)){journal(campaign,contract.title,`Contract complete · ${contract.reward} salvage`,state.time);toast(`${contract.title.toUpperCase()} · +${contract.reward} SALVAGE`,4);}}
function peekSave(){try{return readSave(localStorage);}catch{return null;}}
function placePlayer(p:THREE.Vector3){body.setTranslation({x:p.x,y:p.y-.7,z:p.z},true);body.setNextKinematicTranslation({x:p.x,y:p.y-.7,z:p.z});camera.position.copy(p);collider.setEnabled(true);state.vertical=0;state.pitch=0;}
function saveGame(){if(!ready||state.mode==='menu'||state.mode==='dead')return false;lastSave=state.time;if(!flight.piloting&&flight.landed)parkedShipPosition.copy(flight.position);const boat=marine.snapshot(),onBoat=marine.piloting||(Math.hypot(camera.position.x-boat.position[0],camera.position.z-boat.position[2])<6&&Math.abs(camera.position.y-boat.deckY-1.7)<1);const resume=onBoat?new THREE.Vector3(Math.sin(boat.yaw)*3,boat.deckY+1.7,Math.cos(boat.yaw)*3).add(new THREE.Vector3(boat.position[0],0,boat.position[2])):safePosition;try{const ok=writeSave(localStorage,{campaign,position:resume.toArray(),state,ship:parkedShipPosition.toArray(),marine:marine.position.toArray(),marineYaw:marine.snapshot().yaw,enemyHealth:[...enemyHealth]});saveMessage=ok?'Expedition saved on this browser':'Save unavailable in this browser';return ok;}catch{saveMessage='Save unavailable in this browser';return false;}}
function loadGame(){const saved=peekSave();if(!saved)return false;reset();campaign=ensureProgression(saved.campaign);Object.assign(state,saved.state);state.lastDamage=-10;for(const [id,health] of saved.enemyHealth)enemyHealth.set(String(id),Number(health));for(const id of campaign.completed)env.setSiteComplete(id,true);flight.setUpgrades(campaign.upgrades);if(saved.ship)flight.restoreAt({x:saved.ship[0],y:saved.ship[1],z:saved.ship[2]});if(saved.marine)marine.restoreAt({x:saved.marine[0],y:saved.marine[1],z:saved.marine[2],yaw:saved.marineYaw});marine.setPatrolDefeated(campaign.oceanKills>0);parkedShipPosition.copy(flight.position);encounters.restore(campaign.encountersCompleted);safePosition.fromArray(saved.position);env.sync(safePosition);placePlayer(safePosition);world.step();for(const e of enemies){e.active=false;e.collider.setEnabled(false);}syncEnemies();squad.disembark(camera.position,state.yaw);lastSave=state.time;subtitle('Rook: Expedition restored. Your discoveries, upgrades and secured bases are still on the record.',5);return true;}
window.addEventListener('pagehide',()=>saveGame());
async function boot(){
 try{
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.outputColorSpace=THREE.SRGBColorSpace;$('viewport').append(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();setMenu('paused');$('loading').textContent='Graphics context interrupted. Restoring…';});renderer.domElement.addEventListener('webglcontextrestored',()=>location.reload());
  scene.add(camera,blastLight);renderer.info.autoReset=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  await RAPIER.init();world=new RAPIER.World({x:0,y:-17,z:0});env=buildEnvironment(scene,world);env.sync(camera.position.set(REGION_START.x,heightAt(REGION_START.x,REGION_START.z)+1.7,REGION_START.z));weapon=createWeapon(camera);weapon.group.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=false;o.receiveShadow=false;}});camera.position.set(REGION_START.x,heightAt(REGION_START.x,REGION_START.z)+1.7,REGION_START.z);
  composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.23,.5,1.2));composer.addPass(new OutputPass());
  body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(REGION_START.x,heightAt(REGION_START.x,REGION_START.z)+1,REGION_START.z));collider=world.createCollider(RAPIER.ColliderDesc.capsule(.65,.3),body);controller=world.createCharacterController(.025);controller.enableAutostep(.4,.25,true);controller.enableSnapToGround(.6);controller.setMaxSlopeClimbAngle(Math.PI/3);controller.setApplyImpulsesToDynamicBodies(true);
  squad=createSquad(scene,world);flight=createFlight(scene,world);parkedShipPosition.copy(flight.position);marine=createMarine(scene,world);encounters=createEncounters(scene,world);spacePirates=createSpacePirates(scene);ensureProgression(campaign);syncEnemies();
  world.step();scene.updateMatrixWorld(true);await renderer.compileAsync(scene,camera);ready=true;$<HTMLButtonElement>('deploy').disabled=false;$('deploy-label').textContent=peekSave()?'CONTINUE EXPEDITION':'BEGIN EXPEDITION';$('new-expedition').hidden=!peekSave();$('loading').textContent='F · Board Kestrel   /   Tab · Planet atlas   /   Q · Squad focus';
  last=performance.now();requestAnimationFrame(animate);
  // Read-only diagnostics in every build; deterministic QA controls only in local development.
  const diagnostics={snapshot:()=>({mode:state.mode,health:state.health,ammo:state.ammo,reserve:state.reserve,grenades:state.grenades,kills:state.kills,stage:state.stage,upload:state.upload,time:state.time,position:camera.position.toArray(),region:currentRegion,campaign:JSON.parse(JSON.stringify(campaign)),flight:flight.snapshot(),marine:marine.snapshot(),climate:env.climate(),encounters:encounters.snapshot(),saveMessage,resolutionScale,airPirates:spacePirates.snapshot(),world:env.stats(),sites:nearbySites,guards:enemies.filter(e=>e.active).length,squad:squad.snapshot(),enemyPositions:enemies.map(e=>({id:e.id,site:e.site,active:e.active,position:e.position.toArray(),health:e.health})),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,renderCpuMs:lastRenderMs})};
  Object.assign(window,{blackline:diagnostics});
  type ToolContext={registerTool:(tool:{name:string,description:string,inputSchema:object,annotations:object,execute:(input:unknown)=>unknown},options:{signal:AbortSignal})=>void|Promise<void>};
  const context=(document as Document&{modelContext?:ToolContext}).modelContext;
  if(context?.registerTool){const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});for(const tool of [{name:'read_mission_status',description:'Read the current Blackline mission status, ammunition, health, and objective.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>diagnostics.snapshot()},{name:'pause_operation',description:'Pause the Blackline operation and open its visible pause menu.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute:()=>{if(state.mode!=='playing')throw new Error('No operation is running.');setMenu('paused');return diagnostics.snapshot();}}]){try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(console.warn);}catch(e){console.warn(e);}}}
  if(import.meta.env.DEV)Object.assign(window,{blacklineQA:{...diagnostics,blocked:(a:number[],b:number[])=>blocked(new THREE.Vector3().fromArray(a),new THREE.Vector3().fromArray(b)),start:()=>{weapon.group.visible=true;reset();setMenu('playing');},pause:()=>setMenu('paused'),photo:()=>{setMenu('paused');$('menu').hidden=true;weapon.group.visible=false;},look:(yaw:number,pitch:number)=>{state.yaw=yaw;state.pitch=pitch;},teleport:(x:number,z:number)=>{env.sync(new THREE.Vector3(x,heightAt(x,z)+2,z));const y=heightAt(x,z);body.setTranslation({x,y:y+1,z},true);body.setNextKinematicTranslation({x,y:y+1,z});camera.position.set(x,y+1.7,z);syncEnemies();},teleport3:(x:number,y:number,z:number)=>{env.sync(new THREE.Vector3(x,y,z));body.setTranslation({x,y:y-.7,z},true);body.setNextKinematicTranslation({x,y:y-.7,z});camera.position.set(x,y,z);syncEnemies();},regroup:()=>squad.disembark(camera.position,state.yaw),flight,marine,encounters,setClimate:(value:any)=>{env.setClimate(value);shadowCell='';},setTime:(t:number)=>{state.time=t;shadowCell='';},save:saveGame,load:loadGame,openJournal,grantSalvage:(n:number)=>{campaign.salvage=n;},fire,damage:(amount:number)=>hurt(amount),hurtAlly:(index:number,amount:number)=>squad.hurt(index,amount),setEnemyHealth:(index:number,health:number)=>{enemies[index].health=health;},clear:()=>{enemies.forEach(e=>damageEnemy(e,1000,e.position.clone()));},setAmmo:(ammo:number,reserve:number)=>Object.assign(state,{ammo,reserve})}});
 }catch(error){console.error(error);$('loading').textContent=`Unable to start graphics: ${error instanceof Error?error.message:String(error)}. Try a browser with WebGL 2 hardware acceleration.`;$('deploy-label').textContent='GRAPHICS UNAVAILABLE';}
}
void boot();

$('network-status').innerHTML='SALVAGE <b id="network-strength">0</b>';
document.querySelector('#squad-cluster small')!.textContent='B · HOLD / FOLLOW   Q · FOCUS   J · SUPPLIES';
document.querySelector('.control-grid')?.insertAdjacentHTML('beforeend','<span><b>I</b> Journal / upgrades / contracts</span><span><b>F</b> Board / exit ship or boat</span><span><b>Q / J</b> Squad focus / supplies</span><span><b>FLIGHT</b> WASD thrust · Space / Ctrl altitude</span><span><b>SHIFT / FIRE</b> Boost / cannons</span>');
