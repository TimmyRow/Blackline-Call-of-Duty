import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {heightAt,getWorldSites,getLandingPads,worldHash,REGION_START} from './region-layout.mjs';

type Site=ReturnType<typeof getWorldSites>[number];
type Loaded={group:THREE.Group;colliders:RAPIER.Collider[];meshes:THREE.Object3D[];geometries:THREE.BufferGeometry[]};
const CHUNK=256, RANGE=3;

/** Bounded streaming cache: distant discoveries are generated from coordinates, never accumulated. */
export function buildRegion(scene:THREE.Scene,world:RAPIER.World,occluders:THREE.Object3D[]){
 const chunks=new Map<string,Loaded>(),sites=new Map<string,Loaded>();
 const completed=new Set<string>(),signals=new Map<string,THREE.Mesh>();
 const sharedBox=new THREE.BoxGeometry(1,1,1),rockGeo=new THREE.IcosahedronGeometry(1,1),treeGeo=mergeGeometries([new THREE.ConeGeometry(1,.7,9).translate(0,-.15,0),new THREE.ConeGeometry(.76,.65,9).translate(0,.12,0),new THREE.ConeGeometry(.49,.6,9).translate(0,.38,0),new THREE.CylinderGeometry(.07,.1,.6,6).translate(0,-.35,0)]);
 function texture(){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d')!;ctx.fillStyle='#b8b4a5';ctx.fillRect(0,0,256,256);for(let i=0;i<19000;i++){const n=worldHash(i,42);ctx.fillStyle=`rgba(${40+n*180},${43+n*180},${40+n*180},.24)`;ctx.fillRect(worldHash(i,1)*256,worldHash(i,2)*256,.5+worldHash(i,3)*2,1+worldHash(i,4)*3);}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;return t;}
 const grit=texture();
 const terrainMat=new THREE.MeshStandardMaterial({vertexColors:true,map:grit,bumpMap:grit,bumpScale:.22,roughness:.96});
 const steel=new THREE.MeshStandardMaterial({color:'#60767e',map:grit,metalness:.7,roughness:.45});
 const dark=new THREE.MeshStandardMaterial({color:'#263944',map:grit,metalness:.65,roughness:.53});
 const wall=new THREE.MeshStandardMaterial({color:'#c0bbaa',map:grit,roughness:.85,metalness:.08});
 const rust=new THREE.MeshStandardMaterial({color:'#a45b3b',map:grit,metalness:.3,roughness:.7});
 const glass=new THREE.MeshStandardMaterial({color:'#1a4656',metalness:.8,roughness:.17});
 const cyan=new THREE.MeshStandardMaterial({color:'#92e3ef',emissive:'#47c4d8',emissiveIntensity:2});
 const amber=new THREE.MeshStandardMaterial({color:'#efb86c',emissive:'#e8943c',emissiveIntensity:1.25});
 const plantMat=new THREE.MeshStandardMaterial({color:'#53695c',roughness:1});
 const rockMat=new THREE.MeshStandardMaterial({color:'#77796c',map:grit,roughness:.98});
 const ground=new THREE.Color(),sand=new THREE.Color('#aeb498'),green=new THREE.Color('#53695b'),stone=new THREE.Color('#7c8987'),snow=new THREE.Color('#b2c5bf');
 function load():Loaded{const group=new THREE.Group();scene.add(group);return{group,colliders:[],meshes:[],geometries:[]};}
 function remove(data:Loaded){scene.remove(data.group);for(const c of data.colliders)world.removeCollider(c,true);for(const mesh of data.meshes){const i=occluders.indexOf(mesh);if(i>=0)occluders.splice(i,1);}data.group.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});for(const g of data.geometries)g.dispose();}
 function collider(data:Loaded,x:number,y:number,z:number,w:number,h:number,d:number){data.colliders.push(world.createCollider(RAPIER.ColliderDesc.cuboid(w/2,h/2,d/2).setTranslation(x,y,z).setFriction(.85)));}
 function terrain(cx:number,cz:number){
  const data=load(),size=CHUNK,segments=32,g=new THREE.PlaneGeometry(size,size,segments,segments);g.rotateX(-Math.PI/2);const p=g.attributes.position,colors=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){const x=p.getX(i)+(cx+.5)*size,z=p.getZ(i)+(cz+.5)*size,y=heightAt(x,z);p.setXYZ(i,x,y,z);g.attributes.uv.setXY(i,x/7,z/7);const slope=Math.hypot(heightAt(x+2,z)-y,heightAt(x,z+2)-y)/2;ground.copy(green).lerp(stone,Math.min(1,slope*1.4));ground.lerp(sand,1-THREE.MathUtils.smoothstep(y,1,13));ground.lerp(snow,THREE.MathUtils.smoothstep(y,90,160)*.7);ground.multiplyScalar(.92+.09*Math.sin(x*.031)*Math.cos(z*.039));colors.set([ground.r,ground.g,ground.b],i*3);}
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.computeVertexNormals();const mesh=new THREE.Mesh(g,terrainMat);mesh.receiveShadow=true;data.group.add(mesh);data.meshes.push(mesh);data.geometries.push(g);occluders.push(mesh);
  data.colliders.push(world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(p.array),new Uint32Array(g.index!.array)).setFriction(.95)));
  const nearby=getWorldSites((cx+.5)*CHUNK,(cz+.5)*CHUNK,240),rocks:THREE.Matrix4[]=[],plants:THREE.Matrix4[]=[],dummy=new THREE.Object3D();
  for(let i=0;i<100;i++){const x=(cx+worldHash(cx,cz,i*2+9))*CHUNK,z=(cz+worldHash(cx,cz,i*2+10))*CHUNK,y=heightAt(x,z);if(y<2||nearby.some(s=>Math.hypot(x-s.x,z-s.z)<s.radius+15)||Math.hypot(x-REGION_START.x,z-REGION_START.z)<45)continue;
   const rock=i%3===0,h=rock?1.2+worldHash(cx,cz,i+400)*5:3+worldHash(cx,cz,i+700)*9;dummy.position.set(x,y+h*(rock?.32:.62),z);dummy.rotation.set(rock?.2:0,worldHash(cx,cz,i+900)*6.28,rock?.12:0);dummy.scale.set(rock?h*.8:h*.4,h,rock?h*.7:h*.4);dummy.updateMatrix();(rock?rocks:plants).push(dummy.matrix.clone());
  }
  for(const [geometry,material,matrices] of [[rockGeo,rockMat,rocks],[treeGeo,plantMat,plants]] as const){if(!matrices.length)continue;const m=new THREE.InstancedMesh(geometry,material,matrices.length);matrices.forEach((t,i)=>m.setMatrixAt(i,t));m.receiveShadow=true;m.computeBoundingSphere();data.group.add(m);}
  return data;
 }
 function structure(s:Site){
  const data=load(),batches=new Map<THREE.Material,THREE.Matrix4[]>(),dummy=new THREE.Object3D();
  const x=s.x,z=s.z,y=s.elevation;
  function block(a:number,b:number,c:number,w:number,h:number,d:number,m:THREE.Material,solid=true){dummy.position.set(x+a,y+b,z+c);dummy.scale.set(w,h,d);dummy.rotation.set(0,0,0);dummy.updateMatrix();const list=batches.get(m)||[];list.push(dummy.matrix.clone());batches.set(m,list);if(solid)collider(data,x+a,y+b,z+c,w,h,d);}
  function building(a:number,c:number,w=18,d=14,h=7){block(a,-.13,c,w,.3,d,dark);block(a,h/2,c-d/2,w,h,.55,wall);block(a-w/2,h/2,c,.55,h,d,wall);block(a+w/2,h/2,c,.55,h,d,wall);block(a-w*.33,h/2,c+d/2,w*.33,h,.55,wall);block(a+w*.33,h/2,c+d/2,w*.33,h,.55,wall);block(a,h-.2,c+d/2,w*.35,.8,.6,steel);block(a,h,c,w+1,.5,d+1,steel);block(a,h+.5,c-2,w*.6,.55,3,dark);for(const side of [-1,1]){block(a+side*w*.3,3.5,c+d/2+.3,w*.19,1.7,.08,glass,false);block(a+side*w*.3,4.6,c+d/2+.4,w*.19,.08,.12,cyan,false);}block(a,4.8,c+d/2+.4,3,.12,.12,amber,false);for(const side of [-1,1]){block(a+side*(w/2+.15),h*.5,c+d/2+.25,.35,h,.4,steel,false);block(a+side*(w/2+.15),h*.5,c-d/2-.25,.35,h,.4,steel,false);block(a+side*(w/2+.15),h-1.3,c,.2,.55,d,rust,false);}block(a,h+.45,c+d/2,w+.6,.4,.4,dark,false);for(let i=-1;i<=1;i++)block(a+i*w*.25,h+.4,c-2,.15,.15,d*.6,dark,false);}
  function pad(a:number,c:number,r:number){block(a,.08,c,r*2,.16,r*2,dark);for(const side of [-1,1]){block(a+side*(r-1),.18,c,.3,.035,r*1.8,amber,false);block(a,.18,c+side*(r-1),r*1.8,.035,.3,amber,false);}block(a-2,.19,c,.5,.03,7,wall,false);block(a+2,.19,c,.5,.03,7,wall,false);block(a,.19,c,4,.03,.5,wall,false);}
  if(s.kind==='carrier'||s.kind==='pirate-ship'){
   const friendly=s.kind==='carrier',length=friendly?154:128,w=70;
   const hullShape=new THREE.Shape();hullShape.moveTo(-w*.45,length*.46);hullShape.lineTo(w*.45,length*.46);hullShape.lineTo(w*.47,-length*.25);hullShape.lineTo(0,-length*.64);hullShape.lineTo(-w*.47,-length*.25);hullShape.closePath();const hullGeo=new THREE.ExtrudeGeometry(hullShape,{depth:9,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:1.5,bevelThickness:1.5});hullGeo.rotateX(Math.PI/2);const hull=new THREE.Mesh(hullGeo,dark);hull.position.set(x,y-2,z);hull.castShadow=true;data.group.add(hull);data.geometries.push(hullGeo);data.meshes.push(hull);occluders.push(hull);block(0,-4.5,0,w-8,8,length-10,dark);block(0,-.65,0,w,1.3,length,steel);block(0,-8,0,w*.7,6,length*.87,dark);
   // The open flight deck is intentionally continuous, with actual deck-height colliders.
   building(-22,-35,20,30,18);block(-22,14.5,-19,21,3,.35,glass,false);block(-22,26,-39,1.3,15,1.3,steel);block(-22,29,-39,18,.65,1.6,wall);building(23,-43,18,21,8);
   for(let i=-3;i<=3;i++)for(const side of [-1,1]){block(side*(w/2-1),.55,i*20,.5,1.1,4,dark);block(side*(w/2-.7),1.2,i*20,.3,.2,3,friendly?cyan:amber,false);}
   pad(0,friendly?20:18,friendly?20:16);for(const a of [-24,24])block(a,1.5,48,7,3,9,rust);
   for(const side of [-1,1])block(side*32,-3.5,0,.3,.6,length*.78,friendly?cyan:amber,false);
  }else if(s.kind==='station'){
   block(0,-2,0,204,4,156,dark);block(0,-6,0,176,6,134,steel);pad(0,28,26);building(-66,-18,45,74,22);building(66,-18,45,74,22);building(0,-52,80,28,15);
   for(const side of [-1,1]){block(side*98,2,0,2,4,150,steel);block(side*98,4.2,0,.5,.4,146,cyan,false);block(side*148,-7,-8,70,1.3,100,dark);for(let i=-3;i<=3;i++)block(side*148,-6.2,i*13,66,.15,.5,cyan,false);block(side*89,38,-51,6,75,6,steel);block(side*89,75,-51,7,.7,7,amber,false);}
   block(0,2,-76,200,4,2,steel);block(0,2,76,200,4,2,steel);for(let i=-2;i<=2;i++)block(i*27,15,-64,2,30,2,steel);
  }else if(s.kind==='ruin'){
   for(let i=0;i<7;i++){const angle=i/7*Math.PI*2;block(Math.cos(angle)*24,6+(i%3)*2,Math.sin(angle)*24,5,12+(i%3)*4,5,steel);}
   block(-18,16,-18,31,2,4,wall);block(22,4,5,11,8,7,dark);pad(0,35,13);
  }else{
   building(-38,-26,s.kind==='outpost'?26:18,20,s.kind==='outpost'?10:7);building(36,-30,20,24,8);building(-37,31,21,18,7);building(39,34,18,22,8);
   for(const a of [-20,20])for(const c of [-20,18]){block(a,1.35,c,5,2.7,3.2,rust);block(a,2.8,c,5.15,.2,3.35,steel,false);}
   block(0,13,-48,2.1,26,2.1,dark);for(const a of [-1,1])block(a*5,18,-48,7,.6,3,steel);block(0,26.5,-48,2,.4,2,amber,false);
   if(s.id==='relay'){block(0,31,-48,22,.8,5,wall);block(0,34,-48,1,6,1,steel);}
   pad(0,35,13);for(const a of [-59,59]){block(a,2.3,0,.8,4.6,17,wall);block(a,4.8,0,1,.3,18,rust);}
  }
  // An obvious recoverable locker marks the on-foot interaction, separate from the landing pad.
  block(0,.7,-3,2.4,1.4,1.3,dark);block(0,1.5,-3,2.5,.18,1.4,steel);
  const lamp=new THREE.Mesh(sharedBox,completed.has(s.id)?cyan:amber);lamp.scale.set(1.8,.11,.08);lamp.position.set(x,y+1.3,z-2.3);data.group.add(lamp);signals.set(s.id,lamp);
  for(const [material,matrices]of batches){const mesh=new THREE.InstancedMesh(sharedBox,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.receiveShadow=true;mesh.castShadow=material!==cyan&&material!==amber;mesh.computeBoundingSphere();data.group.add(mesh);data.meshes.push(mesh);occluders.push(mesh);}
  data.group.name=s.name;return data;
 }
 // A coarse apron extends the visible continent beyond the detailed collision window.
 const horizonGeometry=new THREE.PlaneGeometry(20000,20000,96,96);horizonGeometry.rotateX(-Math.PI/2);
 const horizon=new THREE.Mesh(horizonGeometry,new THREE.MeshStandardMaterial({color:'#566d67',roughness:1}));horizon.receiveShadow=false;scene.add(horizon);let horizonCell='';
 function updateHorizon(x:number,z:number){const cx=Math.floor(x/1024)*1024,cz=Math.floor(z/1024)*1024,key=`${cx}:${cz}`;if(key===horizonCell)return;horizonCell=key;const p=horizonGeometry.attributes.position;for(let i=0;i<p.count;i++){const lx=(i%97)/96*20000-10000,lz=Math.floor(i/97)/96*20000-10000;p.setXYZ(i,cx+lx,heightAt(cx+lx,cz+lz)-30,cz+lz);}p.needsUpdate=true;horizonGeometry.computeVertexNormals();horizonGeometry.computeBoundingSphere();}
 let current='';
 function sync(position:{x:number;y?:number;z:number}){
  const cx=Math.floor(position.x/CHUNK),cz=Math.floor(position.z/CHUNK),key=`${cx}:${cz}`;if(key===current)return;current=key;
  const wanted=new Set<string>();for(let dx=-RANGE;dx<=RANGE;dx++)for(let dz=-RANGE;dz<=RANGE;dz++)wanted.add(`${cx+dx}:${cz+dz}`);
  for(const[k,c]of chunks)if(!wanted.has(k)){remove(c);chunks.delete(k);}
  const cells=[...wanted].sort((a,b)=>{const[ax,az]=a.split(':').map(Number),[bx,bz]=b.split(':').map(Number);return Math.hypot(ax-cx,az-cz)-Math.hypot(bx-cx,bz-cz);});
  for(const k of cells)if(!chunks.has(k)){const[a,b]=k.split(':').map(Number);chunks.set(k,terrain(a,b));}
  const discovered=getWorldSites(position.x,position.z,1650),active=new Set(discovered.map(s=>s.id));
  for(const[k,s]of sites)if(!active.has(k)){remove(s);sites.delete(k);signals.delete(k);}
  for(const site of discovered)if(!sites.has(site.id))sites.set(site.id,structure(site));
  updateHorizon(position.x,position.z);
 }
 // Landing platform is part of the same streamed site system but has no mission gate.
 const start=load(),startPad=getLandingPads(REGION_START.x,REGION_START.z,30)[0];
 const platform=new THREE.Mesh(new THREE.CylinderGeometry(17,17,.16,48),steel);platform.position.set(startPad.x,16.08,startPad.z);start.group.add(platform);start.geometries.push(platform.geometry);start.colliders.push(world.createCollider(RAPIER.ColliderDesc.cylinder(.08,17).setTranslation(startPad.x,16.08,startPad.z)));
 return{sync,setSiteComplete(id:string,done:boolean){if(done)completed.add(id);else completed.delete(id);const signal=signals.get(id);if(signal)signal.material=done?cyan:amber;},stats(){return{terrainChunks:chunks.size,loadedSites:sites.size,colliders:[...chunks.values(),...sites.values()].reduce((n,c)=>n+c.colliders.length,0),chunkSize:CHUNK,streamRadius:RANGE*CHUNK,procedural:true};}};
}
