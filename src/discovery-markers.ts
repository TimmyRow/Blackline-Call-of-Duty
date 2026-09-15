import * as THREE from 'three';
import {discoverySites,claimDiscovery} from './frontier-discoveries.mjs';
export function createDiscoveries(scene:THREE.Scene){
 const sites=discoverySites(),geometry=new THREE.BoxGeometry(.8,1,.6),material=new THREE.MeshStandardMaterial({color:0x79dadd,emissive:0x2e8c9f,emissiveIntensity:.8,roughness:.45});
 const cases=sites.map(s=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(s.x,s.elevation+.5,s.z);scene.add(mesh);return{site:s,mesh};});let progress=0,active='';
 function near(c:any,p:THREE.Vector3,boating:boolean,speed:number){return sites.find(s=>!c.clues?.includes(s.id)&&Math.hypot(p.x-s.x,p.z-s.z)<(s.ocean?8:3.5)&&Math.abs(p.y-s.elevation)<(s.ocean?8:4)&&(!s.ocean||(boating&&Math.abs(speed)<2)));}
 return{sites,reset(){progress=0;active='';},
 update(c:any,p:THREE.Vector3,time:number){for(const {site,mesh} of cases){mesh.visible=!c.clues?.includes(site.id)&&p.distanceTo(mesh.position)<180;if(site.ocean)mesh.position.y=1+Math.sin(time*1.4)*.18;}},
 prompt(c:any,p:THREE.Vector3,boating:boolean,speed:number){const s=near(c,p,boating,speed);return s?{text:'HOLD E · '+(s.ocean?'RECOVER DISTRESS BUOY':s.name.toUpperCase()),progress:progress/1.2}:null;},
 step(c:any,p:THREE.Vector3,held:boolean,dt:number,boating:boolean,speed:number){const s=near(c,p,boating,speed);if(!s||!held){progress=0;active='';return null;}if(active!==s.id){active=s.id;progress=0;}progress+=Math.min(.1,Math.max(0,dt));if(progress<1.2)return null;progress=0;active='';return claimDiscovery(c,s.id);}
 };
}
