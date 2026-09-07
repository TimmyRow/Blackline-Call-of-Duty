import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {heightAt} from './region-layout.mjs';
import {CRASHFALL_RALLY} from './opening-mission.mjs';

/** Short in-world arrival. Simulation stays suspended until the operator leaves the wreck. */
export function createOpening(scene:THREE.Scene,camera:THREE.Camera,world:RAPIER.World){
 const ground=heightAt(0,220),exit=new THREE.Vector3(0,heightAt(0,231)+1.7,231);
 const hull=new THREE.MeshStandardMaterial({color:0x49595b,metalness:.7,roughness:.65}),dark=new THREE.MeshStandardMaterial({color:0x17242a,metalness:.65,roughness:.6}),glow=new THREE.MeshBasicMaterial({color:0xff7544,toneMapped:false}),cyan=new THREE.MeshBasicMaterial({color:0x64dbef,toneMapped:false});
 const wreck=new THREE.Group();wreck.position.set(0,ground,220);scene.add(wreck);
 const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
 function part(size:number[],at:number[],material:THREE.Material,roll=0){const g=new THREE.BoxGeometry(...size as [number,number,number]);g.rotateZ(roll);g.translate(...at as [number,number,number]);const a=batches.get(material)||[];a.push(g);batches.set(material,a);}
 part([8,.4,17],[0,.15,0],dark);part([.5,3,15],[-4,1.5,0],hull,.1);part([.5,2.5,10],[4,1.2,2],hull,-.18);part([4,.4,11],[-6,1.4,-1],hull,.23);part([5,.4,7],[6,.4,-3],hull,-.18);
 for(let i=0;i<5;i++){part([.18,3, .25],[-3.5,1.5,-6+i*3],glow);part([.16,1.4,.3],[3.6,.7,-6+i*3],dark);}
 for(let i=0;i<12;i++){const a=i*2.4,r=8+i*.55;part([1+i%3,.22,1.6],[Math.cos(a)*r,.1,Math.sin(a)*r],i%3?dark:hull,a);}
 part([1.6,.8,1.4],[0,.55,-14],dark);part([1.2,.15,1],[0,1.02,-14],cyan);
 // A visible rally and waist-high cover, batched into the existing wreck materials.
 const rally=CRASHFALL_RALLY,ry=rally.elevation-ground,rz=rally.z-220;
 for(const side of [-1,1]){part([2.2,.9,1],[rally.x+side*3.4,ry+.45,rz-2],hull);part([1.8,.06,.08],[rally.x+side*3.4,ry+.93,rz-2.5],cyan);world.createCollider(RAPIER.ColliderDesc.cuboid(1.1,.45,.5).setTranslation(rally.x+side*3.4,rally.elevation+.45,rally.z-2));}
 part([.14,2,.14],[rally.x,ry+1,rz],dark);part([.32,.4,.32],[rally.x,ry+2.05,rz],cyan);part([1,.45,.8],[rally.x,ry+.225,rz+1.5],dark);
 for(const [mat,geometries]of batches){const merged=mergeGeometries(geometries);const m=new THREE.Mesh(merged,mat);m.castShadow=true;m.receiveShadow=true;wreck.add(m);geometries.forEach(g=>g.dispose());}
 for(const x of [-4.8,4.8]){const engine=new THREE.Mesh(new THREE.CylinderGeometry(1.25,1.1,3.8,12,1,true),dark);engine.rotation.x=Math.PI/2;engine.position.set(x,1.3,5);wreck.add(engine);const rim=new THREE.Mesh(new THREE.TorusGeometry(1.1,.13,6,16),hull);rim.position.set(x,1.3,7);wreck.add(rim);}
 for(const x of [-4,4])world.createCollider(RAPIER.ColliderDesc.cuboid(.3,1.4,6).setTranslation(x,ground+1.4,220));
 const cockpit=new THREE.Group();camera.add(cockpit);cockpit.visible=false;
 function cab(size:number[],at:number[],mat:THREE.Material,roll=0){const m=new THREE.Mesh(new THREE.BoxGeometry(...size as [number,number,number]),mat);m.position.set(...at as [number,number,number]);m.rotation.z=roll;cockpit.add(m);}
 cab([3.5,.6,1], [0,-1.05,-1.8],dark);cab([3.4,.13,.16],[0,1.1,-2],hull);
 for(const side of [-1,1]){cab([.14,2.6,.2],[side*1.35,0,-2],hull,-side*.2);cab([.55,.15,.4],[side*.72,-.69,-1.55],dark);}
 cab([.7,.08,.36],[0,-.68,-1.52],dark);
 const panel=document.createElement('canvas');panel.width=512;panel.height=256;const ctx=panel.getContext('2d')!,texture=new THREE.CanvasTexture(panel);texture.colorSpace=THREE.SRGBColorSpace;const panelMaterial=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});
 for(const side of [-1,1]){const screen=new THREE.Mesh(new THREE.PlaneGeometry(.72,.36),panelMaterial);screen.position.set(side*.72,-.54,-1.3);screen.rotation.x=-.2;cockpit.add(screen);for(let i=0;i<4;i++)cab([.04,.025,.08],[side*.72-.15+i*.1,-.76,-1.25],i===3?glow:cyan);}
 let panelTick=-1;function instruments(y:number){const tick=Math.floor(time*8);if(tick===panelTick)return;panelTick=tick;ctx.fillStyle='#071c25';ctx.fillRect(0,0,512,256);ctx.strokeStyle='#20515e';for(let x=0;x<512;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,256);ctx.stroke();}for(let y=0;y<256;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();}ctx.fillStyle=time<6?'#8ee3ed':'#ffab68';ctx.font='20px monospace';ctx.fillText('ORISON / DESCENT CONTROL',20,32);ctx.font='bold 52px monospace';ctx.fillText(Math.round(y)+' M',20,105);ctx.font='19px monospace';ctx.fillText(time<6?'VECTOR 000 / COASTAL APPROACH':'WARNING / MAIN ENGINE FAILURE',20,156);ctx.fillStyle='#7dd9df';ctx.fillRect(20,186,Math.max(8,440*(1-time/15)),7);ctx.font='16px monospace';ctx.fillText('TRANSPORT 07        KESTREL / DETACH',20,232);texture.needsUpdate=true;}
 
 const overlay=document.createElement('div');overlay.id='arrival';overlay.hidden=true;overlay.innerHTML='<div class="arrival-copy"><small>BLACKLINE / FIRST CONTACT</small><h2></h2><p></p></div><span class="arrival-skip">SPACE · SKIP ARRIVAL</span><div class="arrival-flash"></div>';document.getElementById('app')!.append(overlay);
 let active=false,time=0,impact=false;
 function begin(){active=true;time=0;impact=false;cockpit.visible=true;overlay.hidden=false;}
 function finish(){active=false;cockpit.visible=false;overlay.hidden=true;return exit.clone();}
 function step(dt:number){if(!active)return {done:false,impact:false};time+=dt;const fall=THREE.MathUtils.smoothstep(time,5,13),y=THREE.MathUtils.lerp(350-Math.min(time,5)*2,ground+2.5,fall),z=THREE.MathUtils.lerp(730-Math.min(time,5)*12,220,fall);camera.position.set(Math.sin(time*19)*(time>6?.11:.015),y,z);instruments(y);camera.rotation.set(-.38+Math.sin(time*23)*(time>6?.018:.002),0,Math.sin(time*3)*(time>6?.04:.004),'YXZ');
 overlay.querySelector('h2')!.textContent=time<5?'A new world below.':time<10?'They found us.':time<13?'Brace for impact.':'Signal lost.';
 overlay.querySelector('p')!.textContent=time<5?'Vale: Coast looks quiet. We’ll find a place to land.':time<10?'Rook: Missile warning! Kestrel has detached. Hold on!':time<13?'Vale: Main engines gone. Taking her down in the clearing.':'Rook: You still with us? Get out. We need that ship.';
 (overlay.querySelector('.arrival-flash') as HTMLElement).style.opacity=String(time>13?Math.min(1,(time-13)*2):0);
 const hit=!impact&&time>=12.8;if(hit)impact=true;return {done:time>=15,impact:hit};}
 return {begin,finish,step,exit,get active(){return active;},get time(){return time;},setPaused(paused:boolean){overlay.hidden=!active||paused;cockpit.visible=active&&!paused;},snapshot(){return {active,time,exit:exit.toArray()};}};
}
