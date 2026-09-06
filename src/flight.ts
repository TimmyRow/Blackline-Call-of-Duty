import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import * as region from './region-layout.mjs';

type LandingPad={id:string,name:string,x:number,z:number,y:number,radius:number};
type FlightInput={keys:Set<string>,yaw:number,pitch:number};
type FlightRegion={REGION_START:{x:number,z:number},SEA_LEVEL?:number,heightAt:(x:number,z:number)=>number,getLandingPads?:(x:number,z:number,radius:number)=>LandingPad[]};
const layout=region as FlightRegion;
const GEAR_HEIGHT=2.15, CRUISE=140, BOOST=420;

/** One VTOL vessel, in the same world and physics query space as the infantry. */
export function createFlight(scene:THREE.Scene,world:RAPIER.World,initial?:{x:number,z:number,y?:number}){
 const spawn={x:initial?.x??layout.REGION_START.x+12,z:initial?.z??layout.REGION_START.z+4,y:initial?.y};
 const position=new THREE.Vector3(),velocity=new THREE.Vector3(),group=new THREE.Group();
 group.name='Kestrel squad dropship';scene.add(group);
 const shell=new THREE.Group(),cockpit=new THREE.Group();group.add(shell,cockpit);
 const paint=new THREE.MeshStandardMaterial({color:0x283942,roughness:.57,metalness:.7});
 const armor=new THREE.MeshStandardMaterial({color:0x687880,roughness:.66,metalness:.62});
 const black=new THREE.MeshStandardMaterial({color:0x111a20,roughness:.87,metalness:.3});
 const trim=new THREE.MeshStandardMaterial({color:0xd09342,roughness:.58,metalness:.45});
 const glow=new THREE.MeshBasicMaterial({color:0x72ebff,toneMapped:false});
 const thrustMaterial=new THREE.MeshBasicMaterial({color:0x36bdeb,transparent:true,opacity:.58,depthWrite:false,toneMapped:false});
 const screen=new THREE.MeshBasicMaterial({color:0x173d4b,toneMapped:false});
 const engines:THREE.Mesh[]=[];
 function box(parent:THREE.Object3D,size:number[],at:number[],material:THREE.Material,rotation?:number[]){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size as [number,number,number]),material);mesh.position.set(...at as [number,number,number]);if(rotation)mesh.rotation.set(...rotation as [number,number,number]);parent.add(mesh);return mesh;}
 function strut(parent:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,width:number,material:THREE.Material){const beam=box(parent,[width,a.distanceTo(b),width],a.clone().add(b).multiplyScalar(.5).toArray(),material);beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return beam;}
 // The broad fuselage and short outriggers read as a squad transport rather than a fighter.
 box(shell,[3.8,2.3,7.9],[0,.15,.4],paint);
 box(shell,[3.35,1.55,2.8],[0,.08,-4.1],armor,[.14,0,0]);
 box(shell,[3.6,.2,7.7],[0,1.4,.4],armor);
 box(shell,[3.86,.22,5.2],[0,.3,1],trim);
 box(shell,[2.5,1.25,.16],[0,-.2,4.42],black);
 for(const sign of [-1,1]){
  box(shell,[2.25,.35,3.1],[sign*2.5,-.2,.6],armor,[0,0,sign*.08]);
  box(shell,[1.3,1.25,4.8],[sign*3.65,.0,1.1],paint);
  box(shell,[1.34,.12,3.7],[sign*3.65,.66,1.1],trim);
  for(let j=0;j<4;j++)box(shell,[1.05,.075,.17],[sign*3.65,.75,j*.42+.3],black);
  const exhaust=new THREE.Mesh(new THREE.CylinderGeometry(.44,.62,1.1,12),black);exhaust.rotation.x=Math.PI/2;exhaust.position.set(sign*3.65,0,3.8);shell.add(exhaust);
  const plume=new THREE.Mesh(new THREE.ConeGeometry(.46,2.8,12,1,true),thrustMaterial);plume.rotation.x=Math.PI/2;plume.position.set(sign*3.65,0,5.1);shell.add(plume);engines.push(plume);
  for(const z of [-2.7,2.8]){
   strut(shell,new THREE.Vector3(sign*1.4,-.7,z),new THREE.Vector3(sign*2.0,-1.9,z+.25),.14,armor);
   box(shell,[.9,.18,1.2],[sign*2.0,-2.05,z+.25],black);
   const jet=new THREE.Mesh(new THREE.ConeGeometry(.25,1.6,8,1,true),thrustMaterial);jet.position.set(sign*2.5,-1,z);jet.rotation.z=Math.PI; shell.add(jet);engines.push(jet);
  }
  box(shell,[.28,1.5,2.1],[sign*3.65,1.15,2.55],armor,[.15,0,0]);
  box(shell,[.12,.08,1.5],[sign*4.35,.15,-.2],glow);
 }
 // A deliberately open windshield preserves visibility; the real cockpit structure frames it.
 box(cockpit,[3.25,.18,4.2],[0,-.65,-2.05],black);
 box(cockpit,[3.35,.6,.82],[0,-.07,-3.2],paint,[-.15,0,0]);
 box(cockpit,[3.7,.15,.34],[0,1.85,-2.45],black);
 for(const sign of [-1,1]){
  strut(cockpit,new THREE.Vector3(sign*1.63,-.1,-3.5),new THREE.Vector3(sign*1.35,1.85,-2.65),.13,armor);
  box(cockpit,[.26,1.35,3.7],[sign*1.65,.04,-1.8],black);
  const panel=box(cockpit,[.85,.045,.5],[sign*.85,.27,-3.06],screen,[.35,0,0]);
  for(let i=0;i<4;i++)box(panel,[.1,.012,.035],[-.28+i*.18,.032,-.1],glow);
  box(cockpit,[.55,.07,.32],[sign*1.29,.2,-2.1],paint);
  strut(cockpit,new THREE.Vector3(sign*.52,-.5,-2.5),new THREE.Vector3(sign*.52,.06,-2.72),.065,black);
  box(cockpit,[.22,.1,.12],[sign*.52,.05,-2.72],armor);
 }
 box(cockpit,[.52,.06,.32],[0,.28,-3.1],trim,[.35,0,0]);
 let piloting=false,landed=true,health=100,energy=100,yaw=0,pitch=0,fireCooldown=0,collisionCount=0,impactCooldown=0,padName='';
 const sweepShape=new RAPIER.Cuboid(4.4,1.6,5.6),identity={x:0,y:0,z:0,w:1};
 const shipRotation=new THREE.Quaternion();
 const body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
 const collider=world.createCollider(RAPIER.ColliderDesc.cuboid(1.85,1.05,4.5),body);
 const direction=new THREE.Vector3(),next=new THREE.Vector3(),delta=new THREE.Vector3(),eye=new THREE.Vector3();
 function surface(x:number,z:number,altitude:number){
  const terrain=layout.heightAt(x,z),sea=layout.SEA_LEVEL??-2.5;
  let y=Math.max(terrain,sea),safe=terrain>sea+.1,name='Open terrain';
  const pads=layout.getLandingPads?.(x,z,60)??[];
  for(const pad of pads)if(Math.hypot(x-pad.x,z-pad.z)<pad.radius&&pad.y<=altitude+3&&pad.y>=y){y=pad.y;safe=true;name=pad.name;}
  return {y,safe,name};
 }
 function reset(){const floor=surface(spawn.x,spawn.z,spawn.y??layout.heightAt(spawn.x,spawn.z)+GEAR_HEIGHT);position.set(spawn.x,spawn.y??floor.y+GEAR_HEIGHT,spawn.z);velocity.set(0,0,0);piloting=false;landed=true;health=100;energy=100;yaw=0;pitch=0;collisionCount=0;fireCooldown=0;padName=floor.name;group.position.copy(position);group.rotation.set(0,0,0);body.setTranslation(position,true);body.setNextKinematicTranslation(position);body.setRotation(identity,true);body.setNextKinematicRotation(identity);shell.visible=true;}
 reset();
 return {
  position,velocity,group,collider,
  get piloting(){return piloting;},get landed(){return landed;},get health(){return health;},
  reset,
  board(player:THREE.Vector3){if(piloting||!landed||health<=0||player.distanceTo(position)>9)return false;piloting=true;shell.visible=false;return true;},
  tryExit(){
   if(!piloting||!landed)return null;
   for(const side of [1,-1])for(const aft of [0,3]){
    const offset=new THREE.Vector3(side*5.7,0,aft).applyAxisAngle(THREE.Object3D.DEFAULT_UP,yaw),x=position.x+offset.x,z=position.z+offset.z;
    const floor=surface(x,z,position.y);if(!floor.safe||Math.abs(floor.y-(position.y-GEAR_HEIGHT))>1.3)continue;
    const candidate=new THREE.Vector3(x,floor.y+1.0,z);
    const obstruction=world.intersectionWithShape(candidate,identity,new RAPIER.Capsule(.58,.28),RAPIER.QueryFilterFlags.ONLY_FIXED);
    if(obstruction)continue;
    piloting=false;shell.visible=true;velocity.set(0,0,0);return candidate.setY(floor.y+1.7);
   }
   return null;
  },
  nearbyPrompt(player:THREE.Vector3){return !piloting&&landed&&health>0&&player.distanceTo(position)<9?'F — PILOT KESTREL':null;},
  hurt(amount:number){health=Math.max(0,health-Math.max(0,amount));},
  repair(amount=100){health=Math.min(100,health+Math.max(0,amount));},
  step(dt:number,input:FlightInput){
   fireCooldown=Math.max(0,fireCooldown-dt);impactCooldown=Math.max(0,impactCooldown-dt);energy=Math.min(100,energy+dt*13);
   if(!piloting){if(landed)health=Math.min(100,health+dt*.7);return;}
   yaw=input.yaw;pitch=THREE.MathUtils.clamp(input.pitch,-1.45,1.45);
   const keys=input.keys,boost=keys.has('ShiftLeft')||keys.has('ShiftRight');
   const forward=Number(keys.has('KeyW'))-Number(keys.has('KeyS')),right=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));
   const ascent=Number(keys.has('Space'))-Number(keys.has('ControlLeft')||keys.has('ControlRight')||keys.has('KeyC'));
   if(landed&&ascent>0&&health>0)landed=false;
   if(landed){velocity.set(0,0,0);padName=surface(position.x,position.z,position.y).name;health=Math.min(100,health+dt*.7);return;}
   direction.set(right,0,-forward);if(direction.lengthSq()>1)direction.normalize();direction.applyAxisAngle(THREE.Object3D.DEFAULT_UP,yaw).multiplyScalar(boost?BOOST:CRUISE);
   direction.y=ascent*(boost?180:80);if(health<=0)direction.set(0,-12,0);
   velocity.lerp(direction,1-Math.exp(-dt*(forward||right||ascent?1.8:3.4)));
   delta.copy(velocity).multiplyScalar(dt);next.copy(position).add(delta);
   // Continuous swept volume prevents boost-speed tunnelling through static structures.
   if(delta.lengthSq()>.000001){
    shipRotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP,yaw);
    const hit=world.castShape(position,shipRotation,delta,sweepShape,.025,1,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
    if(hit){const speed=velocity.length();next.copy(position).addScaledVector(delta,Math.max(0,hit.time_of_impact-.025));velocity.multiplyScalar(.08);collisionCount++;
     if(speed>22&&impactCooldown<=0){health=Math.max(0,health-Math.min(42,(speed-22)*.13));impactCooldown=.65;}
    }
   }
   const floor=surface(next.x,next.z,Math.max(position.y,next.y)),height=floor.y+GEAR_HEIGHT;
   if(next.y<=height+.12){
    next.y=height;if(velocity.y<0)velocity.y=0;
    if(floor.safe&&ascent<=0&&Math.hypot(velocity.x,velocity.z)<19){landed=true;velocity.set(0,0,0);padName=floor.name;}
   }
   // The upper atmosphere is traversable; soft ascent attenuation keeps coordinates bounded.
   if(next.y>8000){next.y=8000;velocity.y=Math.min(0,velocity.y);}
   position.copy(next);body.setNextKinematicTranslation(position);body.setNextKinematicRotation(shipRotation);
  },
  cameraPose(){eye.set(0,.65,-2.05).applyAxisAngle(THREE.Object3D.DEFAULT_UP,yaw).add(position);return {position:eye.clone(),yaw,pitch};},
  fire(){if(!piloting||health<=0||fireCooldown>0||energy<5)return null;fireCooldown=.14;energy-=5;const shotDirection=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(pitch,yaw,0,'YXZ'));return {origin:position.clone().add(new THREE.Vector3(0,.7,0)).addScaledVector(shotDirection,6),direction:shotDirection};},
  render(_dt:number,time:number){group.position.copy(position);group.rotation.set(0,yaw,0);shell.visible=!piloting;cockpit.visible=true;engines.forEach((engine,i)=>{engine.visible=!landed;engine.scale.y=.65+velocity.length()*.006+Math.sin(time*31+i)*.08;});},
  snapshot(){const floor=surface(position.x,position.z,position.y);return {piloting,landed,health:Math.round(health),energy:Math.round(energy),position:position.toArray(),velocity:velocity.toArray(),speed:Math.round(velocity.length()),altitude:Math.max(0,Math.round(position.y-GEAR_HEIGHT-floor.y)),worldAltitude:Math.round(position.y),yaw,pitch,pad:landed?padName:null,collisionCount,controls:'WASD fly · SPACE rise · CTRL descend · SHIFT boost · F exit when landed · LMB cannons'};},
 };
}
