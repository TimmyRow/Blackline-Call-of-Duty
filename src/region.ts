import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {isOnIndustrialRoad} from './industrial-roads';
import {createIndustrialMaterials} from './industrial-materials';
import {heightAt,getWorldSites,getLandingPads,worldHash,REGION_START} from './region-layout.mjs';

type Site=ReturnType<typeof getWorldSites>[number];
type Loaded={group:THREE.Group;colliders:RAPIER.Collider[];meshes:THREE.Object3D[];geometries:THREE.BufferGeometry[];materials:THREE.Material[];textures:THREE.Texture[];detail:THREE.Group;center:THREE.Vector3};
const CHUNK=256, RANGE=3;

/** Bounded streaming cache: distant discoveries are generated from coordinates, never accumulated. */
export function buildRegion(scene:THREE.Scene,world:RAPIER.World,occluders:THREE.Object3D[]){
 const chunks=new Map<string,Loaded>(),sites=new Map<string,Loaded>();
 const completed=new Set<string>(),signals=new Map<string,THREE.Mesh>();
 const practicalLamps=new Map<string,{x:number;y:number;z:number;color:string}[]>();
 const sharedBox=new THREE.BoxGeometry(1,1,1),rockGeo=new THREE.IcosahedronGeometry(1,1),treeGeo=mergeGeometries([new THREE.ConeGeometry(1,.7,9).translate(0,-.15,0),new THREE.ConeGeometry(.76,.65,9).translate(0,.12,0),new THREE.ConeGeometry(.49,.6,9).translate(0,.38,0),new THREE.CylinderGeometry(.07,.1,.6,6).translate(0,-.35,0)]);
 const kit=createIndustrialMaterials();
 const {grit,steel,dark,wall,concrete,rust,glass,cyan,amber,teal,orange,blue,yellow,black,pale,asphalt}=kit;
 const terrainMat=new THREE.MeshStandardMaterial({vertexColors:true,map:grit,bumpMap:grit,bumpScale:.22,roughness:.96});
 const plantMat=new THREE.MeshStandardMaterial({color:'#53695c',roughness:1});
 const rockMat=new THREE.MeshStandardMaterial({color:'#77796c',map:grit,roughness:.98});
 const ground=new THREE.Color(),sand=new THREE.Color('#aeb498'),green=new THREE.Color('#53695b'),stone=new THREE.Color('#7c8987'),snow=new THREE.Color('#b2c5bf');
 function load():Loaded{const group=new THREE.Group(),detail=new THREE.Group();group.add(detail);scene.add(group);return{group,detail,center:new THREE.Vector3(),colliders:[],meshes:[],geometries:[],materials:[],textures:[]};}
 function remove(data:Loaded){scene.remove(data.group);for(const c of data.colliders)world.removeCollider(c,true);for(const mesh of data.meshes){const i=occluders.indexOf(mesh);if(i>=0)occluders.splice(i,1);}data.group.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});for(const g of data.geometries)g.dispose();for(const m of data.materials)m.dispose();for(const t of data.textures)t.dispose();}
 function collider(data:Loaded,x:number,y:number,z:number,w:number,h:number,d:number){data.colliders.push(world.createCollider(RAPIER.ColliderDesc.cuboid(w/2,h/2,d/2).setTranslation(x,y,z).setFriction(.85)));}
 function terrain(cx:number,cz:number){
  const data=load(),size=CHUNK,segments=32,g=new THREE.PlaneGeometry(size,size,segments,segments);g.rotateX(-Math.PI/2);const p=g.attributes.position,colors=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){const x=p.getX(i)+(cx+.5)*size,z=p.getZ(i)+(cz+.5)*size,y=heightAt(x,z);p.setXYZ(i,x,y,z);g.attributes.uv.setXY(i,x/7,z/7);const slope=Math.hypot(heightAt(x+2,z)-y,heightAt(x,z+2)-y)/2;ground.copy(green).lerp(stone,Math.min(1,slope*1.4));ground.lerp(sand,1-THREE.MathUtils.smoothstep(y,1,13));ground.lerp(snow,THREE.MathUtils.smoothstep(y,90,160)*.7);ground.multiplyScalar(.92+.09*Math.sin(x*.031)*Math.cos(z*.039));colors.set([ground.r,ground.g,ground.b],i*3);}
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.computeVertexNormals();const mesh=new THREE.Mesh(g,terrainMat);mesh.receiveShadow=true;data.group.add(mesh);data.meshes.push(mesh);data.geometries.push(g);occluders.push(mesh);
  data.colliders.push(world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(p.array),new Uint32Array(g.index!.array)).setFriction(.95)));
  const nearby=getWorldSites((cx+.5)*CHUNK,(cz+.5)*CHUNK,240),rocks:THREE.Matrix4[]=[],plants:THREE.Matrix4[]=[],dummy=new THREE.Object3D();
  for(let i=0;i<100;i++){const x=(cx+worldHash(cx,cz,i*2+9))*CHUNK,z=(cz+worldHash(cx,cz,i*2+10))*CHUNK,y=heightAt(x,z);if(y<2||isOnIndustrialRoad(x,z,7)||nearby.some(s=>Math.hypot(x-s.x,z-s.z)<s.radius+15)||Math.hypot(x-REGION_START.x,z-REGION_START.z)<45)continue;
   const rock=i%3===0,h=rock?1.2+worldHash(cx,cz,i+400)*5:3+worldHash(cx,cz,i+700)*9;dummy.position.set(x,y+h*(rock?.32:.62),z);dummy.rotation.set(rock?.2:0,worldHash(cx,cz,i+900)*6.28,rock?.12:0);dummy.scale.set(rock?h*.8:h*.4,h,rock?h*.7:h*.4);dummy.updateMatrix();(rock?rocks:plants).push(dummy.matrix.clone());
  }
  for(const [geometry,material,matrices] of [[rockGeo,rockMat,rocks],[treeGeo,plantMat,plants]] as const){if(!matrices.length)continue;const m=new THREE.InstancedMesh(geometry,material,matrices.length);matrices.forEach((t,i)=>m.setMatrixAt(i,t));m.receiveShadow=true;m.computeBoundingSphere();data.group.add(m);}
  return data;
 }
 function structure(s:Site){
  const data=load(),batches=new Map<THREE.Material,THREE.Matrix4[]>(),details=new Map<THREE.Material,THREE.Matrix4[]>(),dummy=new THREE.Object3D();
  const x=s.x,z=s.z,y=s.elevation;data.center.set(x,y,z);
  function block(a:number,b:number,c:number,w:number,h:number,d:number,m:THREE.Material,solid=true,rz=0){dummy.position.set(x+a,y+b,z+c);dummy.scale.set(w,h,d);dummy.rotation.set(0,0,rz);dummy.updateMatrix();const target=solid?batches:details,list=target.get(m)||[];list.push(dummy.matrix.clone());target.set(m,list);if(solid)collider(data,x+a,y+b,z+c,w,h,d);}
  const deco=(a:number,b:number,c:number,w:number,h:number,d:number,m:THREE.Material,rz=0)=>block(a,b,c,w,h,d,m,false,rz);
  function sign(title:string,sub:string,a:number,b:number,c:number,w=7,h=1.55,back=false){
   const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#10242e';ctx.fillRect(0,0,768,192);ctx.strokeStyle='#799d9e';ctx.lineWidth=4;ctx.strokeRect(8,8,752,176);ctx.fillStyle='#d5e3d7';ctx.textAlign='center';ctx.font='900 68px Arial';ctx.fillText(title,384,99,725);ctx.fillStyle='#d7aa65';ctx.font='bold 24px monospace';ctx.fillText(sub,384,151,715);for(let i=0;i<260;i++){ctx.fillStyle='rgba(14,26,30,.15)';ctx.fillRect(worldHash(i,7)*768,worldHash(i,8)*192,worldHash(i,9)*15,2);}
   const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;const mat=new THREE.MeshStandardMaterial({map:tex,emissiveMap:tex,emissive:0x66817f,emissiveIntensity:.28,roughness:.6});const geo=new THREE.PlaneGeometry(w,h),mesh=new THREE.Mesh(geo,mat);mesh.position.set(x+a,y+b,z+c);if(back)mesh.rotation.y=Math.PI;data.detail.add(mesh);data.textures.push(tex);data.materials.push(mat);data.geometries.push(geo);
  }
  function building(a:number,c:number,w=18,d=14,h=7,label='FREIGHT / 07'){
   block(a,-.13,c,w+.6,.3,d+.6,concrete);deco(a,.025,c+d*.18,w+5,.04,d+6,asphalt);deco(a,.065,c+d/2+3,w+5,.09,1.2,concrete);block(a,h/2,c-d/2,w,h,.55,wall);block(a-w/2,h/2,c,.55,h,d,wall);block(a+w/2,h/2,c,.55,h,d,wall);
   // Three metre loading entrance is usable; separated warehouses keep cross-streets open.
   const wing=(w-3.8)/2;for(const side of [-1,1])block(a+side*(1.9+wing/2),h/2,c+d/2,wing,h,.55,wall);block(a,h-.7,c+d/2,3.8,1.4,.55,steel);
   block(a,h,c,w+1,.35,d+1,steel);deco(a,h+.38,c-d*.17,w*.7,.4,d*.3,dark);deco(a,h+.65,c-d*.17,w*.55,.12,d*.24,black);
   for(const side of [-1,1]){
    for(let q=-d/2+.5;q<d/2;q+=1.3)deco(a+side*(w/2+.3),h*.48,c+q,.1,h*.94,.12,steel);
    for(let q=-w/2+.5;q<w/2;q+=1.3)deco(a+q,h*.48,c+side*(d/2+.31),.12,h*.94,.1,steel);
    for(const end of [-1,1])deco(a+side*w/2,h*.5,c+end*d/2,.32,h,.35,pale);
    deco(a+side*w*.32,h-2,c+d/2+.34,w*.24,1.35,.06,glass);deco(a+side*w*.32,h-1.3,c+d/2+.39,w*.24,.07,.08,cyan);
    for(let q=-1;q<=1;q++)deco(a+side*w*.32+q*w*.075,h-2,c+d/2+.42,.07,1.4,.07,dark);
    deco(a+side*(w*.5-.5),2,c+d/2+.45,.2,3.9,.23,rust);deco(a+side*(w*.5-.5),4,c+d/2+.45,.38,.15,.38,steel);
   }
   // Lit four-pane service windows on the street-facing sides make the blocks occupied.
   for(const side of [-1,1])for(let q=-d/2+3;q<d/2-1;q+=5){
    const wx=a+side*(w/2+.32),wy=Math.min(h-2.4,5.3);
    deco(wx,wy,c+q,.065,1.3,2.5,glass);deco(wx+side*.055,wy,c+q,.06,1.35,.08,dark);deco(wx+side*.055,wy,c+q,.06,.08,2.55,dark);
    deco(wx,wy+.73,c+q,.12,.12,2.85,pale);deco(wx,wy-.73,c+q,.12,.12,2.85,steel);
   }
   // Rolled shutters, a service awning, vents and a roof plant break up each facade.
   deco(a,4.7,c+d/2+1,5.6,.2,2,rust);deco(a,4.58,c+d/2+1.65,4,.08,.17,amber);
   for(let j=0;j<7;j++)deco(a,h-1.35+j*.13,c+d/2+.32,3.75,.055,.08,pale);
   for(const side of [-1,1]){deco(a+side*w*.31,h+.85,c-d*.22,2.6,1.6,2.4,steel);for(let j=0;j<8;j++)deco(a+side*w*.31,h+.3+j*.15,c-d*.22+1.23,2.25,.07,.05,black);deco(a+side*w*.38,h+1.1,c+d*.21,.7,2,.7,dark);deco(a+side*w*.38,h+2.1,c+d*.21,1.1,.14,1.1,pale);}
   // Loading catwalk and ladder are architectural detail; the entrance stays clear.
   const side=-1;deco(a+side*(w/2+.8),h*.62,c,1.5,.15,d*.8,steel);for(const q of [-d*.4,d*.4])deco(a-w/2-1.45,h*.62+.65,c+q,.08,1.3,.08,yellow);deco(a-w/2-1.45,h*.62+1.2,c,.07,.07,d*.8,yellow);deco(a-w/2-1.45,h*.62+.55,c,.06,.06,d*.8,steel);
   for(let q=-d*.4;q<=d*.4;q+=2)deco(a-w/2-1.45,h*.62+.6,c+q,.055,1.2,.055,steel);
   for(const q of [-.4,.4])deco(a-w/2-.55,h*.35,c+d*.36+q,.07,h*.7,.07,yellow);for(let q=.2;q<h*.7;q+=.37)deco(a-w/2-.55,q,c+d*.36,.07,.055,.86,steel);
   sign(label,'ASH COAST / COLONIAL LOGISTICS',a,h-.6,c+d/2+.45,Math.min(w*.75,10),1.35);
  }
  function container(a:number,c:number,m:THREE.Material,level=0,num='07'){
   const b=level*3.08+1.5;if(level===0)deco(a,.03,c,6.5,.05,10.5,asphalt);block(a,b,c,4.6,3,8.8,m);for(let i=0;i<21;i++)for(const side of [-1,1])deco(a+side*2.33,b,c-4.2+i*.42,.08,2.76,.09,m);
   for(const side of [-1,1])for(const end of [-1,1]){deco(a+side*2.22,b,c+end*4.45,.16,3.08,.13,steel);deco(a+side*1.28,b,c+end*4.48,.06,2.8,.09,pale);deco(a+side*1.28,b-.12,c+end*4.54,.35,.08,.1,steel);}
   for(const end of [-1,1]){deco(a,b+1.43,c+end*4.46,4.5,.15,.12,steel);deco(a,b-1.43,c+end*4.46,4.5,.15,.12,steel);deco(a,b,c+end*4.46,.06,2.85,.06,dark);}
   if(level===0)sign('NORTH / '+num,'INTERMODAL  /  MAX GROSS 32 500',a,b+.2,c+4.55,3.5,.82);deco(a+1.87,b-1.05,c+4.56,.22,.28,.025,yellow);
  }
  function barrier(a:number,c:number){block(a,.64,c,3.5,1.28,1.25,concrete);deco(a,1.3,c,3.55,.1,1.28,pale);for(let i=-3;i<=3;i++)deco(a+i*.42,.68,c+.635,.25,.76,.018,i%2?yellow:black,-.33);for(const side of [-1,1])deco(a+side*1.3,.16,c+.66,.18,.16,.06,amber);}
  function gantry(c:number,w=39,h=11){for(const side of [-1,1]){block(side*w/2,h/2,c,.5,h,.6,steel);deco(side*w/2,.12,c,1.2,.24,1.5,concrete);}deco(0,h,c,w+.8,.5,1.2,steel);deco(0,h+1.2,c,w,.1,.12,yellow);for(let a=-w/2;a<w/2;a+=2)deco(a,h+.7,c,.07,1.25,.07,steel);for(let a=-w/2;a<w/2;a+=3)deco(a+1.5,h-.6,c,3.3,.15,.2,rust,a%2?.4:-.4);sign(s.name.toUpperCase(),'FREIGHT ACCESS  /  KEEP CLEAR',0,h-.7,c+.68,11,1.6);}
  function crane(a:number,c:number,h=29){for(const side of [-1,1])block(a+side*2.5,h/2,c,.7,h,.7,rust);for(let b=2;b<h;b+=3.5){deco(a,b,c,5,.25,.35,rust);deco(a,b+1.5,c,5.8,.22,.25,steel,.54);}deco(a+8,h,c,29,.5,1.2,rust);deco(a+8,h+2.5,c,29,.2,.4,steel);for(let i=-6;i<22;i+=2)deco(a+i,h+1.25,c,.17,2.5,.18,rust,-.45);deco(a+18,h-6,c,.05,12,.05,black);deco(a+18,h-12,c,.9,.7,.7,yellow);block(a-5,h-1.1,c,5,2.5,3,steel);deco(a-5,h-1,c+1.55,3,1.25,.06,glass);}
  function yard(a:number,c:number){for(let i=0;i<3;i++){const q=a+i*2;block(q,.6,c,1.65,1.2,1.3,dark);deco(q,1.25,c,1.7,.1,1.35,steel);for(const side of [-1,1])deco(q+side*.52,.6,c+.67,.12,1.1,.05,yellow);}for(let j=0;j<3;j++)deco(a+2,.055,c+2+j*.18,5,.09,.12,rust);}
  function pad(a:number,c:number,r:number){block(a,.08,c,r*2,.16,r*2,asphalt);for(const side of [-1,1]){deco(a+side*(r-1),.18,c,.3,.035,r*1.8,yellow);deco(a,.18,c+side*(r-1),r*1.8,.035,.3,yellow);for(const end of [-1,1])deco(a+side*(r-.6),.24,c+end*(r-.6),.4,.16,.4,cyan);}deco(a-2,.19,c,.5,.03,7,pale);deco(a+2,.19,c,.5,.03,7,pale);deco(a,.19,c,4,.03,.5,pale);}
  function surfacedYard(start=false){
   // Start district clips its corners to stay entirely inside the flat landing
   // terrace. Roads and raised landing paint sit above this continuous wet yard.
   const outline=start?[[-30,-22],[-20,-32],[20,-32],[30,-22],[30,22],[20,32],[-20,32],[-30,22]]:[[-44,-45],[44,-45],[44,45],[-44,45]];
   const shape=new THREE.Shape();outline.forEach(([a,c],i)=>i?shape.lineTo(a,c):shape.moveTo(a,c));shape.closePath();const geometry=new THREE.ShapeGeometry(shape);geometry.rotateX(-Math.PI/2);
   const uv=geometry.attributes.uv,p=geometry.attributes.position;for(let i=0;i<p.count;i++)uv.setXY(i,(x+p.getX(i))/12,(z+p.getZ(i))/12);
   const mesh=new THREE.Mesh(geometry,asphalt);mesh.position.set(x,y+.014,z);mesh.receiveShadow=true;data.group.add(mesh);data.geometries.push(geometry);
  }
  function streetlight(a:number,c:number){
   const side=Math.sign(a),head=a-side*1.25;block(a,3.9,c,.18,7.8,.18,steel);block(a,.15,c,.6,.3,.6,concrete);deco(a-side*.65,7.7,c,1.6,.14,.18,steel);deco(head,7.6,c,.75,.18,.45,black);deco(head,7.5,c,.62,.035,.32,side<0?cyan:amber);
   const list=practicalLamps.get(s.id)||[];list.push({x:x+head,y:y+7.4,z:z+c,color:side<0?'#73cfff':'#ffb35c'});practicalLamps.set(s.id,list);
  }
  if(s.id==='landing-services'){surfacedYard(true);for(const a of [-19,19])for(const c of [-24,20])streetlight(a,c);}
  else if(s.kind==='camp'||s.kind==='outpost'){surfacedYard();for(const a of [-9,9])for(const c of [-30,0])streetlight(a,c);}
  if(s.id==='landing-services'){
   building(-33,-25,18,21,12,'PATHFINDER / 01');building(32,-27,17,21,10,'FLIGHT STORES');
   building(-34,15,18,19,9,'SQUAD QUARTERS');building(34,18,17,21,11,'ORBITAL TRANSIT');
   container(-33,-4,teal,0,'01');container(-33,-4,blue,1);container(25,-6,orange,0,'02');container(25,-6,teal,1);
   yard(-44,-7);yard(28,-9);barrier(-22,30);barrier(22,31);gantry(-37,43,12);
   for(const side of [-1,1]){deco(side*22,.08,10,1,.16,32,concrete);for(const c of [0,8,17,25]){block(side*22,1,c,.17,2,.17,steel);deco(side*22,1.8,c,.2,.2,.2,cyan);}}
  }else if(s.kind==='carrier'||s.kind==='pirate-ship'){
   const friendly=s.kind==='carrier',length=friendly?154:128,w=70;
   const hullShape=new THREE.Shape();hullShape.moveTo(-w*.45,length*.46);hullShape.lineTo(w*.45,length*.46);hullShape.lineTo(w*.47,-length*.25);hullShape.lineTo(0,-length*.64);hullShape.lineTo(-w*.47,-length*.25);hullShape.closePath();const hullGeo=new THREE.ExtrudeGeometry(hullShape,{depth:9,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:1.5,bevelThickness:1.5});hullGeo.rotateX(Math.PI/2);const hull=new THREE.Mesh(hullGeo,dark);hull.position.set(x,y-2,z);hull.castShadow=true;data.group.add(hull);data.geometries.push(hullGeo);data.meshes.push(hull);occluders.push(hull);block(0,-4.5,0,w-8,8,length-10,dark);block(0,-.65,0,w,1.3,length,steel);block(0,-8,0,w*.7,6,length*.87,dark);
   // The open flight deck is intentionally continuous, with actual deck-height colliders.
   building(-22,-35,20,30,18);block(-22,14.5,-19,21,3,.35,glass,false);block(-22,26,-39,1.3,15,1.3,steel);block(-22,29,-39,18,.65,1.6,wall);building(23,-43,18,21,8);
   for(let i=-3;i<=3;i++)for(const side of [-1,1]){block(side*(w/2-1),.55,i*20,.5,1.1,4,dark);block(side*(w/2-.7),1.2,i*20,.3,.2,3,friendly?cyan:amber,false);}
   pad(0,friendly?20:18,friendly?20:16);for(const a of [-24,24]){container(a,48,a<0?teal:orange,0,a<0?'31':'32');yard(a-2,35);}sign(friendly?'CNS WAYFARER':'CORSAIR / 09','FLIGHT DECK / SQUAD RESUPPLY',0,5,-39,13,2.3);for(const side of [-1,1]){deco(side*28,.035,8,.3,.03,66,yellow);for(let q=-60;q<64;q+=8)deco(side*34,1.15,q,.075,1.7,.075,pale);deco(side*34,1.9,0,.075,.075,length*.9,yellow);deco(side*34,.95,0,.065,.065,length*.9,steel);}
   for(const side of [-1,1])block(side*32,-3.5,0,.3,.6,length*.78,friendly?cyan:amber,false);
  }else if(s.kind==='station'){
   block(0,-2,0,204,4,156,dark);block(0,-6,0,176,6,134,steel);pad(0,28,26);building(-66,-18,45,74,22);building(66,-18,45,74,22);building(0,-52,80,28,15);
   for(const side of [-1,1]){block(side*98,2,0,2,4,150,steel);block(side*98,4.2,0,.5,.4,146,cyan,false);block(side*148,-7,-8,70,1.3,100,dark);for(let i=-3;i<=3;i++)block(side*148,-6.2,i*13,66,.15,.5,cyan,false);block(side*89,38,-51,6,75,6,steel);block(side*89,75,-51,7,.7,7,amber,false);}
   container(-29,-27,teal,0,'A7');container(28,-27,orange,0,'B4');container(28,-27,blue,1);for(const a of [-32,32]){barrier(a,13);yard(a-2,0);}gantry(-33,83,16);block(0,2,-76,200,4,2,steel);block(0,2,76,200,4,2,steel);for(let i=-2;i<=2;i++)block(i*27,15,-64,2,30,2,steel);
  }else if(s.kind==='ruin'){
   for(let i=0;i<7;i++){const angle=i/7*Math.PI*2;block(Math.cos(angle)*24,6+(i%3)*2,Math.sin(angle)*24,5,12+(i%3)*4,5,steel);}
   block(-18,16,-18,31,2,4,wall);block(22,4,5,11,8,7,dark);pad(0,35,13);
  }else{
   // A compact freight district replaces four isolated boxes. The main lane and
   // lateral alleys remain connected to the surrounding planet in every direction.
   const harbour=s.id==='harbour';
   building(-29,-23,15,24,harbour?11:8,'NORTH FREIGHT');building(29,-26,16,22,10,'CUSTOMS / 12');
   building(-30,25,16,19,8,'SERVICE / 04');building(31,26,16,20,9,'ENGINEERING');
   container(-15.8,-12,teal,0,'07');container(-15.8,-12,blue,1);container(16,-8,orange,0,'12');container(16,-8,teal,1);
   container(-16,15,blue,0,'04');container(19,13,teal,0,'09');
   for(const [a,c]of [[-6,23],[7,-26],[-8,-30],[27,4]])barrier(a,c);
   yard(-34,8);yard(23,-8);yard(-26,-42);gantry(-37,41,12);
   block(0,13,-49,1.3,26,1.3,dark);deco(0,25,-49,12,.5,2.5,steel);deco(0,26.5,-49,2,.25,2,amber);
   if(s.id==='relay'){deco(0,31,-49,22,.8,5,pale);deco(0,33.5,-49,1,6,1,steel);}
   pad(0,35,13);
   if(harbour){building(-28,63,15,21,10,'DOCKYARD / 08');building(29,65,17,20,8,'FLIGHT STORES');container(-17,48,orange,0,'16');container(18,50,blue,0,'18');crane(-44,-43,31);crane(47,-47,37);}
   else if(s.kind==='outpost')crane(-43,-43,27);
   // Barely lit service clutter, drains and pipe supports restore human scale.
   for(const side of [-1,1])for(const c of [-29,-11,8,27]){deco(side*10,.04,c,.48,.04,1.25,black);for(let j=0;j<8;j++)deco(side*10,.068,c-.5+j*.14,.46,.025,.03,steel);deco(side*23,3.2,c,1.1,.3,.35,rust);}
  }
  // An obvious recoverable locker marks the on-foot interaction, separate from the landing pad.
  if(s.id!=='landing-services'){block(0,.7,-3,2.4,1.4,1.3,dark);block(0,1.5,-3,2.5,.18,1.4,steel);
  const lamp=new THREE.Mesh(sharedBox,completed.has(s.id)?cyan:amber);lamp.scale.set(1.8,.11,.08);lamp.position.set(x,y+1.3,z-2.3);data.group.add(lamp);signals.set(s.id,lamp);}
  for(const [source,target,physical]of [[batches,data.group,true],[details,data.detail,false]] as const)for(const [material,matrices]of source){const mesh=new THREE.InstancedMesh(sharedBox,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.receiveShadow=true;mesh.castShadow=material!==cyan&&material!==amber;mesh.computeBoundingSphere();target.add(mesh);if(physical){data.meshes.push(mesh);occluders.push(mesh);}}
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
  for(const[k,s]of sites)if(!active.has(k)){remove(s);sites.delete(k);signals.delete(k);practicalLamps.delete(k);}
  for(const site of discovered)if(!sites.has(site.id))sites.set(site.id,structure(site));
  updateHorizon(position.x,position.z);
 }
 // Landing platform is part of the same streamed site system but has no mission gate.
 const landingTemplate=getWorldSites(0,0,150).find(s=>s.id==='harbour')!;
 const startHub=structure({...landingTemplate,id:'landing-services',name:'Pathfinder Landing',x:0,z:110,elevation:16});
 const start=load(),startPad=getLandingPads(REGION_START.x,REGION_START.z,30)[0];
 const platform=new THREE.Mesh(new THREE.CylinderGeometry(17,17,.16,48),asphalt);platform.position.set(startPad.x,16.08,startPad.z);start.group.add(platform);start.geometries.push(platform.geometry);start.colliders.push(world.createCollider(RAPIER.ColliderDesc.cylinder(.08,17).setTranslation(startPad.x,16.08,startPad.z)));
 return{sync,lamps(){return [...practicalLamps.values()].flat();},update(player:{x:number;y:number;z:number},time=0){kit.update(time);startHub.detail.visible=Math.hypot(player.x,player.y-16,player.z-110)<380;for(const site of sites.values())site.detail.visible=Math.hypot(player.x-site.center.x,player.y-site.center.y,player.z-site.center.z)<380;},setSiteComplete(id:string,done:boolean){if(done)completed.add(id);else completed.delete(id);const signal=signals.get(id);if(signal)signal.material=done?cyan:amber;},stats(){return{terrainChunks:chunks.size,loadedSites:sites.size,colliders:[...chunks.values(),...sites.values()].reduce((n,c)=>n+c.colliders.length,0),chunkSize:CHUNK,streamRadius:RANGE*CHUNK,procedural:true};}};
}
