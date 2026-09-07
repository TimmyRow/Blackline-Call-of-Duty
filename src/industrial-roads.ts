import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {heightAt,worldHash} from './region-layout.mjs';

type Point={x:number;z:number};
type Route={name:string;width:number;points:Point[]};
const controls:[string,number,number[][]][]=[
 ['Port Astra highway',9,[[-690,-540],[-690,-640],[-800,-725],[-900,-790],[-1030,-830],[-1120,-880],[-1120,-940]]],
 ['Astra civic avenue',10,[[-1120,-940],[-1120,-975],[-1120,-1030],[-1120,-1105]]],
 ['Astra market ring',7,[[-1120,-940],[-1215,-940],[-1215,-1120],[-1025,-1120],[-1025,-940],[-1120,-940]]],
 ['Colonial freight road',9,[[0,150],[-19,128],[-24,103],[-17,85],[0,67],[0,34],[0,-10],[0,-61]]],
 ['Landing approach',7,[[0,92],[0,80],[0,67]]],
 ['Northwatch highway',8.5,[[0,70],[-58,69.5],[-115,43],[-193,2],[-260,-67],[-309,-167],[-393,-247],[-503,-286],[-598,-373],[-690,-465],[-690,-540]]],
 ['Tidebreak highway',8.5,[[0,70],[58,72],[121,25],[227,-24],[326,-122],[434,-174],[557,-186],[686,-248],[780,-301],[780,-370]]],
 ['Harbour service loop',6,[[0,38],[-59,37],[-67,14],[-67,-50],[-40,-66],[0,-61],[52,-65],[67,-43],[67,8],[55,38],[0,38]]]
];
export const INDUSTRIAL_ROUTES:Route[]=controls.map(([name,width,p])=>{
 const curve=new THREE.CatmullRomCurve3(p.map(([x,z])=>new THREE.Vector3(x,0,z)),false,'centripetal');
 return{name,width,points:curve.getSpacedPoints(Math.ceil(curve.getLength()/1)).map(v=>({x:v.x,z:v.z}))};
});
const roadBins=new Map<string,{a:Point;b:Point;width:number;owner:string}[]>();
for(const r of INDUSTRIAL_ROUTES)for(let i=1;i<r.points.length;i++){
 const a=r.points[i-1],b=r.points[i],padding=r.width/2+12;
 for(let x=Math.floor((Math.min(a.x,b.x)-padding)/64);x<=Math.floor((Math.max(a.x,b.x)+padding)/64);x++)for(let z=Math.floor((Math.min(a.z,b.z)-padding)/64);z<=Math.floor((Math.max(a.z,b.z)+padding)/64);z++){
  const key=`${x}:${z}`,list=roadBins.get(key)||[];list.push({a,b,width:r.width,owner:r.name});roadBins.set(key,list);
 }
}
export function roadDistance(x:number,z:number){
 let d=Infinity;for(const {a,b,width}of roadBins.get(`${Math.floor(x/64)}:${Math.floor(z/64)}`)||[]){
  const dx=b.x-a.x,dz=b.z-a.z,t=THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);
  d=Math.min(d,Math.hypot(x-a.x-dx*t,z-a.z-dz*t)-width/2);
 }return d;
}
export const isOnIndustrialRoad=(x:number,z:number,margin=3)=>roadDistance(x,z)<margin;

/** PlaneGeometry terrain uses the diagonal from (0,8) to (8,0). */
export function roadGroundHeight(x:number,z:number){
 const gx=Math.floor(x/8)*8,gz=Math.floor(z/8)*8,u=(x-gx)/8,v=(z-gz)/8;
 const a=heightAt(gx,gz),b=heightAt(gx+8,gz),c=heightAt(gx,gz+8),d=heightAt(gx+8,gz+8);
 return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
}

export function createIndustrialRoads(scene:THREE.Scene,world:RAPIER.World,pool:Record<string,THREE.Material>={}){
 const group=new THREE.Group();group.name='Ash Coast colonial road network';scene.add(group);
 const local=(name:string,color:string,metalness=0,roughness=.8)=>pool[name]||new THREE.MeshStandardMaterial({color,metalness,roughness});
 const steel=local('steel','#53636b',.65,.43),dark=local('dark','#18262a',.65,.52),concrete=local('concrete','#777d76'),amber=pool.amber||new THREE.MeshStandardMaterial({color:'#e8b56d',emissive:'#da9d42',emissiveIntensity:.9}),pale=local('pale','#c9c8b7');
 const asphalt=local('asphalt','#333b3b',.02,.95),shoulder=local('roadShoulder','#62685e');
 const white=new THREE.MeshStandardMaterial({color:'#c0c2ac',roughness:.95,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const yellow=new THREE.MeshStandardMaterial({color:'#b7a46b',roughness:.95,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 if(!pool.asphalt){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d')!;ctx.fillStyle='#696b66';ctx.fillRect(0,0,256,256);for(let i=0;i<24000;i++){const v=70+worldHash(i,27)*130;ctx.fillStyle=`rgba(${v},${v},${v},.45)`;ctx.fillRect(worldHash(i,6)*256,worldHash(i,8)*256,1,1);}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;Object.assign(asphalt,{map:t,bumpMap:t,bumpScale:.045});}
 const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
 function ribbon(route:Route,left:number,right:number,material:THREE.Material,offset:number,filter?:(distance:number)=>boolean){
  const positions:number[]=[],uv:number[]=[],indices:number[]=[];let distance=0;
  function clip(poly:Point[],signed:(p:Point)=>number){const result:Point[]=[];for(let j=0;j<poly.length;j++){const a=poly[j],b=poly[(j+1)%poly.length],fa=signed(a),fb=signed(b);if(fa>=-1e-8)result.push(a);if((fa<0&&fb>0)||(fa>0&&fb<0)){const t=fa/(fa-fb);result.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});}}return result;}
  function emit(poly:Point[]){if(poly.length<3)return;const base=positions.length/3;for(const p of poly){positions.push(p.x,roadGroundHeight(p.x,p.z)+offset,p.z);uv.push(p.x/7,p.z/7);}for(let j=1;j<poly.length-1;j++)indices.push(base,base+j+1,base+j);}
  for(let i=0;i<route.points.length-1;i++){
   const a=route.points[i],b=route.points[i+1],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);if(filter&&!filter(distance)){distance+=length;continue;}
   if(material===white||material===yellow){const x=(a.x+b.x)/2,z=(a.z+b.z)/2;const junction=(roadBins.get(`${Math.floor(x/64)}:${Math.floor(z/64)}`)||[]).some(other=>{if(other.owner===route.name)return false;const dx=other.b.x-other.a.x,dz=other.b.z-other.a.z,t=THREE.MathUtils.clamp(((x-other.a.x)*dx+(z-other.a.z)*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-other.a.x-dx*t,z-other.a.z-dz*t)<(other.width+route.width)/2+.8;});if(junction){distance+=length;continue;}}
   if(heightAt((a.x+b.x)/2,(a.z+b.z)/2)<1){distance+=length;continue;}
   const corners:Point[]=[];
   for(let row=0;row<2;row++){const p=row?b:a;const before=route.points[Math.max(0,i+row-1)],after=route.points[Math.min(route.points.length-1,i+row+1)],len=Math.hypot(after.x-before.x,after.z-before.z),nx=-(after.z-before.z)/len,nz=(after.x-before.x)/len;
    for(const side of [left,right])corners.push({x:p.x+nx*side,z:p.z+nz*side});
   }
   // Clip to every underlying terrain triangle. Merely sampling a dense ribbon can
   // still put its interiors beneath the diagonal ridges of a coarse collider.
   const polygon=[corners[0],corners[2],corners[3],corners[1]],xs=polygon.map(p=>p.x),zs=polygon.map(p=>p.z);
   for(let gx=Math.floor(Math.min(...xs)/8)*8;gx<=Math.max(...xs);gx+=8)for(let gz=Math.floor(Math.min(...zs)/8)*8;gz<=Math.max(...zs);gz+=8){let cell=clip(polygon,p=>p.x-gx);cell=clip(cell,p=>gx+8-p.x);cell=clip(cell,p=>p.z-gz);cell=clip(cell,p=>gz+8-p.z);emit(clip(cell,p=>gx+gz+8-p.x-p.z));emit(clip(cell,p=>p.x+p.z-gx-gz-8));}
   distance+=length;
  }
  if(!positions.length)return;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();const list=batches.get(material)||[];list.push(g);batches.set(material,list);
 }
 for(const r of INDUSTRIAL_ROUTES){ribbon(r,-r.width/2-1.2,r.width/2+1.2,shoulder,.018);ribbon(r,-r.width/2,r.width/2,asphalt,.045);ribbon(r,-r.width/2+.32,-r.width/2+.44,white,.059);ribbon(r,r.width/2-.44,r.width/2-.32,white,.059);if(r.width>=8){ribbon(r,-.16,-.055,yellow,.061,d=>d%11<5.5);ribbon(r,.055,.16,yellow,.061,d=>d%11<5.5);}}
 for(const[material,geometries]of batches){const g=mergeGeometries(geometries)!;const mesh=new THREE.Mesh(g,material);mesh.receiveShadow=true;group.add(mesh);for(const source of geometries)source.dispose();}
 const box=new THREE.BoxGeometry(1,1,1),dummy=new THREE.Object3D();
 type Prop={x:number;z:number;parts:{matrix:THREE.Matrix4;material:THREE.Material}[];solids:{x:number;y:number;z:number;w:number;h:number;d:number}[];sign?:THREE.Mesh;loaded?:THREE.Group;colliders?:RAPIER.Collider[]};
 const props:Prop[]=[],lamps:{x:number;y:number;z:number;color:number}[]=[];
 function prop(x:number,z:number){const p:Prop={x,z,parts:[],solids:[]};props.push(p);return p;}
 function block(p:Prop,x:number,y:number,z:number,w:number,h:number,d:number,material:THREE.Material,solid=false){dummy.position.set(x,y,z);dummy.rotation.set(0,0,0);dummy.scale.set(w,h,d);dummy.updateMatrix();p.parts.push({matrix:dummy.matrix.clone(),material});if(solid)p.solids.push({x,y,z,w,h,d});}
 function sign(x:number,z:number,title:string,lines:string[],small=false){
  const p=prop(x,z),y=roadGroundHeight(x,z),w=small?4.2:7.6,h=small?1.65:2.65,cy=y+(small?3.15:4.1);
  for(const side of [-1,1]){block(p,x+side*w*.38,y+cy/2-y/2-.4,z,.16,cy-y+.3,.2,steel,true);block(p,x+side*w*.38,y+.2,z,.7,.4,.8,concrete,true);}
  block(p,x,cy,z,w+.18,h+.18,.2,dark);block(p,x,cy+h/2+.13,z,w+.3,.09,.4,steel);block(p,x,cy+h/2+.04,z+.18,w-.2,.055,.065,amber);
  const c=document.createElement('canvas');c.width=1024;c.height=small?400:420;const ctx=c.getContext('2d')!;ctx.fillStyle='#143c43';ctx.fillRect(0,0,c.width,c.height);ctx.strokeStyle='#94aaa4';ctx.lineWidth=7;ctx.strokeRect(15,15,c.width-30,c.height-30);ctx.fillStyle='#d8b378';ctx.fillRect(16,16,c.width-32,87);ctx.fillStyle='#162e34';ctx.font='bold 45px Arial';ctx.fillText(title,44,76);ctx.fillStyle='#e0e3d5';ctx.font=`bold ${small?57:52}px Arial`;lines.forEach((line,i)=>ctx.fillText(line,45,173+i*85));ctx.fillStyle='rgba(12,28,31,.11)';for(let i=0;i<450;i++)ctx.fillRect(worldHash(i,1)*1024,worldHash(i,2)*420,worldHash(i,4)*7+1,1);
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;const m=new THREE.MeshStandardMaterial({map,roughness:.8,metalness:.12,emissive:'#ffffff',emissiveMap:map,emissiveIntensity:.11});p.sign=new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);p.sign.position.set(x,cy,z+.112);
 }
 sign(8.7,86,'ASH COAST  /  COLONIAL AUTHORITY',['↑  COLD HARBOUR       110 M','←  NORTHWATCH          1.0 KM','→  TIDEBREAK                1.0 KM']);
 sign(-11,40,'FREIGHT DISTRICT  07',['↑  CUSTOMS / DOCK YARD'],true);
 sign(-63,78,'HIGHWAY N-4',['←  NORTHWATCH ARRAY','AUTHORIZED FREIGHT ONLY'],true);
 sign(73,66,'HIGHWAY E-2',['→  TIDEBREAK ARSENAL','COASTAL DEFENCE COMMAND'],true);
 sign(-701,-603,'PORT ASTRA CITY',['↑  CIVIC AVENUE / MARKET','HANGAR 03 / SHIP SALES'],true);
 sign(-1107,-913,'WELCOME TO PORT ASTRA',['↑  HANGAR 03 / 300 SALVAGE','MARKET / MEDICAL / CREW LODGINGS'],true);
 sign(-680,-445,'NORTHWATCH ARRAY',['↑  SIGNALS / BARRACKS','REDUCE SPEED     20'],true);
 sign(790,-279,'TIDEBREAK ARSENAL',['↑  MUNITIONS / TRANSIT','MILITARY CHECKPOINT'],true);
 for(const r of INDUSTRIAL_ROUTES){if(r.name==='Landing approach'||r.name==='Harbour service loop')continue;let travelled=0,next=30,lampNext=64;
  for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);travelled+=len;if(travelled<next)continue;next+=46;const signSide=Math.floor(travelled/46)%2?1:-1,nx=-dz/len,nz=dx/len,x=b.x+nx*(r.width/2+1.7)*signSide,z=b.z+nz*(r.width/2+1.7)*signSide;if(Math.hypot(x,z-110)<21||heightAt(x,z)<2)continue;const y=roadGroundHeight(x,z),p=prop(x,z);
   block(p,x,y+.42,z,.14,.85,.18,pale);block(p,x,y+.74,z,.19,.14,.2,amber);block(p,x,y+.1,z,.35,.2,.38,concrete);
   if(travelled>lampNext){lampNext+=132;lamps.push({x:x+signSide*1.35,y:y+7.35,z,color:0xffcc8c});block(p,x,y+3.8,z,.18,7.6,.2,steel,true);block(p,x,y+.35,z,.65,.7,.65,concrete,true);block(p,x+signSide*.75,y+7.55,z,1.7,.13,.18,steel);block(p,x+signSide*1.35,y+7.48,z,.64,.09,.42,amber);block(p,x,y+2.5,z+.13,.3,.6,.14,dark);}
  }
 }
 // Near the landing the developed road has drainage, service boxes, and intermittent concrete protection.
 for(const side of [-1,1])for(let i=0;i<5;i++){const z=24+i*9,x=side*6.8,y=roadGroundHeight(x,z),p=prop(x,z);block(p,x,y+.16,z,.45,.3,5.7,concrete,true);for(let j=-2;j<=2;j++)block(p,x+side*.6,y+.045,z+j*.23,.7,.06,.07,dark);}
 const utility=prop(-9.5,67),uy=roadGroundHeight(-9.5,67);block(utility,-9.5,uy+.95,67,1.35,1.9,.7,steel,true);block(utility,-9.5,uy+.95,67.37,1.1,1.6,.04,dark);block(utility,-9.05,uy+1.35,67.41,.08,.13,.04,amber);
 let lastCell='',furniture=new THREE.Group();group.add(furniture);
 function sync(position:{x:number;z:number}){const key=`${Math.floor(position.x/100)}:${Math.floor(position.z/100)}`;if(key===lastCell)return;lastCell=key;
  group.remove(furniture);furniture.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});furniture=new THREE.Group();
  const materialBatches=new Map<THREE.Material,THREE.Matrix4[]>();
  for(const p of props){const wanted=Math.hypot(p.x-position.x,p.z-position.z)<740;
   if(wanted){if(!p.loaded){p.loaded=new THREE.Group();p.colliders=p.solids.map(s=>world.createCollider(RAPIER.ColliderDesc.cuboid(s.w/2,s.h/2,s.d/2).setTranslation(s.x,s.y,s.z)));}
    for(const part of p.parts){const list=materialBatches.get(part.material)||[];list.push(part.matrix);materialBatches.set(part.material,list);}if(p.sign)furniture.add(p.sign);
   }else if(p.loaded){for(const collider of p.colliders||[])world.removeCollider(collider,true);p.loaded=undefined;p.colliders=[];}
  }
  for(const[material,matrices]of materialBatches){const mesh=new THREE.InstancedMesh(box,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.receiveShadow=true;mesh.castShadow=material!==amber;mesh.computeBoundingSphere();furniture.add(mesh);}group.add(furniture);
 } return{lamps,sync,update(_time:number,position:{x:number;z:number}){sync(position);},stats(){return{roadRoutes:INDUSTRIAL_ROUTES.length,roadKilometres:Math.round(INDUSTRIAL_ROUTES.reduce((n,r)=>n+r.points.length,0)/100)/10,roadFurniture:props.filter(p=>p.loaded).length};}};
}




