import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {createEnemy} from './actors';
import {REGION_START,heightAt} from './region-layout.mjs';

export type SquadTarget={position:THREE.Vector3,health:number};
export type SquadShot={name:string,role:string,damage:number};
type Member={name:string,role:string,position:THREE.Vector3,health:number,visual:ReturnType<typeof createEnemy>,body:RAPIER.RigidBody,collider:RAPIER.Collider,controller:RAPIER.KinematicCharacterController,cooldown:number,moving:boolean,firing:number,revive:number,target:SquadTarget|null,scan:number,burst:number,shotsFired:number,damageDealt:number,kills:number,status:string,avoidSide:number,avoidUntil:number,stuck:number,lastPosition:THREE.Vector3,steerUntil:number,steeringAngle:number,canAdvance:boolean};

export function createSquad(scene:THREE.Scene,world:RAPIER.World){
 let order:'follow'|'hold'|'attack'='follow',embarked=false,focus:SquadTarget|null=null,supplyCooldown=0,radioCooldown=0;
 const holdPositions:THREE.Vector3[]=[],members:Member[]=[];
 const up=new THREE.Vector3(0,1.45,0),targetHeight=new THREE.Vector3(0,1.25,0),probeShape=new RAPIER.Capsule(.59,.27);
 const fixedFlags=RAPIER.QueryFilterFlags.ONLY_FIXED|RAPIER.QueryFilterFlags.EXCLUDE_SENSORS;
 for(let i=0;i<2;i++){
  const x=REGION_START.x+(i?2.7:-2.7),z=REGION_START.z-3,visual=createEnemy(scene);
  visual.group.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=false;const original=o.material as THREE.MeshStandardMaterial,material=original.clone();if(material.emissive&&material.emissive.getHex()!==0&&material.emissiveIntensity>0){material.emissive.set(0x29cbef);material.color.set(0x55cbe7);}o.material=material;}});
  const stripe=new THREE.Mesh(new THREE.BoxGeometry(.4,.08,.015),new THREE.MeshBasicMaterial({color:i?0x91bcbc:0x6199ad}));stripe.position.set(0,1.28,-.235);visual.group.add(stripe);
  const position=new THREE.Vector3(x,heightAt(x,z),z),body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x,position.y+.95,z));
  const collider=world.createCollider(RAPIER.ColliderDesc.capsule(.6,.28),body),controller=world.createCharacterController(.025);controller.enableAutostep(.48,.2,true);controller.enableSnapToGround(.7);
  members.push({name:i?'ROOK':'VALE',role:i?'MARKSMAN':'ASSAULT',position,health:100,visual,body,collider,controller,cooldown:.3+i*.5,moving:false,firing:0,revive:0,target:null,scan:0,burst:0,shotsFired:0,damageDealt:0,kills:0,status:'FOLLOWING',avoidSide:i?1:-1,avoidUntil:0,stuck:0,lastPosition:position.clone(),steerUntil:0,steeringAngle:0,canAdvance:true});holdPositions.push(position.clone());visual.group.position.copy(position);
 }
 function place(m:Member,p:THREE.Vector3){m.position.copy(p);m.lastPosition.copy(p);const bodyPosition={x:p.x,y:p.y+.95,z:p.z};m.body.setTranslation(bodyPosition,true);m.body.setNextKinematicTranslation(bodyPosition);m.visual.group.position.copy(p);m.stuck=0;m.avoidUntil=0;m.steerUntil=0;}
 function safeGround(x:number,z:number,expectedFeet:number){
  const hit=world.castRayAndGetNormal(new RAPIER.Ray({x,y:expectedFeet+1.2,z},{x:0,y:-1,z:0}),4.5,true,fixedFlags);
  if(!hit||hit.normal.y<.65)return null;
  const y=expectedFeet+1.2-hit.timeOfImpact;let occupied=false;
  world.intersectionsWithShape({x,y:y+.97,z},{x:0,y:0,z:0,w:1},probeShape,()=>{occupied=true;return false;},fixedFlags);
  return occupied?null:new THREE.Vector3(x,y+.02,z);
 }
 return {
  members,
  get order(){return order;},
  get embarked(){return embarked;},
  toggle(){order=order==='hold'?'follow':'hold';focus=null;members.forEach((m,i)=>holdPositions[i].copy(m.position));return order;},
  attack(target:SquadTarget){if(target.health<=0||embarked)return false;focus=target;order='attack';for(const m of members){m.scan=0;m.cooldown=Math.min(m.cooldown,.2);}return true;},
  supply(player?:THREE.Vector3){if(embarked||supplyCooldown>0||!members.some(m=>m.health>0&&(!player||m.position.distanceTo(player)<12)))return false;supplyCooldown=60;return true;},
  registerKill(name:string){const m=members.find(m=>m.name===name);if(m)m.kills++;},
  embark(){embarked=true;focus=null;order='follow';for(const m of members){m.collider.setEnabled(false);m.visual.group.visible=false;m.target=null;m.moving=false;m.firing=0;m.status='ABOARD';}},
  disembark(player:THREE.Vector3,yaw:number){
   const places:THREE.Vector3[]=[];
   // Query fixed-world ground at landing elevation: terrain, vessel deck or station floor.
   for(let i=0;i<members.length;i++){
    let placeAt:THREE.Vector3|null=null;
    for(const radius of [2.6,1.5,3.8,.85]){
     for(let n=0;n<12;n++){
      const angle=yaw+(i?1:-1)*Math.PI/2+n*Math.PI/6;
      const p=safeGround(player.x+Math.sin(angle)*radius,player.z+Math.cos(angle)*radius,player.y-1.7);
      if(!p||places.some(other=>other.distanceTo(p)<.8))continue;
      const start={x:player.x,y:player.y-.6,z:player.z},delta={x:p.x-start.x,y:p.y+1.1-start.y,z:p.z-start.z};
      if(world.castRay(new RAPIER.Ray(start,delta),.98,true,fixedFlags))continue;
      placeAt=p;break;
     }
     if(placeAt)break;
    }
    if(!placeAt)return false;places.push(placeAt);
   }
   embarked=false;order='follow';focus=null;
   members.forEach((m,i)=>{place(m,places[i]);holdPositions[i].copy(places[i]);m.collider.setEnabled(m.health>0);m.visual.group.visible=true;m.scan=0;m.status=m.health>0?'FOLLOWING':'DOWN';});return true;
  },
  reset(){order='follow';embarked=false;focus=null;supplyCooldown=0;radioCooldown=0;members.forEach((m,i)=>{const x=REGION_START.x+(i?2.7:-2.7),z=REGION_START.z-3;place(m,new THREE.Vector3(x,heightAt(x,z),z));holdPositions[i].copy(m.position);m.health=100;m.revive=0;m.cooldown=.4+i*.25;m.collider.setEnabled(true);m.visual.group.visible=true;m.target=null;m.scan=0;m.burst=0;m.shotsFired=0;m.damageDealt=0;m.kills=0;m.status='FOLLOWING';});},
  snapshot(){return {order,embarked,supplyReady:supplyCooldown<=0,supplyCooldown:Math.ceil(supplyCooldown),members:members.map(m=>({name:m.name,role:m.role,health:Math.round(m.health),position:m.position.toArray(),down:m.health<=0,status:m.status,combatTarget:m.target?.health&&m.target.health>0?m.target.position.toArray():null,shotsFired:m.shotsFired,damageDealt:m.damageDealt,kills:m.kills}))};},
  hurt(index:number,amount:number){const m=members[index];if(!m||m.health<=0||embarked)return;m.health=Math.max(0,m.health-amount);if(m.health<=0){m.collider.setEnabled(false);m.status='DOWN';m.target=null;}},
  reviveNear(player:THREE.Vector3,held:boolean,dt:number){if(embarked)return null;const m=members.find(m=>m.health<=0&&m.position.distanceTo(player)<3.3);for(const other of members)if(other!==m)other.revive=0;if(!m)return null;m.revive=held?m.revive+dt:Math.max(0,m.revive-dt);if(m.revive>=3){m.health=70;m.revive=0;m.collider.setEnabled(true);m.status='FOLLOWING';}return {name:m.name,progress:m.revive/3};},
  step(dt:number,time:number,player:THREE.Vector3,yaw:number,targets:SquadTarget[],blocked:(a:THREE.Vector3,b:THREE.Vector3)=>boolean,onFire:(target:SquadTarget,from:THREE.Vector3,to:THREE.Vector3,info?:SquadShot)=>void,onEvent?:(message:string)=>void){
   supplyCooldown=Math.max(0,supplyCooldown-dt);radioCooldown=Math.max(0,radioCooldown-dt);if(embarked)return;
   if(focus&&focus.health<=0){focus=null;order='follow';onEvent?.('VALE: Marked target down. Moving with you.');}
   for(let i=0;i<members.length;i++){
    const m=members[i],current=m.body.translation();m.position.set(current.x,current.y-.95,current.z);
    if(m.health<=0){m.moving=false;continue;}m.cooldown-=dt;m.firing=Math.max(0,m.firing-dt);m.scan-=dt;
    const eye=m.position.clone().add(up);
    if(m.scan<=0||(m.target&&m.target.health<=0)){
     const previous=m.target;m.scan=.18+i*.04;m.target=null;let closest=65*65;
     if(focus&&focus.health>0&&focus.position.distanceToSquared(m.position)<85*85&&!blocked(eye,focus.position.clone().add(targetHeight)))m.target=focus;
     if(!m.target)for(const candidate of targets){if(candidate.health<=0)continue;const d=candidate.position.distanceToSquared(m.position);if(d>=closest||blocked(eye,candidate.position.clone().add(targetHeight)))continue;closest=d;m.target=candidate;}
     if(m.target&&!previous&&radioCooldown<=0){onEvent?.(`${m.name}: Hostiles spotted. Engaging!`);radioCooldown=9;}
    }
    const target=m.target,offset=(i?1:-1)*3.2;
    let destination=order==='hold'?holdPositions[i].clone():player.clone().add(new THREE.Vector3(offset*Math.cos(yaw)+3*Math.sin(yaw),0,-offset*Math.sin(yaw)+3*Math.cos(yaw)));
    if(order==='attack'&&focus){const toward=m.position.clone().sub(focus.position);toward.y=0;if(toward.lengthSq()<.01)toward.z=1;toward.normalize();destination=focus.position.clone().addScaledVector(toward,i?25:14);}
    const dist=Math.hypot(destination.x-m.position.x,destination.z-m.position.z),playerDistance=Math.hypot(player.x-m.position.x,player.z-m.position.z);
    const holdToFire=!!target&&order!=='attack'&&playerDistance<11&&dist<8,wantsMove=dist>1.6&&!holdToFire;
    m.status=target?'ENGAGING':order==='attack'?'ADVANCING':order==='hold'?'HOLDING':dist>15?'CATCHING UP':'FOLLOWING';
    let desiredX=0,desiredZ=0;
    if(wantsMove){
     const base=Math.atan2(destination.z-m.position.z,destination.x-m.position.x),speed=dist>18?7.1:dist>6?5.2:3.4;
     if(m.lastPosition.distanceToSquared(m.position)<.00015)m.stuck+=dt;else m.stuck=Math.max(0,m.stuck-dt*.5);m.lastPosition.copy(m.position);
     if(m.stuck>.7&&time>m.avoidUntil){m.avoidSide*=-1;m.avoidUntil=time+1.6;m.stuck=0;}
     if(time>=m.steerUntil){
     m.steerUntil=time+.12;let bestScore=-Infinity,bestAngle=base;
     // Multiple local probes avoid cover; Rapier remains authoritative for capsule movement.
     for(const turn of [0,.55,-.55,1.05,-1.05,1.57,-1.57,2.25,-2.25]){
      const angle=base+turn,ux=Math.cos(angle),uz=Math.sin(angle),probe=1.5;let clearance=probe;
      for(const height of [.45,1.25]){const hit=world.castRay(new RAPIER.Ray({x:m.position.x,y:m.position.y+height,z:m.position.z},{x:ux,y:0,z:uz}),probe,true,fixedFlags);if(hit)clearance=Math.min(clearance,Math.max(0,hit.timeOfImpact-.36));}
      // Refuse a step with no nearby supporting floor, including the edge of a ship deck.
      const floor=world.castRay(new RAPIER.Ray({x:m.position.x+ux*.8,y:m.position.y+.6,z:m.position.z+uz*.8},{x:0,y:-1,z:0}),2.4,true,fixedFlags);
      if(!floor)clearance=0;
      if(turn===0&&clearance<1)m.avoidUntil=Math.max(m.avoidUntil,time+2);
      const detourBias=time<m.avoidUntil&&turn!==0?(Math.sign(turn)===m.avoidSide?1.3:-1.3):0;
      const score=Math.cos(turn)*.75+clearance*1.5+detourBias-(clearance<.12?4:0);
      if(score>bestScore){bestScore=score;bestAngle=angle;}
     }
     m.steeringAngle=bestAngle;m.canAdvance=bestScore>-.5;
     }
     if(m.canAdvance){
      const ux=Math.cos(m.steeringAngle),uz=Math.sin(m.steeringAngle),ahead=speed*dt+.42;
      const safeStep=world.castRay(new RAPIER.Ray({x:m.position.x+ux*ahead,y:m.position.y+.6,z:m.position.z+uz*ahead},{x:0,y:-1,z:0}),2,true,fixedFlags);
      if(safeStep){desiredX=ux*speed*dt;desiredZ=uz*speed*dt;}else m.steerUntil=0;
     }
    }
    m.controller.computeColliderMovement(m.collider,{x:desiredX,y:-.22,z:desiredZ});const move=m.controller.computedMovement();m.body.setNextKinematicTranslation({x:current.x+move.x,y:current.y+move.y,z:current.z+move.z});m.moving=Math.hypot(move.x,move.z)>.002;
    const facing=target?target.position:destination;if(target||wantsMove)m.visual.group.rotation.y=Math.atan2(-(facing.x-m.position.x),-(facing.z-m.position.z));
    if(target&&target.health>0&&m.cooldown<=0){
     const to=target.position.clone().add(targetHeight);
     if(!blocked(eye,to)){
      const damage=i?34:16,healthBefore=target.health;m.firing=.14;m.shotsFired++;
      onFire(target,eye,to,{name:m.name,role:m.role,damage});m.damageDealt+=Math.min(Math.max(0,healthBefore-target.health),healthBefore);
      if(i)m.cooldown=1.4;else{m.burst++;m.cooldown=m.burst<3?.14:1.35;if(m.burst===3)m.burst=0;}
     }else{m.target=null;m.cooldown=.12;}
    }
    if(!target)m.health=Math.min(100,m.health+dt*1.5);
   }
  },
  render(dt:number,time:number,player:THREE.Vector3){for(const m of members){if(embarked){m.visual.group.visible=false;continue;}const p=m.body.translation();m.position.set(p.x,p.y-.95,p.z);m.visual.group.position.copy(m.position);m.visual.group.visible=m.position.distanceTo(player)<180;m.visual.update(dt,{time,moving:m.moving,firing:m.firing>0,dead:m.health<=0});}},
 };
}
