import {heightAt,worldHash,getWorldSites} from './region-layout.mjs';
const anchors=[
 {id:'encounter:wreck:landing',name:'Fallen Courier',x:83,z:176,kind:'wreck'},
 {id:'encounter:distress:coast',name:'Lost Survey Team',x:-175,z:140,kind:'distress'},
 {id:'encounter:convoy:arsenal',name:'Pirate Supply Convoy',x:326,z:-122,kind:'convoy'},
 {id:'encounter:patrol:north',name:'Wraith Recon Patrol',x:-309,z:-167,kind:'patrol'},
 {id:'encounter:friendly:landing',name:'Colonial Recon',x:354,z:-146,kind:'friendly'},
 {id:'encounter:bunker:ridge',name:'Silent Listening Post',x:-420,z:85,kind:'bunker'},
];
export const isEncounterId=id=>typeof id==='string'&&id.startsWith('encounter:');
export function encounterPosition(site,time=0){
 if(!['patrol','convoy','friendly'].includes(site.kind))return{x:site.x,z:site.z};
 const phase=Math.sin(time*.012+(site.kind==='friendly'?1.1:0));
 return{x:site.x+phase*(site.kind==='convoy'?22:14),z:site.z+phase*(site.kind==='convoy'?-12:9)};
}
export function getEncounterSites(x,z,radius=950){
 const result=[...anchors];
 const size=940;
 for(let cx=Math.floor((x-radius)/size);cx<=Math.floor((x+radius)/size);cx++)for(let cz=Math.floor((z-radius)/size);cz<=Math.floor((z+radius)/size);cz++){
  const px=cx*size+130+worldHash(cx,cz,77)*660,pz=cz*size+130+worldHash(cx,cz,78)*660;
  if(Math.hypot(px,pz)<550||heightAt(px,pz)<8||getWorldSites(px,pz,150).length)continue;
  const kinds=['wreck','relic','bunker','distress','patrol','friendly','convoy'],kind=kinds[Math.floor(worldHash(cx,cz,79)*kinds.length)];
  result.push({id:`encounter:${kind==='convoy'?'convoy:':''}${cx}:${cz}`,name:({wreck:'Wrecked Prospector',relic:'Ancient Resonator',bunker:'Abandoned Field Bunker',distress:'Emergency Transponder',patrol:'Pirate Recon Patrol',friendly:'Colonial Survey Patrol',convoy:'Pirate Supply Run'})[kind],x:px,z:pz,kind});
 }
 return result.filter(s=>Math.hypot(s.x-x,s.z-z)<radius&&heightAt(s.x,s.z)>3).map(s=>({...s,elevation:heightAt(s.x,s.z),radius:30,faction:['convoy','patrol','distress'].includes(s.kind)?'pirate':s.kind==='friendly'?'friendly':'neutral',guardCount:s.kind==='convoy'?4:s.kind==='patrol'?3:s.kind==='distress'?2:0,description:({wreck:'A courier fell here carrying unclaimed cargo.',distress:'A broken distress signal. Clear the perimeter and recover the survey records.',convoy:'An armed supply convoy. Ambush it or slip past.',patrol:'A roaming pirate patrol. Choose whether to engage.',friendly:'Colonial scouts are surveying the road ahead.',bunker:'An old listening post still has a sealed supply locker.',relic:'An ancient resonator is sending an unfamiliar signal.'})[s.kind],reward:s.kind==='convoy'?130:s.kind==='distress'?100:s.kind==='relic'?110:70}));
}
