import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {createEnemy} from './actors';
import {REGION_START,heightAt} from './region-layout.mjs';

export type SquadTarget={position:THREE.Vector3,health:number};
type Member={name:string,position:THREE.Vector3,health:number,visual:ReturnType<typeof createEnemy>,body:RAPIER.RigidBody,collider:RAPIER.Collider,controller:RAPIER.KinematicCharacterController,cooldown:number,moving:boolean,firing:number,revive:number};
export function createSquad(scene:THREE.Scene,world:RAPIER.World){
 let order:'follow'|'hold'='follow';
 const holdPositions:THREE.Vector3[]=[];
 const members:Member[]=[];
 for(let i=0;i<2;i++){
  const x=REGION_START.x+(i?2.7:-2.7),z=REGION_START.z-3,visual=createEnemy(scene);
  visual.group.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=false;const original=o.material as THREE.MeshStandardMaterial;const material=original.clone();if(material.emissive&&material.emissive.getHex()!==0&&material.emissiveIntensity>0){material.emissive.set(0x29cbef);material.color.set(0x55cbe7);}o.material=material;}});
  const stripe=new THREE.Mesh(new THREE.BoxGeometry(.4,.08,.015),new THREE.MeshBasicMaterial({color:0x58dbe7}));stripe.position.set(0,1.28,-.235);visual.group.add(stripe);
  const position=new THREE.Vector3(x,heightAt(x,z),z),body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x,position.y+.95,z));
  const collider=world.createCollider(RAPIER.ColliderDesc.capsule(.6,.28),body),controller=world.createCharacterController(.025);controller.enableAutostep(.4,.2,true);controller.enableSnapToGround(.6);
  members.push({name:i?'ROOK':'VALE',position,health:100,visual,body,collider,controller,cooldown:.3+i*.5,moving:false,firing:0,revive:0});holdPositions.push(position.clone());visual.group.position.copy(position);
 }
 return {
  members,
  get order(){return order;},
  toggle(){order=order==='follow'?'hold':'follow';members.forEach((m,i)=>holdPositions[i].copy(m.position));return order;},
  reset(){order='follow';members.forEach((m,i)=>{const x=REGION_START.x+(i?2.7:-2.7),z=REGION_START.z-3;m.position.set(x,heightAt(x,z),z);m.body.setTranslation({x,y:m.position.y+.95,z},true);m.body.setNextKinematicTranslation({x,y:m.position.y+.95,z});m.health=100;m.revive=0;m.cooldown=1;m.collider.setEnabled(true);m.visual.group.position.copy(m.position);});},
  snapshot(){return {order,members:members.map(m=>({name:m.name,health:Math.round(m.health),position:m.position.toArray(),down:m.health<=0}))};},
  hurt(index:number,amount:number){const m=members[index];if(!m||m.health<=0)return;m.health=Math.max(0,m.health-amount);if(m.health<=0)m.collider.setEnabled(false);},
  reviveNear(player:THREE.Vector3,held:boolean,dt:number){const m=members.find(m=>m.health<=0&&m.position.distanceTo(player)<3.3);for(const other of members)if(other!==m)other.revive=0;if(!m)return null;m.revive=held?m.revive+dt:Math.max(0,m.revive-dt);if(m.revive>=3){m.health=70;m.revive=0;m.collider.setEnabled(true);}return {name:m.name,progress:m.revive/3};},
  step(dt:number,time:number,player:THREE.Vector3,yaw:number,targets:SquadTarget[],blocked:(a:THREE.Vector3,b:THREE.Vector3)=>boolean,onFire:(target:SquadTarget,from:THREE.Vector3,to:THREE.Vector3)=>void){
   members.forEach((m,i)=>{
    if(m.health<=0){m.moving=false;return;}m.cooldown-=dt;m.firing=Math.max(0,m.firing-dt);
    const eye=m.position.clone().add(new THREE.Vector3(0,1.5,0));
    const target=targets.filter(t=>t.health>0&&t.position.distanceTo(m.position)<32).sort((a,b)=>a.position.distanceTo(m.position)-b.position.distanceTo(m.position)).find(t=>!blocked(eye,t.position.clone().add(new THREE.Vector3(0,1.2,0))));
    let destination=order==='hold'?holdPositions[i].clone():player.clone().add(new THREE.Vector3((i?1:-1)*3.2*Math.cos(yaw)+3*Math.sin(yaw),0,-(i?1:-1)*3.2*Math.sin(yaw)+3*Math.cos(yaw)));
    const dist=Math.hypot(destination.x-m.position.x,destination.z-m.position.z);const speed=dist>12?6.7:dist>4?4.8:3.1;
    let dx=destination.x-m.position.x,dz=destination.z-m.position.z;const len=Math.hypot(dx,dz)||1;
    // A short local detour keeps a follower from pressing indefinitely into cover.
    if(dist>2&&blocked(eye,eye.clone().add(new THREE.Vector3(dx/len*1.6,0,dz/len*1.6)))){const old=dx;dx=dz*(i?1:-1);dz=-old*(i?1:-1);}
    m.controller.computeColliderMovement(m.collider,{x:dist>1.8?dx/len*speed*dt:0,y:-.22,z:dist>1.8?dz/len*speed*dt:0});const move=m.controller.computedMovement(),p=m.body.translation();m.body.setNextKinematicTranslation({x:p.x+move.x,y:p.y+move.y,z:p.z+move.z});m.moving=Math.hypot(move.x,move.z)>.002;
    const facing=target?target.position:destination; if(target||dist>1.8)m.visual.group.rotation.y=Math.atan2(-(facing.x-m.position.x),-(facing.z-m.position.z));
    if(target&&m.cooldown<=0){m.cooldown=1.0+i*.25;m.firing=.14;onFire(target,eye,target.position.clone().add(new THREE.Vector3(0,1.25,0)));}
    if(!target)m.health=Math.min(100,m.health+dt*2);
   });
  },
  render(dt:number,time:number,player:THREE.Vector3){for(const m of members){const p=m.body.translation();m.position.set(p.x,p.y-.95,p.z);m.visual.group.position.copy(m.position);m.visual.group.visible=m.position.distanceTo(player)<125;m.visual.update(dt,{time,moving:m.moving,firing:m.firing>0,dead:m.health<=0});}},
 };
}
