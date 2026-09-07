import * as THREE from 'three';
import {createEnemy} from './actors';
import {QUEST_PEOPLE} from './quest-data.mjs';
import {heightAt} from './region-layout.mjs';
import {personAvailable} from './story-quests.mjs';
/** Six persistent residents; only nearby people render. They never enter enemy pools. */
export function createQuestPeople(scene:THREE.Scene){
 const template=createEnemy(scene,{color:0x829599});template.group.removeFromParent();
 const residents=QUEST_PEOPLE.map((person,index)=>{
  const root=template.group.clone(true),body=root.children[0] as THREE.Group;root.name=person.name;root.position.set(person.x,heightAt(person.x,person.z),person.z);scene.add(root);
  const materials=new Map<THREE.Material,THREE.Material>();root.traverse(o=>{if(o instanceof THREE.Mesh&&!Array.isArray(o.material)){let material=materials.get(o.material);if(!material){material=o.material.clone();if(material instanceof THREE.MeshStandardMaterial)material.color.lerp(new THREE.Color(person.color),.20);materials.set(o.material,material!);}o.material=material!;o.castShadow=false;}});
  const tablet=new THREE.Mesh(new THREE.BoxGeometry(.30,.20,.025),new THREE.MeshStandardMaterial({color:0x19373f,emissive:0x265c65,emissiveIntensity:.25}));tablet.position.set(0,1.19,-.44);tablet.rotation.x=-.3;body.add(tablet);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d')!;ctx.fillStyle='rgba(5,22,29,.86)';ctx.fillRect(0,0,512,128);ctx.textAlign='center';ctx.fillStyle='#f2ca87';ctx.font='bold 44px sans-serif';ctx.fillText(person.name,256,51);ctx.fillStyle='#d1e7e4';ctx.font='32px sans-serif';ctx.fillText(person.role,256,100);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:true,transparent:true}));label.position.y=2.35;label.scale.set(3.8,.95,1);root.add(label);
  const marker=new THREE.Mesh(new THREE.OctahedronGeometry(.13),new THREE.MeshBasicMaterial({color:0xf2c67b}));marker.position.y=2.98;root.add(marker);
  return {person,root,body,label,marker,index};
 });
 let progress=0,lastId='';
 function nearest(position:THREE.Vector3,c:any,blocked:(a:THREE.Vector3,b:THREE.Vector3)=>boolean){return residents.find(r=>personAvailable(r.person,c)&&position.distanceTo(r.root.position.clone().add(new THREE.Vector3(0,1.6,0)))<3.3&&!blocked(position,r.root.position.clone().add(new THREE.Vector3(0,1.65,0))));}
 return {
  nearby(position:THREE.Vector3,c:any,blocked:(a:THREE.Vector3,b:THREE.Vector3)=>boolean){const r=nearest(position,c,blocked);return r?{id:r.person.id,name:r.person.name,progress}:null;},
  step(dt:number,position:THREE.Vector3,held:boolean,c:any,blocked:(a:THREE.Vector3,b:THREE.Vector3)=>boolean){const r=nearest(position,c,blocked);if(!held||!r||r.person.id!==lastId){progress=0;lastId=r?.person.id??'';}if(!held||!r)return null;progress+=dt;if(progress<.45)return null;progress=0;return r.person.id;},
  reset(){progress=0;lastId='';},
  render(time:number,position:THREE.Vector3,c:any){for(const r of residents){const distance=r.root.position.distanceTo(position);r.root.visible=distance<180&&personAvailable(r.person,c);if(!r.root.visible)continue;r.body.position.y=Math.sin(time*1.2+r.index)*.007;if(distance<12)r.body.rotation.y=Math.atan2(r.root.position.x-position.x,r.root.position.z-position.z);r.label.visible=distance<24;r.label.scale.set(Math.max(1,distance*.32),Math.max(.25,distance*.08),1);r.marker.visible=distance<48&&(r.person.id==='mara'&&!c.story.finished||r.person.quests.some(id=>!c.contracts[id]));r.marker.rotation.y=time*.6;}}
 };
}
