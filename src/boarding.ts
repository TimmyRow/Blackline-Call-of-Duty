import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {boardingStatus,rescuePrisoner} from './expedition-rules.mjs';
export const CORSAIR_ENGINE={x:-634,y:13,z:1155},CORSAIR_RESCUE={x:-650,y:10.7,z:1130};
export function createBoarding(scene:THREE.Scene,world:RAPIER.World){
 const group=new THREE.Group();scene.add(group);
 const engineMaterial=new THREE.MeshBasicMaterial({color:0xffac48,toneMapped:false});
 const engine=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.4,3,12),engineMaterial);engine.rotation.z=Math.PI/2;engine.position.copy(CORSAIR_ENGINE);group.add(engine);
 const rescue=new THREE.Group();rescue.position.set(CORSAIR_RESCUE.x,CORSAIR_RESCUE.y-.7,CORSAIR_RESCUE.z);group.add(rescue);
 const beacon=new THREE.Mesh(new THREE.OctahedronGeometry(.38),new THREE.MeshBasicMaterial({color:0x78e4ff,toneMapped:false}));beacon.position.y=1.6;rescue.add(beacon);
 const suit=new THREE.MeshStandardMaterial({color:0xe1b277,roughness:.9});
 const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.25,.65,3,6),suit);torso.position.y=.4;rescue.add(torso);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.18,8,6),suit);head.position.y=1;rescue.add(head);
 const stairs:THREE.BufferGeometry[]=[];const stairMaterial=new THREE.MeshStandardMaterial({color:0x72858a,metalness:.6,roughness:.6});
 for(let i=0;i<24;i++){const x=-650,y=(i+1)*.375,z=1227-i;stairs.push(new THREE.BoxGeometry(3,.2,1.15).translate(x,y-.1,z));world.createCollider(RAPIER.ColliderDesc.cuboid(1.5,.1,.575).setTranslation(x,y-.1,z));}
 const stairMesh=new THREE.Mesh(mergeGeometries(stairs),stairMaterial);stairs.forEach(g=>g.dispose());group.add(stairMesh);
 const exitLight=new THREE.Mesh(new THREE.OctahedronGeometry(.5),new THREE.MeshBasicMaterial({color:0x71dddf}));exitLight.position.set(-650,2,1227);group.add(exitLight);
 let hull=180,progress=0,sabotage=0;
 return {
  hit(origin:THREE.Vector3,direction:THREE.Vector3,distance:number,damage:number,c:any){if(c.boarding?.disabled)return null;const delta=new THREE.Vector3().copy(CORSAIR_ENGINE).sub(origin),along=delta.dot(direction);if(along<0||along>distance+2||delta.addScaledVector(direction,-along).length()>2.5)return null;hull=Math.max(0,hull-damage);if(hull===0){c.boarding??={};c.boarding.disabled=true;}return {position:new THREE.Vector3().copy(CORSAIR_ENGINE),disabled:hull===0};},
  step(dt:number,position:THREE.Vector3,held:boolean,guards:number,c:any){if(!c.boarding?.disabled&&position.distanceTo(engine.position)<4&&held){sabotage+=dt;if(sabotage>=3){c.boarding??={};c.boarding.disabled=true;sabotage=0;return 'disabled';}}else sabotage=0;const near=position.distanceTo(new THREE.Vector3().copy(CORSAIR_RESCUE))<4;
   if(!near||!held||guards>0||boardingStatus(c).stage!=='rescue'){progress=0;return false;}progress+=dt;if(progress<2)return false;progress=0;return rescuePrisoner(c,'corsair')?'rescued':false;},
  prompt(position:THREE.Vector3,guards:number,c:any){if(!c.boarding?.disabled&&position.distanceTo(engine.position)<5)return {text:'HOLD E · SABOTAGE PIRATE ENGINES',progress:sabotage/3};if(position.distanceTo(new THREE.Vector3().copy(CORSAIR_RESCUE))>5||boardingStatus(c).stage!=='rescue')return null;return {text:guards?'CLEAR THE DECK BEFORE FREEING THE PRISONER':'HOLD E · FREE PRISONER',progress:progress/2};},
  target(c:any){const status=boardingStatus(c);if(status.stage==='complete')return null;const p=status.stage==='disable'?CORSAIR_ENGINE:status.stage==='rescue'?CORSAIR_RESCUE:{x:-650,y:10.7,z:1140};return {id:'corsair-objective',name:status.label,x:p.x,z:p.z,elevation:p.y-1.7,kind:'pirate-ship',faction:'pirate',radius:5};},
  render(time:number,position:THREE.Vector3,c:any){group.visible=position.distanceTo(engine.position)<1800;engine.visible=true;rescue.visible=!!c.boarding?.disabled&&!(c.rescued??[]).includes('corsair');beacon.rotation.y=time;engineMaterial.color.setHex(c.boarding?.disabled?0x526066:0xffac48);},
  reset(){hull=180;progress=0;sabotage=0;},snapshot(c:any){return {hull:c.boarding?.disabled?0:hull,progress,...boardingStatus(c)};}
 };
}
