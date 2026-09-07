import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createIndustrialMaterials} from './industrial-materials';
import {getEncounterSites,encounterPosition} from './encounter-layout.mjs';
import {heightAt} from './region-layout.mjs';
import {createEnemy} from './actors';
export {isEncounterId} from './encounter-layout.mjs';
type Site=ReturnType<typeof getEncounterSites>[number];
type BattleEnemy={position:THREE.Vector3,health:number,active?:boolean,flashUntil?:number};
type Scout={visual:ReturnType<typeof createEnemy>,health:number,cooldown:number,flashUntil:number,engagedUntil:number,target:BattleEnemy|null,shots:number,damage:number};
type Record={source:Site,site:Site,group:THREE.Group,beacon:THREE.Mesh,geometries:THREE.BufferGeometry[],body?:RAPIER.RigidBody,scouts:Scout[]};
export type EncounterReward={id:string,type:'salvage',amount:number,message:string,site:Site};

/** Small optional stories streamed independently of settlement objectives. */
export function createEncounters(scene:THREE.Scene,world?:RAPIER.World){
 const material=createIndustrialMaterials(),loaded=new Map<string,Record>(),completed=new Set<string>();
 let progress=0,interacting='',lastSyncX=Infinity,lastSyncZ=Infinity;
 const boxGeo=new THREE.BoxGeometry(1,1,1),beaconGeo=new THREE.OctahedronGeometry(.38),wheelGeo=new THREE.CylinderGeometry(.67,.67,.4,12);
 const signal=new THREE.MeshBasicMaterial({color:0x72e5e5,toneMapped:false});
 const retaliation=new WeakMap<BattleEnemy,{next:number,shots:number}>();
 const scoutMemory=new Map<string,Pick<Scout,'health'|'shots'|'damage'>[]>();
 const matrix=new THREE.Matrix4(),quaternion=new THREE.Quaternion();
 function build(source:Site):Record{
  const group=new THREE.Group(),geometries:THREE.BufferGeometry[]=[],batches=new Map<THREE.Material,THREE.BufferGeometry[]>(),moving=['convoy','patrol','friendly'].includes(source.kind);
  group.position.set(source.x,source.elevation,source.z);scene.add(group);
  const body=world?.createRigidBody((moving?RAPIER.RigidBodyDesc.kinematicPositionBased():RAPIER.RigidBodyDesc.fixed()).setTranslation(source.x,source.elevation,source.z));
  if(body)body.userData={worldCover:true};
  function box(x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material,solid=false,rz=0){
   matrix.compose(new THREE.Vector3(x,y,z),quaternion.setFromEuler(new THREE.Euler(0,0,rz)),new THREE.Vector3(w,h,d));
   const g=boxGeo.clone().applyMatrix4(matrix),batch=batches.get(m)||[];batch.push(g);batches.set(m,batch);
   if(solid&&world&&body)world.createCollider(RAPIER.ColliderDesc.cuboid(w/2,h/2,d/2).setTranslation(x,y,z),body);
  }
  function truck(x:number,z:number,friendly=false){
   box(x,1.08,z,3,.6,6.4,material.dark,true);box(x,2.05,z-2.1,2.8,1.65,1.9,friendly?material.teal:material.orange,true);
   box(x,2.36,z-3.07,2.37,.66,.035,material.glass);box(x,1.49,z-3.12,2.9,.18,.1,material.steel);
   for(const side of [-1,1]){box(x+side*1.03,1.65,z-3.12,.48,.21,.08,material.pale);box(x+side*1.48,2.42,z-2,.09,.08,1.2,material.steel);}
   box(x,2.3,z+.85,2.7,2.12,3.8,material.teal,true);box(x,3.4,z+.85,2.85,.12,4,material.steel);
   for(let k=0;k<11;k++)for(const side of [-1,1])box(x+side*1.37,2.32,z-.75+k*.3,.06,1.8,.065,material.dark);
   for(const side of [-1,1])for(const offset of [-2,1.4,2.45]){
    const g=wheelGeo.clone().rotateZ(Math.PI/2).translate(x+side*1.54,.7,z+offset),list=batches.get(material.black)||[];list.push(g);batches.set(material.black,list);
    box(x+side*1.77,.7,z+offset,.025,.35,.35,material.steel);
   }
   box(x,3.58,z-2,.54,.13,.32,friendly?material.cyan:material.amber);
  }
  const scouts:Scout[]=[];
  if(source.kind==='convoy'){truck(-3,-7);truck(3,7);}
  else if(source.kind==='patrol'||source.kind==='friendly'){
   truck(-4,0,source.kind==='friendly');
   if(source.kind==='friendly')for(let i=0;i<2;i++){const scout=createEnemy(scene);scout.group.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=false;});const saved=scoutMemory.get(source.id)?.[i];scouts.push({visual:scout,health:saved?.health??100,cooldown:2+i,flashUntil:0,engagedUntil:0,target:null,shots:saved?.shots??0,damage:saved?.damage??0});}
  }else if(source.kind==='wreck'){
   box(-1,1.05,0,2.7,1.7,8,material.steel,true,-.13);box(-1,1.9,-3.5,2.2,.45,2,material.glass,false,-.13);
   for(const side of [-1,1]){box(side*3.4,.7,1,4.5,.24,3,side<0?material.orange:material.teal,false,side*.18);box(side*2.25,1.1,2.3,1,1.1,3,material.dark,true);box(side*2.25,1.1,3.86,.74,.74,.08,material.amber);}
   for(let i=0;i<9;i++)box(Math.sin(i*6.4)*(5+i*.3),.2,Math.cos(i*2.8)*(4+i*.2),.4+i*.14,.17,.7,material.rust,false,i*.5);
   box(-.8,1.9,2.5,.22,2.1,2.1,material.orange,false,-.22);
  }else if(source.kind==='bunker'){
   box(0,.18,0,9,.36,8,material.concrete,true);box(-4.3,1.75,0,.6,3.2,8,material.concrete,true);box(4.3,1.75,0,.6,3.2,8,material.concrete,true);box(0,1.75,-3.7,8,3.2,.6,material.concrete,true);
   for(const side of [-1,1])box(side*2.9,1.75,3.7,2.5,3.2,.6,material.concrete,true);
   box(0,3.48,0,9.5,.38,8.5,material.dark,true);box(0,3.08,3.74,2.8,.17,.15,material.cyan);
   for(const side of [-1,1]){box(side*3,1.1,-2,1.2,1.4,1.2,material.steel,true);for(let j=0;j<3;j++)box(side*3,1.1+j*.25,-1.38,.8,.08,.035,material.black);}
   box(-3,4.4,-2.7,.12,2,.12,material.steel);box(-3,5.2,-2.7,2,.1,.1,material.steel);
  }else if(source.kind==='relic'){
   for(let i=0;i<7;i++){const a=i/7*Math.PI*2;box(Math.cos(a)*4,1.6,Math.sin(a)*4,.65,3.2,.65,material.dark,false,Math.sin(i)*.13);box(Math.cos(a)*4,2,Math.sin(a)*4,.68,.17,.68,material.cyan);}
   box(0,.8,0,1.4,1.6,1.4,material.steel,true);
  }else{
   box(-3,.3,0,3,.35,4,material.dark);box(-3,1.6,-1.2,3,2.5,.16,material.orange,true);box(-4.4,1.6,.4,.16,2.5,3.2,material.teal,true);box(-3,2.94,.4,3.2,.14,3.5,material.steel);
   box(-3,1.7,-1.1,1.1,.5,.035,material.cyan);box(-3,3.7,-1,.12,1.5,.12,material.steel);box(-3,4.5,-1,.35,.2,.35,material.amber);
   for(let i=0;i<3;i++)box(3+i*.9,.4,-2+i*.8,.7,.8,.7,material.rust,true);
  }
  // The orange flight case is the consistent interactable, placed clear of geometry.
  box(0,.58,5,1.3,.85,.8,material.orange,true);box(0,1.02,5,1.42,.08,.92,material.dark);box(0,.65,5.42,.28,.2,.025,material.cyan);
  for(const [mat,parts] of batches){const geometry=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());if(!geometry)continue;geometries.push(geometry);const mesh=new THREE.Mesh(geometry,mat);mesh.receiveShadow=true;group.add(mesh);}
  const beacon=new THREE.Mesh(beaconGeo,signal);beacon.position.set(0,2,5);group.add(beacon);
  scoutMemory.delete(source.id);
  return{source,site:{...source},group,beacon,geometries,body,scouts};
 }
 function remove(r:Record){
  // Remember only gameplay values, never unloaded meshes, animation closures or enemy references.
  if(r.scouts.length){scoutMemory.set(r.site.id,r.scouts.map(({health,shots,damage})=>({health,shots,damage})));if(scoutMemory.size>128)scoutMemory.delete(scoutMemory.keys().next().value!);}
  scene.remove(r.group);r.geometries.forEach(g=>g.dispose());if(world&&r.body)world.removeRigidBody(r.body);for(const scout of r.scouts){scene.remove(scout.visual.group);scout.visual.group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});}}
 function nearby(position:THREE.Vector3){return [...loaded.values()].filter(r=>!completed.has(r.site.id)&&r.site.kind!=='friendly'&&Math.hypot(position.x-r.site.x,position.z-r.site.z-5)<3.2&&Math.abs(position.y-r.site.elevation-1.7)<3).sort((a,b)=>Math.hypot(position.x-a.site.x,position.z-a.site.z-5)-Math.hypot(position.x-b.site.x,position.z-b.site.z-5))[0];}
 return{
  sync(position:THREE.Vector3){if(Math.hypot(position.x-lastSyncX,position.z-lastSyncZ)<100)return;lastSyncX=position.x;lastSyncZ=position.z;
   const desired=getEncounterSites(position.x,position.z,760).sort((a,b)=>Math.hypot(a.x-position.x,a.z-position.z)-Math.hypot(b.x-position.x,b.z-position.z)).slice(0,6),ids=new Set(desired.map(s=>s.id));
   for(const [id,record] of loaded)if(!ids.has(id)){remove(record);loaded.delete(id);}
   for(const site of desired)if(!loaded.has(site.id))loaded.set(site.id,build(site));
  },
  update(dt:number,time:number,position:THREE.Vector3){for(const r of loaded.values()){
   const p=completed.has(r.site.id)?r.site:encounterPosition(r.source,time);r.site.x=p.x;r.site.z=p.z;r.site.elevation=heightAt(p.x,p.z);r.group.position.set(p.x,r.site.elevation,p.z);r.group.visible=position.distanceTo(r.group.position)<900;
   if(r.body&&['convoy','patrol','friendly'].includes(r.source.kind))r.body.setNextKinematicTranslation(r.group.position);
   r.beacon.visible=!completed.has(r.site.id);r.beacon.rotation.y=time*.8;r.beacon.position.y=2.1+Math.sin(time*2)*.1;
   for(let i=0;i<r.scouts.length;i++){
    const scout=r.scouts[i],visual=scout.visual,engaged=scout.engagedUntil>time&&scout.health>0,x=p.x+3+i*2,z=p.z+8+i*3;
    if(scout.health>0&&!engaged)visual.group.position.set(x,heightAt(x,z),z);
    if(engaged&&scout.target)visual.group.rotation.y=Math.atan2(-(scout.target.position.x-visual.group.position.x),-(scout.target.position.z-visual.group.position.z));
    else visual.group.rotation.y=Math.sin(time*.012+1.1)>0?-.7:2.4;
    visual.group.visible=position.distanceTo(visual.group.position)<170;
    if(visual.group.visible)visual.update(dt,{time:time+i,moving:!engaged&&scout.health>0,firing:time<scout.flashUntil,dead:scout.health<=0,alert:engaged,crouching:engaged&&scout.health<45});
   }
  }},
  battle(dt:number,time:number,player:THREE.Vector3,enemies:BattleEnemy[],onShot:(from:THREE.Vector3,to:THREE.Vector3,faction:'friendly'|'pirate')=>void,onDamageEnemy:(enemy:BattleEnemy,damage:number,at:THREE.Vector3)=>void){
   for(const record of loaded.values())for(const scout of record.scouts){
    if(scout.health<=0||scout.visual.group.position.distanceTo(player)>180)continue;
    scout.cooldown-=dt;if(scout.cooldown>0)continue;
    scout.cooldown=.5;
    const from=scout.visual.group.position.clone().add(new THREE.Vector3(0,1.45,0));
    let target:BattleEnemy|null=null,to:THREE.Vector3|null=null,nearest=85;
    for(const enemy of enemies){
     if(enemy.health<=0||enemy.active===false)continue;
     const aim=enemy.position.clone().add(new THREE.Vector3(0,1.3,0)),distance=aim.distanceTo(from);if(distance>=nearest||distance<1)continue;
     const direction=aim.clone().sub(from).normalize();
     if(world?.castRay(new RAPIER.Ray(from,direction),distance-.65,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS))continue;
     nearest=distance;target=enemy;to=aim;
    }
    if(!target||!to){scout.target=null;continue;}
    scout.target=target;scout.engagedUntil=time+5;scout.flashUntil=time+.16;scout.cooldown=3.8;scout.shots++;
    const hits=scout.shots%3===0,end=to.clone();if(!hits)end.x+=1.8;
    onShot(from,end,'friendly');
    if(hits){const before=target.health;onDamageEnemy(target,8,to);scout.damage+=Math.max(0,before-target.health);}
    // Return fire is tied to a live pirate and the same unobstructed sight line.
    const returnFire=retaliation.get(target)??{next:time+.8,shots:0};
    if(time>=returnFire.next&&target.health>0){
     returnFire.next=time+3.4;returnFire.shots++;target.flashUntil=time+.16;
     const incoming=from.clone();if(returnFire.shots%3===0)incoming.x-=1.8;
     onShot(to,incoming,'pirate');
     if(returnFire.shots%3!==0){scout.health=Math.max(0,scout.health-9);scout.visual.hit();}
    }
    retaliation.set(target,returnFire);
   }
  },
  sites(){return [...loaded.values()].map(r=>r.site);},
  interact(position:THREE.Vector3,held:boolean,dt:number,guardCount:(id:string)=>number):EncounterReward|null{
   const r=nearby(position);if(!r||!held||guardCount(r.site.id)>0){progress=0;interacting='';return null;}
   if(interacting!==r.site.id){interacting=r.site.id;progress=0;}progress+=dt;if(progress<2)return null;
   completed.add(r.site.id);r.beacon.visible=false;progress=0;return{id:r.site.id,type:'salvage',amount:r.site.reward,message:`${r.site.name.toUpperCase()} · +${r.site.reward} SALVAGE`,site:r.site};
  },
  prompt(position:THREE.Vector3,guardCount:(id:string)=>number){const r=nearby(position);if(!r)return null;const guards=guardCount(r.site.id);return{text:guards?`${guards} HOSTILES · SECURE ${r.site.name.toUpperCase()}`:`HOLD E · RECOVER ${r.site.name.toUpperCase()}`,progress:interacting===r.site.id?Math.min(1,progress/2):0};},
  snapshot(){return{scouts:[...loaded.values()].flatMap(r=>r.scouts.map((s,i)=>({id:`${r.site.id}:${i}`,health:s.health,shots:s.shots,damage:s.damage,position:s.visual.group.position.toArray(),engaged:!!s.target,down:s.health<=0}))),completed:[...completed],rememberedPatrols:scoutMemory.size,loaded:loaded.size,sites:[...loaded.values()].map(r=>({...r.site,completed:completed.has(r.site.id)})),progress};},
  restore(ids:string[]){completed.clear();for(const id of ids)completed.add(id);},
  reset(){completed.clear();scoutMemory.clear();for(const r of loaded.values())for(const s of r.scouts){s.health=100;s.shots=0;s.damage=0;s.target=null;s.engagedUntil=0;}progress=0;interacting='';lastSyncX=Infinity;lastSyncZ=Infinity;},
 };
}
