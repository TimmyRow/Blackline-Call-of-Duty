import * as THREE from 'three';
type Raider={id:string,group:THREE.Group,position:THREE.Vector3,health:number,cooldown:number,seed:number};
export function createSpacePirates(scene:THREE.Scene){
 const raiders:Raider[]=[],sectors=new Set<string>();let time=0;
 const hull=new THREE.MeshStandardMaterial({color:0x492f36,metalness:.75,roughness:.4}),black=new THREE.MeshStandardMaterial({color:0x171d26,metalness:.65,roughness:.45}),red=new THREE.MeshBasicMaterial({color:0xff633e});
 function spawn(position:THREE.Vector3,index:number,id:string){const group=new THREE.Group();
  function box(x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);group.add(m);}
  box(0,0,0,3,1.8,9,hull);box(0,.7,-2,1.8,.8,2,black);box(-5,0,1,5,.55,5,hull);box(5,0,1,5,.55,5,hull);box(-6,0,-2,1,1,9,black);box(6,0,-2,1,1,9,black);box(-3,0,5,1,1,1,red);box(3,0,5,1,1,1,red);
  const cone=new THREE.Mesh(new THREE.ConeGeometry(1.6,4,6),hull);cone.rotation.x=-Math.PI/2;cone.position.z=-6;group.add(cone);group.position.copy(position);scene.add(group);raiders.push({id,group,position:position.clone(),health:150,cooldown:2+index,seed:index*2.4});
 }
 return {raiders,reset(){for(const r of raiders){scene.remove(r.group);r.group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});}raiders.length=0;sectors.clear();time=0;},
 step(dt:number,player:THREE.Vector3,active:boolean,onShot:(a:THREE.Vector3,b:THREE.Vector3)=>void,onDamage:(n:number)=>void){time+=dt;
  if(active&&player.y>180){const sector=`${Math.floor(player.x/1400)},${Math.floor(player.z/1400)}`;if(!sectors.has(sector)&&raiders.filter(r=>r.health>0).length<4){sectors.add(sector);for(let i=0;i<3;i++)spawn(player.clone().add(new THREE.Vector3(Math.sin(i*2.1)*240,25+i*12,-280+Math.cos(i*2.1)*100)),i,`${sector}:${i}`);}}
  for(let i=raiders.length-1;i>=0;i--){const r=raiders[i],d=r.position.distanceTo(player);if(d>2200||r.health<=0){scene.remove(r.group);r.group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});raiders.splice(i,1);continue;}r.group.visible=active;if(!active)continue;
   const offset=new THREE.Vector3(Math.sin(time*.35+r.seed)*90,Math.sin(time*.4+r.seed)*32,Math.cos(time*.35+r.seed)*90),destination=player.clone().add(offset),delta=destination.sub(r.position),speed=d>400?240:d>160?95:45;const travel=Math.min(speed*dt,delta.length());r.position.addScaledVector(delta.normalize(),travel);r.group.position.copy(r.position);r.group.lookAt(player);r.group.rotateY(Math.PI);r.cooldown-=dt;
   if(d<420&&r.cooldown<=0){r.cooldown=1.6+Math.random()*.6;onShot(r.position.clone(),player.clone());if(d<260)onDamage(3);}
  }
 },hit(origin:THREE.Vector3,direction:THREE.Vector3,maxDistance=1500){let best:Raider|null=null,nearest=maxDistance;for(const r of raiders){const delta=r.position.clone().sub(origin),along=delta.dot(direction);if(along<0||along>nearest)continue;if(delta.addScaledVector(direction,-along).length()<14){best=r;nearest=along;}}if(!best)return null;best.health-=45;return {position:best.position.clone(),killed:best.health<=0};},snapshot(){return raiders.map(r=>({id:r.id,position:r.position.toArray(),health:r.health}));}};
}
