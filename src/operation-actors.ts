import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {createEnemy} from './actors';
import {heightAt} from './region-layout.mjs';
/** Two rescued civilians reuse the bounded actor rig and capsule navigation. */
export function createOperationActors(scene:THREE.Scene,world:RAPIER.World){
 let initialized=false;
 const survivors=[-1,1].map(side=>{const visual=createEnemy(scene,{color:0xa7b8a1}),body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()),collider=world.createCollider(RAPIER.ColliderDesc.capsule(.6,.28),body),controller=world.createCharacterController(.025);controller.enableSnapToGround(.6);controller.enableAutostep(.4,.2,true);collider.setEnabled(false);visual.group.visible=false;return{side,visual,body,collider,controller};});
 const scorch=new THREE.MeshStandardMaterial({color:0x181c1b,roughness:1}),wrecks=[{x:326,z:-122},{x:321.2,z:-134}].map(p=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(2.3,.28,5.1),scorch);mesh.position.set(p.x,heightAt(p.x,p.z)+2.08,p.z);mesh.visible=false;scene.add(mesh);return mesh;});
 function stage(c:any){return c.operations?.['op-rescue']?.stage??0;}
 return {reset(){initialized=false;for(const s of survivors){s.collider.setEnabled(false);s.visual.group.visible=false;}},
 ready(c:any,target:any){return stage(c)!==2||survivors.every(s=>Math.hypot(s.visual.group.position.x-target.x,s.visual.group.position.z-target.z)<11);},
 update(c:any,p:THREE.Vector3,dt:number,time:number){const n=stage(c),active=c.contracts?.['op-rescue']==='active'&&n<3&&Math.hypot(p.x+175,p.z-140)<180;
  for(const mesh of wrecks)mesh.visible=(c.operations?.['op-sabotage']?.stage??0)>=3&&p.distanceTo(mesh.position)<200;
  if(active&&!initialized){for(const s of survivors){const x=-175+s.side*4,z=150,y=heightAt(x,z);s.body.setTranslation({x,y:y+.95,z},true);s.body.setNextKinematicTranslation({x,y:y+.95,z});s.visual.group.position.set(x,y,z);}initialized=true;}
  for(const s of survivors){s.visual.group.visible=active;s.collider.setEnabled(active);if(!active)continue;const old=s.body.translation(),x=p.x+s.side*1.8-old.x,z=p.z+3-old.z,d=Math.hypot(x,z),moving=n>=2&&d>3;
   s.controller.computeColliderMovement(s.collider,{x:moving?x/d*4*dt:0,y:-.25,z:moving?z/d*4*dt:0});const m=s.controller.computedMovement();s.body.setNextKinematicTranslation({x:old.x+m.x,y:old.y+m.y,z:old.z+m.z});s.visual.group.position.set(old.x,old.y-.95,old.z);if(moving)s.visual.group.rotation.y=Math.atan2(-x,-z);s.visual.update(dt,{time,moving,firing:false,dead:false,alert:false,crouching:n<2});
  }
 },snapshot(){return survivors.map(s=>({position:s.visual.group.position.toArray(),visible:s.visual.group.visible}));}};
}
