import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {heightAt,SEA_LEVEL} from './region-layout.mjs';

type HelmInput={keys:Set<string>,yaw:number,pitch:number};
const MOORING=new THREE.Vector3(289,SEA_LEVEL+.7,950),DECK=2.05;
/** A single bounded launch with a physical deck. Uncrewed vessels stop, so infantry can safely stand aboard. */
export function createMarine(scene:THREE.Scene,world:RAPIER.World){
 const group=new THREE.Group();group.name='Wayfarer boarding launch';scene.add(group);
 const position=MOORING.clone(),velocity=new THREE.Vector3();
 const metal=new THREE.MeshStandardMaterial({color:0x3e6469,roughness:.42,metalness:.7}),dark=new THREE.MeshStandardMaterial({color:0x17242b,roughness:.65,metalness:.5}),pale=new THREE.MeshStandardMaterial({color:0xa1aaa5,roughness:.55,metalness:.6}),amber=new THREE.MeshStandardMaterial({color:0xc79547,metalness:.6,roughness:.5}),light=new THREE.MeshBasicMaterial({color:0x77dbef,toneMapped:false});
 function box(parent:THREE.Object3D,size:number[],at:number[],mat:THREE.Material){const m=new THREE.Mesh(new THREE.BoxGeometry(...size as [number,number,number]),mat);m.position.set(...at as [number,number,number]);parent.add(m);return m;}
 box(group,[6,2.3,13],[0,.3,0],metal);box(group,[5.65,.18,12.6],[0,DECK-.09,0],pale);
 const prow=box(group,[5.9,1.9,3.4],[0,.2,-6],metal);prow.rotation.x=.22;
 box(group,[3.25,.8,1.5],[0,2.55,-3.5],dark);box(group,[2.75,.11,.95],[0,3.02,-3.7],amber);
 box(group,[3.7,.13,4.6],[0,4.35,-2.6],metal);
 for(const side of [-1,1]){for(const z of [-4.4,-.9])box(group,[.1,2.3,.1],[side*1.73,3.15,z],pale);box(group,[.12,.11,12],[side*2.8,3,0],pale);for(let z=-5;z<=5;z+=2.5)box(group,[.08,.94,.08],[side*2.8,2.5,z],pale);box(group,[.7,.7,1.3],[side*1.9,2.4,4.5],dark);box(group,[.2,.15,1.2],[side*1.72,4.42,-3.3],light);}
 for(let i=0;i<5;i++)box(group,[2.3,.035,.08],[0,DECK+.025,1.5+i*.7],amber);
 const compass=new THREE.Group();group.add(compass);compass.position.set(0,3.25,-3.7);box(compass,[.9,.12,.6],[0,0,0],dark);box(compass,[.64,.13,.05],[0,0,-.1],light);
 // Mooring stair reaches the existing carrier deck; it is outside the flight landing pad.
 const dock=new THREE.Group();dock.position.set(275,12,950);scene.add(dock);
 for(let i=0;i<20;i++){const x=i*.66+.3,y=-i*.46;box(dock,[.69,.16,2.7],[x,y,0],metal);world.createCollider(RAPIER.ColliderDesc.cuboid(.345,.08,1.35).setTranslation(275+x,12+y,950));}
 for(const side of [-1,1]){const rail=box(dock,[16.1,.07,.07],[6.5,-3.2,side*1.3],amber);rail.rotation.z=-.61;}
 const dockMarker=box(dock,[.18,2.6,.18],[-1,1.3,-1.8],amber);box(dockMarker,[.4,.2,.4],[0,1.4,0],light);
 // Batch the static fittings by material: the launch and dock add twelve draws, not one per bolt or step.
 function batch(root:THREE.Group){root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),byMaterial=new Map<THREE.Material,THREE.BufferGeometry[]>(),meshes:THREE.Mesh[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh&&!Array.isArray(o.material))meshes.push(o);});for(const mesh of meshes){const geometry=mesh.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld)),list=byMaterial.get(mesh.material as THREE.Material)??[];list.push(geometry);byMaterial.set(mesh.material as THREE.Material,list);mesh.removeFromParent();mesh.geometry.dispose();}for(const [material,geometries] of byMaterial){const geometry=mergeGeometries(geometries);if(geometry)root.add(new THREE.Mesh(geometry,material));geometries.forEach(g=>g.dispose());}}
 batch(group);batch(dock);
 const patrol=group.clone(true);patrol.name='Corsair coastal patrol';patrol.position.set(-500,SEA_LEVEL+.7,1060);patrol.traverse(o=>{if(o instanceof THREE.Mesh&&o.material===metal){o.material=metal.clone();o.material.color.setHex(0x713d3e);}});scene.add(patrol);
 const patrolBody=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(patrol.position.x,patrol.position.y,patrol.position.z));
 const patrolCollider=world.createCollider(RAPIER.ColliderDesc.cuboid(2.9,1.6,6.3).setTranslation(0,1.1,0),patrolBody);
 let patrolHealth=150,patrolTime=0,patrolCooldown=2;
 function stepPatrol(dt:number,player:THREE.Vector3,active:boolean,onShot:(a:THREE.Vector3,b:THREE.Vector3)=>void,onDamage:(n:number)=>void){if(patrolHealth<=0)return;const distance=patrol.position.distanceTo(player);if(distance>1400)return;patrolTime+=dt;patrolCooldown-=dt;const angle=patrolTime*.105,next=new THREE.Vector3(-500+Math.sin(angle)*75,SEA_LEVEL+.7,1060+Math.cos(angle)*75);if(heightAt(next.x,next.z)<SEA_LEVEL-2){const heading=Math.atan2(-(next.x-patrol.position.x),-(next.z-patrol.position.z));patrol.position.copy(next);patrol.rotation.y=heading;patrolBody.setNextKinematicTranslation(next);patrolBody.setNextKinematicRotation(new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP,heading));}
  if(active&&distance<150&&patrolCooldown<=0){patrolCooldown=2.2;const muzzle=patrol.position.clone().add(new THREE.Vector3(0,3.3,0)),delta=player.clone().sub(muzzle),range=delta.length();const obstruction=world.castRay(new RAPIER.Ray(muzzle,delta.normalize()),range,true,RAPIER.QueryFilterFlags.ONLY_FIXED);if(!obstruction){onShot(muzzle,player.clone());onDamage(4);}}
 }
 function hit(origin:THREE.Vector3,direction:THREE.Vector3,maxDistance=1400,damage=45){if(patrolHealth<=0)return null;const target=patrol.position.clone().add(new THREE.Vector3(0,2,0)),delta=target.sub(origin),along=delta.dot(direction);if(along<0||along>maxDistance||delta.addScaledVector(direction,-along).length()>7)return null;patrolHealth=Math.max(0,patrolHealth-Math.max(0,damage));if(patrolHealth<=0){patrol.visible=false;patrolCollider.setEnabled(false);}return {position:origin.clone().addScaledVector(direction,along),killed:patrolHealth<=0};}

 const body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x,position.y,position.z));
 body.userData={squadPlatform:true};
 const collider=world.createCollider(RAPIER.ColliderDesc.cuboid(2.9,.16,6.2).setTranslation(0,DECK-.16,0),body);
 world.createCollider(RAPIER.ColliderDesc.cuboid(1.6,.4,.7).setTranslation(0,2.55,-3.5),body);
 for(const side of [-1,1])world.createCollider(RAPIER.ColliderDesc.cuboid(.07,.46,6).setTranslation(side*2.8,2.51,0),body);
 const wakeMat=new THREE.MeshBasicMaterial({color:0xd2edf0,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
 const wake=new THREE.Mesh(new THREE.PlaneGeometry(12,36),wakeMat);wake.rotation.x=-Math.PI/2;wake.position.y=SEA_LEVEL+.12;scene.add(wake);
 let piloting=false,health=100,yaw=0,pitch=0,speed=0,lookYaw=0,travelled=0,collisions=0;
 const rotation=new THREE.Quaternion(),sweep=new RAPIER.Cuboid(3,1.1,6.6);
 const waterClear=(x:number,z:number,heading=yaw)=>[-6,0,6].every(d=>[-2.8,0,2.8].every(w=>heightAt(x-Math.sin(heading)*d+Math.cos(heading)*w,z-Math.cos(heading)*d-Math.sin(heading)*w)<SEA_LEVEL-1.6));
 function board(player:THREE.Vector3){const atDeck=player.distanceTo(position.clone().add(new THREE.Vector3(0,DECK+1,0)))<8;const atMooring=position.distanceTo(MOORING)<3&&player.distanceTo(new THREE.Vector3(275,13.7,950))<7;if(piloting||health<=0||(!atDeck&&!atMooring))return false;piloting=true;return true;}
 function tryExit(){if(!piloting||Math.abs(speed)>1.2)return null;piloting=false;speed=0;velocity.set(0,0,0);return new THREE.Vector3(0,DECK+1.7,3).applyAxisAngle(THREE.Object3D.DEFAULT_UP,yaw).add(position);}
 function step(dt:number,input:HelmInput){if(!piloting){speed=0;velocity.set(0,0,0);return;}lookYaw=input.yaw;pitch=THREE.MathUtils.clamp(input.pitch,-1.15,1.15);const throttle=Number(input.keys.has('KeyW'))-Number(input.keys.has('KeyS')),steer=Number(input.keys.has('KeyA'))-Number(input.keys.has('KeyD'));yaw+=steer*dt*(.4+Math.min(Math.abs(speed)/25,1)*.55);const target=health>0?throttle*(input.keys.has('ShiftLeft')?42:28):0;speed=THREE.MathUtils.damp(speed,target,throttle?1.1:2.5,dt);velocity.set(-Math.sin(yaw)*speed,0,-Math.cos(yaw)*speed);const delta=velocity.clone().multiplyScalar(dt),next=position.clone().add(delta);rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP,yaw);
  const hit=delta.lengthSq()>.000001?world.castShape(position.clone().add(new THREE.Vector3(0,1.2,0)),rotation,delta,sweep,.05,1,true,RAPIER.QueryFilterFlags.ONLY_FIXED):null;
  if(!waterClear(next.x,next.z)||hit){if(Math.abs(speed)>8)health=Math.max(0,health-Math.min(8,Math.abs(speed)*.12));collisions++;speed=0;velocity.set(0,0,0);}else{position.copy(next);travelled+=delta.length();}body.setNextKinematicTranslation(position);body.setNextKinematicRotation(rotation);
 }
 function render(_dt:number,time:number){group.position.copy(position);group.rotation.y=yaw;wake.position.set(position.x+Math.sin(yaw)*22,SEA_LEVEL+.12,position.z+Math.cos(yaw)*22);wake.rotation.z=-yaw;wake.scale.x=.65+Math.sin(time*5)*.08;wakeMat.opacity=Math.min(.19,Math.abs(speed)*.007);wake.visible=Math.abs(speed)>2;}
 function reset(){patrolHealth=150;patrolTime=0;patrolCooldown=2;patrol.visible=true;patrolCollider.setEnabled(true);patrol.position.set(-500,SEA_LEVEL+.7,1135);patrol.rotation.set(0,0,0);patrolBody.setTranslation(patrol.position,true);patrolBody.setNextKinematicTranslation(patrol.position);patrolBody.setRotation({x:0,y:0,z:0,w:1},true);patrolBody.setNextKinematicRotation({x:0,y:0,z:0,w:1});position.copy(MOORING);velocity.set(0,0,0);piloting=false;health=100;yaw=0;pitch=0;lookYaw=0;speed=0;travelled=0;collisions=0;body.setTranslation(position,true);body.setNextKinematicTranslation(position);body.setRotation({x:0,y:0,z:0,w:1},true);body.setNextKinematicRotation({x:0,y:0,z:0,w:1});render(0,0);}
 function restoreAt(saved:{x:number,y:number,z:number,yaw?:number}){const heading=saved.yaw??0;if(![saved.x,saved.y,saved.z,heading].every(Number.isFinite)||Math.abs(saved.y-(SEA_LEVEL+.7))>.5||!waterClear(saved.x,saved.z,heading))return false;const restored=new THREE.Vector3(saved.x,SEA_LEVEL+.7,saved.z),orientation=new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP,heading);if(world.intersectionWithShape(restored.clone().add(new THREE.Vector3(0,1.2,0)),orientation,sweep,RAPIER.QueryFilterFlags.ONLY_FIXED))return false;position.copy(restored);velocity.set(0,0,0);yaw=heading;lookYaw=heading;pitch=0;speed=0;piloting=false;health=100;body.setTranslation(position,true);body.setNextKinematicTranslation(position);body.setRotation(orientation,true);body.setNextKinematicRotation(orientation);render(0,0);return true;}
 function setPatrolDefeated(defeated:boolean){patrolHealth=defeated?0:150;patrol.visible=!defeated;patrolCollider.setEnabled(!defeated);}
 reset();return {position,velocity,group,collider,get piloting(){return piloting;},get health(){return health;},get landed(){return Math.abs(speed)<1.2;},board,tryBoard:board,tryExit,exitPosition:tryExit,step,update:step,render,reset,restoreAt,setPatrolDefeated,stepPatrol,hit,
  nearbyPrompt(player:THREE.Vector3){return !piloting&&health>0&&(player.distanceTo(position.clone().add(new THREE.Vector3(0,DECK+1,0)))<8||(position.distanceTo(MOORING)<3&&player.distanceTo(new THREE.Vector3(275,13.7,950))<7))?'F — PILOT WAYFARER LAUNCH':null;},
  cameraPose(){return {position:new THREE.Vector3(0,3.75,-1.7).applyAxisAngle(THREE.Object3D.DEFAULT_UP,yaw).add(position),yaw:lookYaw,pitch};},
  hurt(amount:number){health=Math.max(0,health-Math.max(0,amount));},repair(amount=100){health=Math.min(100,health+Math.max(0,amount));},
  snapshot(){return {piloting,health:Math.round(health),position:position.toArray(),speed:Math.round(Math.abs(speed)),yaw,travelled:Math.round(travelled),collisionCount:collisions,deckY:position.y+DECK,mooring:MOORING.toArray(),patrol:{position:patrol.position.toArray(),health:patrolHealth,alive:patrolHealth>0},controls:'W/S throttle · A/D rudder · SHIFT full power · F leave helm when stopped'};}
 };
}
