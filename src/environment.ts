import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {buildRegion} from './region';
import {createIndustrialMaterials} from './industrial-materials';
import {createIndustrialRoads} from './industrial-roads';
import {SEA_LEVEL,worldHash} from './region-layout.mjs';

/** Presentation and streamed static collision share the same deterministic planet. */
export function buildEnvironment(scene:THREE.Scene,world:RAPIER.World){
 const occluders:THREE.Object3D[]=[];
 const atmosphere=new THREE.Color('#203b48');scene.background=atmosphere;scene.fog=new THREE.FogExp2(atmosphere,.0013);
 const envCanvas=document.createElement('canvas');envCanvas.width=512;envCanvas.height=256;const ctx=envCanvas.getContext('2d')!,gradient=ctx.createLinearGradient(0,0,0,256);gradient.addColorStop(0,'#102430');gradient.addColorStop(.45,'#526f7c');gradient.addColorStop(.55,'#7b9295');gradient.addColorStop(1,'#263b42');ctx.fillStyle=gradient;ctx.fillRect(0,0,512,256);ctx.fillStyle='#e7d3ac';ctx.fillRect(345,85,38,24);const environment=new THREE.CanvasTexture(envCanvas);environment.colorSpace=THREE.SRGBColorSpace;environment.mapping=THREE.EquirectangularReflectionMapping;scene.environment=environment;scene.environmentIntensity=1.7;
 const hemisphere=new THREE.HemisphereLight('#a3becb','#374952',2.15);scene.add(hemisphere);
 const sun=new THREE.DirectionalLight('#b7cfe0',2.8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-110;sun.shadow.camera.right=110;sun.shadow.camera.top=110;sun.shadow.camera.bottom=-110;sun.shadow.camera.near=1;sun.shadow.camera.far=420;sun.shadow.bias=-.00035;sun.shadow.normalBias=.25;scene.add(sun,sun.target);
 const altitude={value:0},clock={value:0};
 const sky=new THREE.Mesh(new THREE.SphereGeometry(12000,48,24),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{altitude},vertexShader:'varying vec3 vDirection;void main(){vDirection=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position=p.xyww;}',fragmentShader:`varying vec3 vDirection;uniform float altitude;void main(){vec3 d=normalize(vDirection);float h=max(0.0,d.y);vec3 horizon=vec3(.025,.062,.085),zenith=vec3(.004,.018,.033);vec3 col=mix(horizon,zenith,pow(h,.42));float sun=pow(max(0.0,dot(d,normalize(vec3(-.6,.32,-.7)))),32.);col+=vec3(.01,.014,.02)*sun;col=mix(col,vec3(.005,.012,.028)+col*.075,altitude);gl_FragColor=vec4(col,1.);}` }));sky.frustumCulled=false;sky.renderOrder=-10;scene.add(sky);
 const starsGeo=new THREE.BufferGeometry(),stars=new Float32Array(2300*3);for(let i=0;i<2300;i++){const a=worldHash(i,0)*Math.PI*2,b=worldHash(i,1)*2-1,r=Math.sqrt(1-b*b);stars.set([Math.cos(a)*r*9000,b*9000,Math.sin(a)*r*9000],i*3);}starsGeo.setAttribute('position',new THREE.BufferAttribute(stars,3));const starMat=new THREE.PointsMaterial({color:'#c7e0eb',size:9,sizeAttenuation:true,transparent:true,opacity:.24,depthWrite:false});const starField=new THREE.Points(starsGeo,starMat);starField.frustumCulled=false;scene.add(starField);
 const moon=new THREE.Mesh(new THREE.SphereGeometry(930,48,32),new THREE.MeshStandardMaterial({color:'#65767b',roughness:1}));moon.material.onBeforeCompile=shader=>{shader.vertexShader='varying vec3 vPlanet;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPlanet=position;');shader.fragmentShader='varying vec3 vPlanet;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat bands=sin(vPlanet.y*.023+sin(vPlanet.x*.006)*2.0);diffuseColor.rgb*=.72+.22*bands;');};moon.castShadow=false;scene.add(moon);
 const rings=new THREE.Mesh(new THREE.RingGeometry(1170,1670,100),new THREE.MeshBasicMaterial({color:'#b0ad99',transparent:true,opacity:.085,side:THREE.DoubleSide,depthWrite:false}));rings.rotation.set(1.05,.2,-.25);scene.add(rings);
 const oceanMat=new THREE.MeshStandardMaterial({color:'#174b60',metalness:.48,roughness:.38,transparent:true,opacity:.96,side:THREE.DoubleSide});
 oceanMat.onBeforeCompile=shader=>{
  shader.uniforms.uOceanTime=clock;shader.vertexShader='uniform float uOceanTime;varying vec3 vOceanWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvec3 wp=(modelMatrix*vec4(position,1.0)).xyz;transformed.y += sin(wp.x*.034+uOceanTime*.75)*.35+sin(wp.z*.047-uOceanTime*.6)*.25;vOceanWorld=wp;');
  shader.fragmentShader='uniform float uOceanTime;varying vec3 vOceanWorld; float oh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);} float on(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(oh(i),oh(i+vec2(1,0)),f.x),mix(oh(i+vec2(0,1)),oh(i+vec2(1,1)),f.x),f.y);}\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nfloat detailFade=1.-smoothstep(90.,650.,distance(cameraPosition,vOceanWorld));vec2 uv=vOceanWorld.xz*.16+vec2(uOceanTime*.03,uOceanTime*.02);normal=normalize(normal+vec3(on(uv)-.5,0.0,on(uv+vec2(13.,7.))-.5)*.09*detailFade);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat wave=on(vOceanWorld.xz*.025+vec2(uOceanTime*.02,0.));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.22,.43,.48),smoothstep(.50,.9,wave)*.18);');
 };
 const ocean=new THREE.Mesh(new THREE.PlaneGeometry(100000,100000,160,160).rotateX(-Math.PI/2),oceanMat);ocean.position.y=SEA_LEVEL-.18;ocean.receiveShadow=true;scene.add(ocean);
 const materials=createIndustrialMaterials(),region=buildRegion(scene,world,occluders);
 const roads=createIndustrialRoads(scene,world,{steel:materials.steel,dark:materials.dark,asphalt:materials.asphalt,concrete:materials.concrete,yellow:materials.yellow,pale:materials.pale,amber:materials.amber});
 // Keep the shader light count fixed: changing visibility recompiles every lit material during flight.
 const practicals=Array.from({length:8},(_,i)=>{const light=new THREE.PointLight(i%2?'#ffb35c':'#73cfff',100,24,2);scene.add(light);return light;});
 let lightCell='';
 function updateLights(player:THREE.Vector3){const key=`${Math.floor(player.x/24)}:${Math.floor(player.y/24)}:${Math.floor(player.z/24)}`;if(key===lightCell)return;lightCell=key;
  const candidates=[...region.lamps(),...roads.lamps];
  candidates.sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y,a.z-player.z)-Math.hypot(b.x-player.x,b.y-player.y,b.z-player.z));
  practicals.forEach((light,i)=>{const p=candidates[i];light.intensity=p&&Math.hypot(p.x-player.x,p.y-player.y,p.z-player.z)<180?100:0;if(p){light.position.set(p.x,p.y,p.z);light.color.set(p.color);}});materials.setWetLights(practicals);
 }
 const rainGeo=new THREE.BufferGeometry(),rainVertices=new Float32Array(1100*6);rainGeo.setAttribute('position',new THREE.BufferAttribute(rainVertices,3));
 const rainMat=new THREE.LineBasicMaterial({color:'#a8c6d5',transparent:true,opacity:.21,depthWrite:false});const rain=new THREE.LineSegments(rainGeo,rainMat);rain.frustumCulled=false;scene.add(rain);

 return{occluders,sync(position:THREE.Vector3){region.sync(position);roads.sync(position);},stats(){return{...region.stats(),...roads.stats()};},setSiteComplete:region.setSiteComplete,update(_dt:number,time:number,player:THREE.Vector3){
  region.update(player,time);roads.update(time,player);updateLights(player);
  rain.visible=player.y<300;rainMat.opacity=.21*(1-THREE.MathUtils.smoothstep(player.y,120,300));if(rain.visible){for(let i=0;i<1100;i++){const x=worldHash(i,51)*70-35,z=worldHash(i,52)*70-35,y=((worldHash(i,53)*32-time*(15+worldHash(i,54)*5))%32+32)%32-6;rainVertices.set([player.x+x,player.y+y,player.z+z,player.x+x-.1,player.y+y-.75,player.z+z+.08],i*6);}rainGeo.attributes.position.needsUpdate=true;}
  clock.value=time;altitude.value=THREE.MathUtils.smoothstep(player.y,350,1550);sky.position.copy(player);starField.position.copy(player);starMat.opacity=.2+altitude.value*.8;
  moon.position.set(player.x-4800,player.y+2600,player.z-6200);rings.position.copy(moon.position);ocean.position.x=Math.floor(player.x/512)*512;ocean.position.z=Math.floor(player.z/512)*512;
  const fog=scene.fog as THREE.FogExp2;fog.color.copy(atmosphere).lerp(new THREE.Color('#081728'),altitude.value);fog.density=THREE.MathUtils.lerp(.0013,.00032,THREE.MathUtils.smoothstep(player.y,40,280))*(1-altitude.value)+.000028*altitude.value;
  hemisphere.intensity=2.15-altitude.value*.6;const sx=Math.floor(player.x/32)*32,sy=Math.floor(player.y/8)*8,sz=Math.floor(player.z/32)*32;sun.position.set(sx-100,sy+150,sz-100);sun.target.position.set(sx,sy,sz);
 }};
}
