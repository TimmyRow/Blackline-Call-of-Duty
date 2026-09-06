import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {isOnIndustrialRoad,roadGroundHeight} from './industrial-roads';
import {getEncounterSites} from './encounter-layout.mjs';
import {createIndustrialMaterials} from './industrial-materials';
import {heightAt,getWorldSites,getLandingPads,worldHash,REGION_START,WORLD_LANDMARKS,getSettlementBuildings,settlementStyle,ROADSIDE_STORIES} from './region-layout.mjs';

type Site=ReturnType<typeof getWorldSites>[number];
type Loaded={group:THREE.Group;colliders:RAPIER.Collider[];meshes:THREE.Object3D[];geometries:THREE.BufferGeometry[];materials:THREE.Material[];textures:THREE.Texture[];detail:THREE.Group;center:THREE.Vector3};
const CHUNK=256, RANGE=3;

/** Bounded streaming cache: distant discoveries are generated from coordinates, never accumulated. */
export function buildRegion(scene:THREE.Scene,world:RAPIER.World,occluders:THREE.Object3D[]){
 const chunks=new Map<string,Loaded>(),sites=new Map<string,Loaded>();
 const completed=new Set<string>(),signals=new Map<string,THREE.Mesh>();
 const stackLocations=new Map<string,{x:number;y:number;z:number}[]>();
 const practicalLamps=new Map<string,{x:number;y:number;z:number;color:string}[]>();
 const sharedBox=new THREE.BoxGeometry(1,1,1),rockGeo=new THREE.IcosahedronGeometry(1,1);
 // Irregular, overlapping crowns keep one instanced foliage draw per chunk.
 const crowns:THREE.BufferGeometry[]=[];for(let i=0;i<7;i++){const angle=i*2.399,scale=.48-i*.041;crowns.push(new THREE.IcosahedronGeometry(1,1).scale(scale,.22+scale*.2,scale*.83).rotateY(angle).translate(Math.cos(angle)*(.28-i*.025),-.08+i*.085,Math.sin(angle)*(.26-i*.026)));}
 crowns.push(new THREE.CylinderGeometry(.055,.1,.95,7).toNonIndexed().translate(0,-.22,0));const treeGeo=mergeGeometries(crowns);crowns.forEach(g=>g.dispose());
 const rp=rockGeo.attributes.position;for(let i=0;i<rp.count;i++){const y=rp.getY(i),factor=.91+.13*Math.sin(y*17+rp.getX(i)*6);rp.setXYZ(i,rp.getX(i)*factor,y*.72+Math.sin(y*13)*.028,rp.getZ(i)*factor);}rockGeo.computeVertexNormals();
 const kit=createIndustrialMaterials();
 const {grit,steel,dark,wall,concrete,rust,glass,cyan,amber,teal,orange,blue,yellow,black,pale,asphalt}=kit;
 const terrainMat=new THREE.MeshStandardMaterial({vertexColors:true,map:grit,bumpMap:grit,bumpScale:.22,roughness:.96});
 const plantMat=new THREE.MeshStandardMaterial({color:'#344d3d',map:grit,roughness:1});
 const rockMat=new THREE.MeshStandardMaterial({color:'#77796c',map:grit,roughness:.98});
 const foamTime={value:0};
 const foamMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{clock:foamTime},vertexShader:'varying vec3 shore;void main(){shore=position;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;}',fragmentShader:'uniform float clock;varying vec3 shore;void main(){float wash=.5+.5*sin(shore.x*.21+shore.z*.17-clock*.8);float grain=.65+.35*sin(shore.x*4.+sin(shore.z*3.));float fade=1.-smoothstep(180.,650.,distance(cameraPosition,shore));gl_FragColor=vec4(.51,.67,.69,(.09+wash*.22)*grain*fade);}'});
 const mattress=new THREE.MeshStandardMaterial({color:'#778480',roughness:.94}),ore=new THREE.MeshStandardMaterial({color:'#966444',map:grit,roughness:.9});
 const ground=new THREE.Color(),sand=new THREE.Color('#aeb498'),green=new THREE.Color('#53695b'),stone=new THREE.Color('#7c8987'),snow=new THREE.Color('#b2c5bf');
 function load():Loaded{const group=new THREE.Group(),detail=new THREE.Group();group.add(detail);scene.add(group);return{group,detail,center:new THREE.Vector3(),colliders:[],meshes:[],geometries:[],materials:[],textures:[]};}
 function remove(data:Loaded){scene.remove(data.group);for(const c of data.colliders)world.removeCollider(c,true);for(const mesh of data.meshes){const i=occluders.indexOf(mesh);if(i>=0)occluders.splice(i,1);}data.group.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});for(const g of data.geometries)g.dispose();for(const m of data.materials)m.dispose();for(const t of data.textures)t.dispose();}
 function collider(data:Loaded,x:number,y:number,z:number,w:number,h:number,d:number){data.colliders.push(world.createCollider(RAPIER.ColliderDesc.cuboid(w/2,h/2,d/2).setTranslation(x,y,z).setFriction(.85)));}
 function terrain(cx:number,cz:number){
  const data=load();data.center.set((cx+.5)*CHUNK,0,(cz+.5)*CHUNK);const size=CHUNK,segments=32,g=new THREE.PlaneGeometry(size,size,segments,segments);g.rotateX(-Math.PI/2);const p=g.attributes.position,colors=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){const x=p.getX(i)+(cx+.5)*size,z=p.getZ(i)+(cz+.5)*size,y=heightAt(x,z);p.setXYZ(i,x,y,z);g.attributes.uv.setXY(i,x/7,z/7);const slope=Math.hypot(heightAt(x+2,z)-y,heightAt(x,z+2)-y)/2;ground.copy(green).lerp(stone,Math.min(1,slope*1.4));ground.lerp(sand,1-THREE.MathUtils.smoothstep(y,1,13));ground.lerp(snow,THREE.MathUtils.smoothstep(y,90,160)*.7);ground.multiplyScalar(.92+.09*Math.sin(x*.031)*Math.cos(z*.039));colors.set([ground.r,ground.g,ground.b],i*3);}
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.computeVertexNormals();const mesh=new THREE.Mesh(g,terrainMat);mesh.receiveShadow=true;data.group.add(mesh);data.meshes.push(mesh);data.geometries.push(g);occluders.push(mesh);
  data.colliders.push(world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(p.array),new Uint32Array(g.index!.array)).setFriction(.95)));
  // Trace the actual collision mesh's zero contour. Foam follows beaches rather
  // than an unrelated noise mask, without another terrain-height texture upload.
  const foam:number[]=[];
  for(let row=0;row<segments;row++)for(let col=0;col<segments;col++){
   const i=row*(segments+1)+col,indices=[i,i+1,i+segments+2,i+segments+1],crossings:{x:number;z:number}[]=[];
   for(let edge=0;edge<4;edge++){const a=indices[edge],b=indices[(edge+1)%4],ay=p.getY(a),by=p.getY(b);if((ay<0)===(by<0))continue;const t=-ay/(by-ay);crossings.push({x:p.getX(a)+(p.getX(b)-p.getX(a))*t,z:p.getZ(a)+(p.getZ(b)-p.getZ(a))*t});}
   if(crossings.length<2)continue;const [a,b]=crossings,length=Math.hypot(b.x-a.x,b.z-a.z);if(length<.1)continue;const nx=-(b.z-a.z)/length*1.3,nz=(b.x-a.x)/length*1.3;
   foam.push(a.x-nx,.22,a.z-nz,b.x-nx,.22,b.z-nz,b.x+nx,.22,b.z+nz,a.x-nx,.22,a.z-nz,b.x+nx,.22,b.z+nz,a.x+nx,.22,a.z+nz);
  }
  if(foam.length){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(foam,3));const mesh=new THREE.Mesh(geometry,foamMaterial);data.group.add(mesh);data.geometries.push(geometry);}
  const nearby=getWorldSites((cx+.5)*CHUNK,(cz+.5)*CHUNK,240),encounterClearings=getEncounterSites((cx+.5)*CHUNK,(cz+.5)*CHUNK,250),rocks:THREE.Matrix4[]=[],plants:THREE.Matrix4[]=[],dummy=new THREE.Object3D();
  for(let i=0;i<100;i++){const x=(cx+worldHash(cx,cz,i*2+9))*CHUNK,z=(cz+worldHash(cx,cz,i*2+10))*CHUNK,y=heightAt(x,z);if(y<2||Math.hypot(x,z-220)<30||isOnIndustrialRoad(x,z,7)||encounterClearings.some(e=>Math.hypot(x-e.x,z-e.z)<(['convoy','patrol','friendly'].includes(e.kind)?50:28))||ROADSIDE_STORIES.some(l=>Math.hypot(x-l.x,z-l.z)<20)||WORLD_LANDMARKS.some(l=>Math.hypot(x-l.x,z-l.z)<35)||nearby.some(s=>Math.hypot(x-s.x,z-s.z)<s.radius+15)||Math.hypot(x-REGION_START.x,z-REGION_START.z)<45)continue;
   const rock=i%3===0,h=rock?1.2+worldHash(cx,cz,i+400)*5:3+worldHash(cx,cz,i+700)*9;dummy.position.set(x,y+h*(rock?.32:.62),z);dummy.rotation.set(rock?.2:0,worldHash(cx,cz,i+900)*6.28,rock?.12:0);dummy.scale.set(rock?h*.8:h*.4,h,rock?h*.7:h*.4);dummy.updateMatrix();(rock?rocks:plants).push(dummy.matrix.clone());
  }
  for(const [geometry,material,matrices] of [[rockGeo,rockMat,rocks],[treeGeo,plantMat,plants]] as const){if(!matrices.length)continue;const m=new THREE.InstancedMesh(geometry,material,matrices.length);matrices.forEach((t,i)=>m.setMatrixAt(i,t));m.receiveShadow=true;m.computeBoundingSphere();data.detail.add(m);}
  // Small, different roadside scenes make the journey readable between districts.
  // They use existing material batches and the exact triangle height sampler.
  const roadsideBatches=new Map<THREE.Material,THREE.Matrix4[]>();
  for(const story of ROADSIDE_STORIES){if(Math.floor(story.x/CHUNK)!==cx||Math.floor(story.z/CHUNK)!==cz)continue;
   const piece=(dx:number,dy:number,dz:number,w:number,h:number,d:number,material:THREE.Material,solid=true)=>{const wx=story.x+dx,wz=story.z+dz;if(isOnIndustrialRoad(wx,wz,2+Math.max(w,d)/2))return;const wy=roadGroundHeight(wx,wz)+dy;dummy.position.set(wx,wy,wz);dummy.rotation.set(0,0,0);dummy.scale.set(w,h,d);dummy.updateMatrix();const list=roadsideBatches.get(material)||[];list.push(dummy.matrix.clone());roadsideBatches.set(material,list);if(solid)collider(data,wx,wy,wz,w,h,d);};
   if(story.kind==='evacuation'||story.kind==='lookout'){
    for(const a of [-4,4])for(const c of [-3,3])piece(a,1.7,c,.18,3.4,.18,steel);piece(0,3.5,0,9,.2,7,story.kind==='lookout'?teal:orange,false);piece(-2,.65,-2,4,1.3,.6,dark);piece(-2,1.3,-2,4,.13,.8,pale,false);
    for(let i=0;i<5;i++){piece(-4+i*1.7,.35,4+(i%2),1.1,.7,.8,i%2?teal:rust);piece(-4+i*1.7,.76,4+(i%2),.35,.08,.5,steel,false);}piece(4,1.1,-2,.6,2.2,.6,yellow);piece(4,2.3,-2,.9,.3,1.3,dark,false);
   }else if(story.kind==='repair'){
    piece(0,.6,0,3.5,1.2,8,dark);piece(0,1.8,-2,3.6,2.4,3.1,teal);piece(0,2.2,-3.6,2.8,.9,.08,glass,false);for(const a of [-1.8,1.8])for(const c of [-2.5,2.5])piece(a,.6,c,.55,1.2,1.2,black);piece(6,.65,1,4,1.3,1.4,steel);for(let q=0;q<4;q++)piece(4.7+q*.8,1.4,1,.45,.25,.5,q%2?yellow:rust,false);piece(-4,.45,3,1.5,.9,1.5,rust);
   }else if(story.kind==='power'){
    for(const a of [-3,3])piece(a,6,0,.45,12,.45,steel);for(let h=2;h<13;h+=2)piece(0,h,0,6,.15,.3,rust,false);piece(0,11,0,11,.35,.4,steel);for(const a of [-4,0,4])piece(a,10.6,0,.4,.8,.4,cyan,false);piece(4,.45,5,12,.9,1.3,steel);piece(-5,1.5,3,2.6,3,3,dark);piece(-5,2.4,4.55,1.8,.1,.05,amber,false);
   }else{
    piece(0,.45,0,4,.9,11,dark);for(let i=0;i<9;i++){const dx=(i%3-1)*3.5,dz=Math.floor(i/3)*3-3;piece(dx,.55,dz,2.2,1.1,1.7,i%2?orange:teal);piece(dx,1.15,dz,2.25,.1,1.75,steel,false);piece(dx,.6,dz+.87,.2,.9,.04,yellow,false);}piece(-7,.6,-1,3.4,1.2,1.2,concrete);
   }
  }
  for(const [material,matrices]of roadsideBatches){const mesh=new THREE.InstancedMesh(sharedBox,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.receiveShadow=true;mesh.castShadow=true;mesh.computeBoundingSphere();data.detail.add(mesh);data.meshes.push(mesh);occluders.push(mesh);}
  // Authored discoveries are part of terrain streaming, and use real collision.
  for(const landmark of WORLD_LANDMARKS){if(Math.floor(landmark.x/CHUNK)!==cx||Math.floor(landmark.z/CHUNK)!==cz||landmark.kind==='river')continue;
   const lx=landmark.x,lz=landmark.z,ly=heightAt(lx,lz),matrices:THREE.Matrix4[]=[];
   const add=(dx:number,dy:number,dz:number,w:number,h:number,d:number)=>{dummy.position.set(lx+dx,ly+dy,lz+dz);dummy.rotation.set(0,0,0);dummy.scale.set(w,h,d);if(landmark.kind==='cave')dummy.scale.multiplyScalar(.5);dummy.updateMatrix();matrices.push(dummy.matrix.clone());collider(data,lx+dx,ly+dy,lz+dz,w*.8,h*.85,d*.8);};
   if(landmark.kind==='cave'){for(const side of [-1,1]){add(side*8,5,0,9,14,19);add(side*10,4,-10,11,12,15);}add(0,11,-2,23,8,19);add(0,4,-17,22,10,8);}
   else {add(-7,2,0,6,4,20);add(6,1,-4,9,2,12);add(0,1,6,19,1.2,5);}
   const mesh=new THREE.InstancedMesh(landmark.kind==='cave'?rockGeo:sharedBox,landmark.kind==='cave'?rockMat:rust,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.receiveShadow=true;mesh.castShadow=true;mesh.computeBoundingSphere();data.group.add(mesh);data.meshes.push(mesh);occluders.push(mesh);
  }
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
  function furnish(a:number,c:number,w:number,d:number,h:number,role:string){
   // Furniture stays along the perimeter. A four-metre aisle leads from every
   // loading doorway to the rear of the room, with capsule-safe floor heights.
   const beds=/QUARTERS|BARRACKS/.test(role),control=/CUSTOMS|TRANSIT|CONTROL|ARRAY|BRIDGE/.test(role);
   const left=a-w/2+2,right=a+w/2-2,back=c-d/2+2;
   // Dry service decking and perimeter stripes read as a manufactured interior.
   deco(a,.087,c,w-.6,.025,d-.6,concrete);for(let q=-d/2+1;q<d/2;q+=2.4)deco(a,.106,c+q,w-.7,.012,.024,dark);for(let q=-w/2+1;q<w/2;q+=2.8)deco(a+q,.107,c,.026,.012,d-.7,dark);
   for(const side of [-1,1]){deco(a+side*(w/2-.7),.113,c,.09,.015,d-1.4,yellow);deco(a+side*(w/2-.45),.35,c,.11,.65,d-.7,dark);for(let q=-d/2+1.2;q<d/2;q+=3.1)deco(a+side*(w/2-.34),h*.43,c+q,.12,h*.84,.18,steel);}
   deco(a,3.5,c-d/2+.35,w-.5,.17,.22,rust);deco(a,3.8,c-d/2+.35,w-.5,.08,.12,steel);for(let q=-w/2+1;q<w/2;q+=3)deco(a+q,3.5,c-d/2+.45,.12,.7,.22,steel);
   if(beds){for(const side of [left,right])for(let i=0;i<Math.max(2,Math.floor((d-5)/4));i++){
    const z=back+i*4;block(side,.4,z,2.2,.7,3.1,dark);deco(side,.85,z,2.05,.24,3,mattress);deco(side,.99,z-1,1.7,.15,.65,pale);block(side,2.05,z,2.2,.16,3.1,steel);deco(side,2.23,z,2.05,.2,3,mattress);for(const dx of [-1.08,1.08])deco(side+dx,1.4,z-1.5,.09,2.8,.09,steel);
   }for(const dx of [-3,3])block(a+dx,1.1,back,1.1,2.2,.8,teal);
   }else if(control){
    block(a,.7,back,w-4,1.4,1.35,dark);for(let dx=-w/2+3;dx<w/2-2;dx+=3){deco(a+dx,1.55,back,2.1,.1,1.1,steel);deco(a+dx,2.05,back-.45,1.75,1,.09,cyan);deco(a+dx,2.05,back-.38,1.6,.045,.03,black);block(a+dx,.4,back+1.5,.7,.8,.7,black);deco(a+dx,1.1,back+1.7,.7,.65,.13,dark);}block(left,1.6,c,1.3,3.2,2.2,steel);for(let q=0;q<10;q++)deco(left+.68,.4+q*.25,c,.04,.06,1.5,q%3?cyan:amber);
   }else{
    for(const side of [left,right]){block(side,.8,back+1,2.4,1.6,3.5,steel);deco(side,1.64,back+1,2.6,.12,3.7,pale);deco(side,1.85,back+1,.7,.3,1.4,rust);
    deco(side,2.5,back-.9,2.6,1.4,.12,dark);for(let t=0;t<7;t++){deco(side-1+t*.32,2.6,back-.79,.07,.55+(t%3)*.13,.07,t%2?pale:yellow);deco(side-1+t*.32,2.95,back-.78,.19,.12,.07,steel);}deco(side-.65,1.85,back+1.7,.55,.32,.7,blue);deco(side+.75,1.86,back+.8,.4,.36,.4,yellow);for(const q of [-.7,.7])deco(side+q,1.73,back+1.3,.1,.07,.55,pale);block(side,1.3,c+2,1.9,2.6,3.4,dark);for(let j=0;j<3;j++){deco(side,.6+j*.85,c+2,2,.08,3.5,steel);for(const q of [-.85,.85])deco(side,.9+j*.85,c+2+q,1.3,.45,.65,j%2?orange:teal);}}
   }
   deco(a,h-.45,c,w-3,.06,.12,cyan);deco(a,h-.46,back,w-3,.06,.12,amber);
   // Per-room practicals join the fixed global light pool rather than creating lights.
   const list=practicalLamps.get(s.id)||[];list.push({x:x+a,y:y+Math.min(h-1,4.1),z:z+c,color:control?'#73cfff':'#ffd09a'});practicalLamps.set(s.id,list);
   sign(beds?'CREW QUARTERS':control?'OPERATIONS':'FIELD WORKSHOP','COLONIAL SERVICE / AUTHORIZED PERSONNEL',a,Math.min(4.65,h-1),c-d/2+.31,Math.min(5,w-3),.7);
  }
  function building(a:number,c:number,w=18,d=14,h=7,label='FREIGHT / 07'){
   block(a,-.08,c,w+.6,.32,d+.6,concrete);deco(a,.025,c+d*.18,w+5,.04,d+6,asphalt);deco(a,.065,c+d/2+3,w+5,.09,1.2,concrete);block(a,h/2,c-d/2,w,h,.55,wall);block(a-w/2,h/2,c,.55,h,d,wall);block(a+w/2,h/2,c,.55,h,d,wall);
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
   const stacks=stackLocations.get(s.id)||[];stacks.push({x:x+a-w*.38,y:y+h+2.2,z:z+c+d*.21});stackLocations.set(s.id,stacks);
   sign(label,'ASH COAST / COLONIAL LOGISTICS',a,h-.6,c+d/2+.45,Math.min(w*.75,10),1.35);furnish(a,c,w,d,h,label);
  }
  function container(a:number,c:number,m:THREE.Material,level=0,num='07'){
   const b=level*3.08+1.5;if(level===0)deco(a,.03,c,6.5,.05,10.5,asphalt);block(a,b,c,4.6,3,8.8,m);for(let i=0;i<21;i++)for(const side of [-1,1])deco(a+side*2.33,b,c-4.2+i*.42,.08,2.76,.09,m);
   for(const side of [-1,1])for(const end of [-1,1]){deco(a+side*2.22,b,c+end*4.45,.16,3.08,.13,steel);deco(a+side*1.28,b,c+end*4.48,.06,2.8,.09,pale);deco(a+side*1.28,b-.12,c+end*4.54,.35,.08,.1,steel);}
   for(const end of [-1,1]){deco(a,b+1.43,c+end*4.46,4.5,.15,.12,steel);deco(a,b-1.43,c+end*4.46,4.5,.15,.12,steel);deco(a,b,c+end*4.46,.06,2.85,.06,dark);}
   if(level===0)sign('NORTH / '+num,'INTERMODAL  /  MAX GROSS 32 500',a,b+.2,c+4.55,3.5,.82);deco(a+1.87,b-1.05,c+4.56,.22,.28,.025,yellow);
  }
  function barrier(a:number,c:number){block(a,.64,c,3.5,1.28,1.25,concrete);deco(a,1.3,c,3.55,.1,1.28,pale);for(let i=-3;i<=3;i++)deco(a+i*.42,.68,c+.635,.25,.76,.018,i%2?yellow:black,-.33);for(const side of [-1,1])deco(a+side*1.3,.16,c+.66,.18,.16,.06,amber);}
  function gantry(c:number,w=39,h=11){for(const side of [-1,1]){block(side*w/2,h/2,c,.5,h,.6,steel);deco(side*w/2,.12,c,1.2,.24,1.5,concrete);}deco(0,h,c,w+.8,.5,1.2,steel);deco(0,h+1.2,c,w,.1,.12,yellow);for(let a=-w/2;a<w/2;a+=2)deco(a,h+.7,c,.07,1.25,.07,steel);for(let a=-w/2;a<w/2;a+=3)deco(a+1.5,h-.6,c,3.3,.15,.2,rust,a%2?.4:-.4);sign(s.name.toUpperCase(),'FREIGHT ACCESS  /  KEEP CLEAR',0,h-.7,c+.68,11,1.6);}
  function crane(a:number,c:number,h=29){for(const side of [-1,1])block(a+side*2.5,h/2,c,.7,h,.7,rust);for(let b=2;b<h;b+=3.5){deco(a,b,c,5,.25,.35,rust);deco(a,b+1.5,c,5.8,.22,.25,steel,.54);}deco(a+8,h,c,29,.5,1.2,rust);deco(a+8,h+2.5,c,29,.2,.4,steel);for(let i=-6;i<22;i+=2)deco(a+i,h+1.25,c,.17,2.5,.18,rust,-.45);deco(a+18,h-6,c,.12,12,.12,black);deco(a+18,h-12,c,.9,.7,.7,yellow);block(a-5,h-1.1,c,5,2.5,3,steel);deco(a-5,h-1,c+1.55,3,1.25,.06,glass);}
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
   building(-22,-35,20,30,18,'BRIDGE / CONTROL');block(-22,14.5,-19,21,3,.35,glass,false);block(-22,26,-39,1.3,15,1.3,steel);block(-22,29,-39,18,.65,1.6,wall);building(23,-43,18,21,8,'CREW BARRACKS');
   for(let i=-3;i<=3;i++)for(const side of [-1,1]){block(side*(w/2-1),.55,i*20,.5,1.1,4,dark);block(side*(w/2-.7),1.2,i*20,.3,.2,3,friendly?cyan:amber,false);}
   pad(0,friendly?20:18,friendly?20:16);for(const a of [-24,24]){container(a,48,a<0?teal:orange,0,a<0?'31':'32');yard(a-2,35);}sign(friendly?'CNS WAYFARER':'CORSAIR / 09','FLIGHT DECK / SQUAD RESUPPLY',0,5,-39,13,2.3);for(const side of [-1,1]){deco(side*28,.035,8,.3,.03,66,yellow);for(let q=-60;q<64;q+=8)deco(side*34,1.15,q,.075,1.7,.075,pale);deco(side*34,1.9,0,.075,.075,length*.9,yellow);deco(side*34,.95,0,.065,.065,length*.9,steel);}
   for(const side of [-1,1])block(side*32,-3.5,0,.3,.6,length*.78,friendly?cyan:amber,false);
  }else if(s.kind==='station'){
   block(0,-2,0,204,4,156,dark);block(0,-6,0,176,6,134,steel);pad(0,28,26);building(-66,-18,45,74,22,'SHIP REPAIR');building(66,-18,45,74,22,'CREW QUARTERS');building(0,-52,80,28,15,'ANCHORAGE CONTROL');
   for(const side of [-1,1]){block(side*98,2,0,2,4,150,steel);block(side*98,4.2,0,.5,.4,146,cyan,false);block(side*148,-7,-8,70,1.3,100,dark);for(let i=-3;i<=3;i++)block(side*148,-6.2,i*13,66,.15,.5,cyan,false);block(side*89,38,-51,6,75,6,steel);block(side*89,75,-51,7,.7,7,amber,false);}
   container(-29,-27,teal,0,'A7');container(28,-27,orange,0,'B4');container(28,-27,blue,1);for(const a of [-32,32]){barrier(a,13);yard(a-2,0);}gantry(-33,83,16);block(0,2,-76,200,4,2,steel);block(0,2,76,200,4,2,steel);for(let i=-2;i<=2;i++)block(i*27,15,-64,2,30,2,steel);
  }else if(s.kind==='ruin'){
   for(let i=0;i<7;i++){const angle=i/7*Math.PI*2;block(Math.cos(angle)*24,6+(i%3)*2,Math.sin(angle)*24,5,12+(i%3)*4,5,steel);}
   block(-18,16,-18,31,2,4,wall);block(22,4,5,11,8,7,dark);pad(0,35,13);
  }else{
   const style=settlementStyle(s),harbour=style==='harbour';
   for(const room of getSettlementBuildings(s))building(room.a,room.c,room.w,room.d,room.h,room.label);
   // Shared landing/recovery space stays clear; each district has a distinct perimeter.
   pad(0,35,13);
   if(harbour){
    container(-15.8,-12,teal,0,'07');container(-15.8,-12,blue,1);container(16,-8,orange,0,'12');container(16,-8,teal,1);container(-16,15,blue,0,'04');container(19,13,teal,0,'09');
    for(const [a,c]of [[-6,23],[7,-26],[-8,-30],[27,4]])barrier(a,c);yard(-34,8);yard(23,-8);yard(-26,-42);gantry(-37,41,12);
    container(-17,48,orange,0,'16');container(18,50,blue,0,'18');crane(-44,-43,31);crane(47,-47,37);
   }else if(style==='relay'){
    // A broad radio dish replaces the north-west warehouse; short service rooms
    // and antenna terraces leave a recognisable open listening compound.
    block(-29,.4,-25,26,.8,26,concrete);block(-29,6.5,-25,3,13,3,steel);
    const profile=Array.from({length:12},(_,i)=>new THREE.Vector2(i*.88,Math.pow(i*.88,2)*.041));
    const dishGeometry=new THREE.LatheGeometry(profile,28),dishMaterial=pale.clone();dishMaterial.side=THREE.DoubleSide;const dish=new THREE.Mesh(dishGeometry,dishMaterial);dish.position.set(x-29,y+13,z-25);dish.rotation.x=.67;dish.castShadow=true;data.group.add(dish);data.geometries.push(dishGeometry);data.materials.push(dishMaterial);collider(data,x-29,y+15,z-24,20,6,17);
    deco(-29,15,-17,.25,11,.25,steel);deco(-29,20,-17,2,.8,1.4,amber);
    for(const [a,c,h]of [[-42,7,20],[40,-46,27],[24,3,15]]){block(a,.3,c,5,.6,5,concrete);block(a,h/2,c,.65,h,.65,steel);for(let k=3;k<h;k+=4){deco(a,k,c,5,.16,.3,pale);deco(a,k+.65,c,.2,1.4,4.5,steel);}deco(a,h+.3,c,.65,.5,.65,amber);}
    container(29,5,blue,0,'RF');barrier(-8,-29);barrier(8,-29);sign('NORTHWATCH ARRAY','LISTENING SECTOR / KEEP TRANSMITTERS CLEAR',0,5,-43,12,1.7);
   }else if(style==='mining'){
    // Open excavation machinery takes two warehouse footprints, with a conveyor
    // and terraced ore stockpile instead of another four-building courtyard.
    for(let level=0;level<3;level++)block(-31,level*.9+.45,-27,23-level*4,.9,22-level*4,ore);
    block(29,1.4,22,17,2.8,15,rust);for(const side of [-1,1]){block(29+side*7,6,22,.6,12,.6,steel);deco(29+side*7,12.5,22,.8,.35,15,yellow);}deco(29,12,22,16,.6,8,yellow);block(29,7,22,1.2,10,1.2,dark);
    for(let k=0;k<8;k++){const c=-24+k*4;block(-40,2.2,c,3.5,.35,3.8,steel);deco(-40,2.42,c,3.1,.08,3.6,black);for(const side of [-1,1])deco(-40+side*1.8,2.65,c,.1,.5,3.9,yellow);if(k%2===0)block(-40,1,c,.3,2,.3,steel);deco(-40,2.7,c,1.3,.5,1.7,ore);}
    crane(-43,-43,24);container(17,-24,orange,0,'ORE');yard(24,1);barrier(-8,-27);sign('TIDEBREAK EXTRACTION','ORE TRANSFER / ACTIVE MACHINERY',29,4,30.1,10,1.4);
   }else if(style==='salvage'){
    // Broken hull sections form irregular cover and reveal a scrapyard from the air.
    for(const [a,c,flip]of [[-28,-26,-1],[30,-25,1],[30,22,-1]]){block(a,1.2,c,7,2.4,18,rust);block(a+flip*4,2.9,c-5,6,3.5,7,dark);deco(a,4.8,c-6,5,.15,8,teal);block(a-flip*7,.6,c+3,13,1.2,5,steel);deco(a-flip*10,1.1,c+4,5,.25,4,yellow);for(const dx of [-2.3,2.3])block(a+dx,1.6,c+10,1.8,3.2,3,dark);for(let q=0;q<6;q++)deco(a,2.5,c-7+q*2.8,7.4,.15,.35,pale);}
    crane(-43,-43,23);yard(-24,-3);yard(22,-4);container(13,-35,orange,0,'CUT');sign('BREAKER YARD','RECOVER / REPAIR / RETURN TO SERVICE',0,5,-44,11,1.6);
   }else{
    // Two covered trading lanes replace the symmetrical warehouse grid.
    for(const a of [-29,29])for(const c of [-1,10]){deco(a,3.4,c,10,.2,8,a<0?orange:teal);for(const dx of [-4.6,4.6])for(const dz of [-3.5,3.5])block(a+dx,1.6,c+dz,.14,3.2,.14,steel);block(a,.7,c-2,8,1.4,1.5,dark);deco(a,1.46,c-2,8.2,.12,1.7,pale);for(let i=-2;i<=2;i++)deco(a+i*1.3,1.75,c-2,.75,.45,.8,i%2?yellow:blue);}
    container(28,-28,orange,0,'MKT');container(-29,28,teal,0,'MED');yard(20,-42);sign('FREEPORT EXCHANGE','FUEL / PARTS / FIELD SUPPLIES',0,5,-44,11,1.6);for(const a of [-42,42])streetlight(a,10);
   }
   // Barely lit service clutter, drains and pipe supports restore human scale.
   for(const side of [-1,1])for(const c of [-29,-11,8,27]){deco(side*10,.04,c,.48,.04,1.25,black);for(let j=0;j<8;j++)deco(side*10,.068,c-.5+j*.14,.46,.025,.03,steel);deco(side*23,3.2,c,1.1,.3,.35,rust);deco(side*23,1.6,c,.15,3.2,.15,steel);}
  }
  // An obvious recoverable locker marks the on-foot interaction, separate from the landing pad.
  if(s.id!=='landing-services'){block(0,.7,-3,2.4,1.4,1.3,dark);block(0,1.5,-3,2.5,.18,1.4,steel);
  const lamp=new THREE.Mesh(sharedBox,completed.has(s.id)?cyan:amber);lamp.scale.set(1.8,.11,.08);lamp.position.set(x,y+1.3,z-2.3);data.group.add(lamp);signals.set(s.id,lamp);}
  for(const [source,target,physical]of [[batches,data.group,true],[details,data.detail,false]] as const)for(const [material,matrices]of source){const mesh=new THREE.InstancedMesh(sharedBox,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.receiveShadow=true;mesh.castShadow=material!==cyan&&material!==amber;mesh.computeBoundingSphere();target.add(mesh);if(physical){data.meshes.push(mesh);occluders.push(mesh);}}
  data.group.name=s.name;return data;
 }
 // A coarse apron extends the visible continent beyond the detailed collision window.
 const horizonGeometry=new THREE.PlaneGeometry(20000,20000,96,96);horizonGeometry.rotateX(-Math.PI/2);
 const horizonCenter={value:new THREE.Vector2()},horizonMaterial=new THREE.MeshStandardMaterial({color:'#566d67',roughness:1});
 horizonMaterial.onBeforeCompile=shader=>{shader.uniforms.uDetailedCenter=horizonCenter;shader.vertexShader='varying vec3 horizonWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nhorizonWorld=position;');shader.fragmentShader='uniform vec2 uDetailedCenter;varying vec3 horizonWorld;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nvec2 offset=abs(horizonWorld.xz-uDetailedCenter);if(offset.x<895.5&&offset.y<895.5)discard;float riverX=2450.+sin(horizonWorld.z/490.)*180.+sin(horizonWorld.z/1700.)*320.;if(abs(horizonWorld.x-riverX)<72.&&length(horizonWorld.xz)>1800.)discard;');};
 const horizon=new THREE.Mesh(horizonGeometry,horizonMaterial);horizon.receiveShadow=false;scene.add(horizon);let horizonCell='';
 function updateHorizon(x:number,z:number){horizonCenter.value.set((Math.floor(x/CHUNK)+.5)*CHUNK,(Math.floor(z/CHUNK)+.5)*CHUNK);const cx=Math.floor(x/1024)*1024,cz=Math.floor(z/1024)*1024,key=`${cx}:${cz}`;if(key===horizonCell)return;horizonCell=key;const p=horizonGeometry.attributes.position;for(let i=0;i<p.count;i++){const lx=(i%97)/96*20000-10000,lz=Math.floor(i/97)/96*20000-10000;p.setXYZ(i,cx+lx,heightAt(cx+lx,cz+lz)-30,cz+lz);}p.needsUpdate=true;horizonGeometry.computeVertexNormals();horizonGeometry.computeBoundingSphere();}
 let current='';
 function sync(position:{x:number;y?:number;z:number}){
  const cx=Math.floor(position.x/CHUNK),cz=Math.floor(position.z/CHUNK),key=`${cx}:${cz}`;if(key===current)return;current=key;
  const wanted=new Set<string>();for(let dx=-RANGE;dx<=RANGE;dx++)for(let dz=-RANGE;dz<=RANGE;dz++)wanted.add(`${cx+dx}:${cz+dz}`);
  for(const[k,c]of chunks)if(!wanted.has(k)){remove(c);chunks.delete(k);}
  const cells=[...wanted].sort((a,b)=>{const[ax,az]=a.split(':').map(Number),[bx,bz]=b.split(':').map(Number);return Math.hypot(ax-cx,az-cz)-Math.hypot(bx-cx,bz-cz);});
  for(const k of cells)if(!chunks.has(k)){const[a,b]=k.split(':').map(Number);chunks.set(k,terrain(a,b));}
  const discovered=getWorldSites(position.x,position.z,1650),active=new Set(discovered.map(s=>s.id));
  for(const[k,s]of sites)if(!active.has(k)){remove(s);sites.delete(k);signals.delete(k);practicalLamps.delete(k);stackLocations.delete(k);}
  for(const site of discovered)if(!sites.has(site.id))sites.set(site.id,structure(site));
  updateHorizon(position.x,position.z);
 }
 // Landing platform is part of the same streamed site system but has no mission gate.
 const landingTemplate=getWorldSites(0,0,150).find(s=>s.id==='harbour')!;
 const startHub=structure({...landingTemplate,id:'landing-services',name:'Pathfinder Landing',x:0,z:110,elevation:16});
 const start=load(),startPad=getLandingPads(REGION_START.x,REGION_START.z,30)[0];
 const platform=new THREE.Mesh(new THREE.CylinderGeometry(17,17,.16,48),asphalt);platform.position.set(startPad.x,16.08,startPad.z);start.group.add(platform);start.geometries.push(platform.geometry);start.colliders.push(world.createCollider(RAPIER.ColliderDesc.cylinder(.08,17).setTranslation(startPad.x,16.08,startPad.z)));
 return{sync,smokestacks(){return [...stackLocations.values()].flat();},lamps(){return [...practicalLamps.values()].flat();},update(player:{x:number;y:number;z:number},time=0){kit.update(time);foamTime.value=time;startHub.detail.visible=Math.hypot(player.x,player.y-16,player.z-110)<320;for(const chunk of chunks.values())chunk.detail.visible=Math.hypot(player.x-chunk.center.x,player.z-chunk.center.z)<740&&player.y<800;for(const site of sites.values()){const distance=Math.hypot(player.x-site.center.x,player.y-site.center.y,player.z-site.center.z);site.group.visible=distance<1250;site.detail.visible=distance<320;}},setSiteComplete(id:string,done:boolean){if(done)completed.add(id);else completed.delete(id);const signal=signals.get(id);if(signal)signal.material=done?cyan:amber;},stats(){return{terrainChunks:chunks.size,loadedSites:sites.size,colliders:[...chunks.values(),...sites.values()].reduce((n,c)=>n+c.colliders.length,0),chunkSize:CHUNK,streamRadius:RANGE*CHUNK,procedural:true};}};
}
