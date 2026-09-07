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
const interactions={
 wreck:[{x:5,z:1,seconds:1.1,action:'ISOLATE DAMAGED DRIVE'},{x:0,z:5,seconds:.8,action:'RECOVER COURIER FLIGHT DATA'}],
 distress:[{x:-3,z:2,seconds:1.6,action:'REPAIR DISTRESS TRANSMITTER'},{x:0,z:5,seconds:.8,action:'RECOVER SURVEY TEAM CACHE'}],
 relic:[{x:0,z:5,seconds:3.2,action:'DECODE ANCIENT RESONANCE'}],
 bunker:[{x:0,z:5,seconds:2.4,action:'OVERRIDE SEALED SUPPLY LOCKER'}],
 convoy:[{x:0,z:5,seconds:1.2,action:'SEIZE PIRATE SHIPMENT'}],
 patrol:[{x:0,z:5,seconds:.7,action:'RECOVER PIRATE FIELD INTEL'}],
 friendly:[{x:0,z:5,seconds:.65,action:'REQUEST RECON SUPPLIES'}],
};
export function encounterInteractionSteps(site){return interactions[site.kind]??interactions.wreck;}
export function encounterRewardMessage(site){
 const result={wreck:'COURIER FLIGHT DATA SECURED',distress:'DISTRESS SIGNAL RESTORED · SURVEY CACHE SECURED',relic:'ANCIENT PULSE LATTICE DECODED',bunker:'LISTENING POST SUPPLIES RELEASED',convoy:'PIRATE SUPPLY RUN INTERCEPTED',patrol:'PIRATE FIELD INTEL RECOVERED',friendly:'RECON SUPPLIES SHARED'};
 return `${result[site.kind]??site.name.toUpperCase()} · +${site.reward} SALVAGE`;
}

/** Bounded, mesh-independent interaction state. Completed IDs retain the existing save format. */
export function createEncounterInteraction(completed=new Set()){
 const stages=new Map();let active='',progress=0,releaseRequired=false;
 const stage=site=>stages.get(site.id)??0;
 return{
  stage,
  requiresRelease(){return releaseRequired;},
  fraction(site){return active===site.id?Math.min(1,progress/encounterInteractionSteps(site)[stage(site)].seconds):0;},
  step(site,held,dt,guards=0){
   if(!held)releaseRequired=false;
   if(!site||!held||guards>0||completed.has(site.id)||releaseRequired){active='';progress=0;return false;}
   if(active!==site.id){active=site.id;progress=0;}
   progress+=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;
   const steps=encounterInteractionSteps(site),index=stage(site);
   if(progress+1e-8<steps[index].seconds)return false;
   progress=0;active='';releaseRequired=true;
   if(index+1<steps.length){
    stages.delete(site.id);stages.set(site.id,index+1);
    if(stages.size>128)stages.delete(stages.keys().next().value);
    return false;
   }
   stages.delete(site.id);completed.add(site.id);return true;
  },
  reset(){stages.clear();active='';progress=0;releaseRequired=false;},
  snapshot(){return{active,progress,releaseRequired,stages:[...stages]};},
 };
}
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
 return result.filter(s=>Math.hypot(s.x-x,s.z-z)<radius&&heightAt(s.x,s.z)>3).map(s=>({...s,elevation:heightAt(s.x,s.z),radius:30,faction:['convoy','patrol','distress'].includes(s.kind)?'pirate':s.kind==='friendly'?'friendly':'neutral',guardCount:s.kind==='convoy'?4:s.kind==='patrol'?3:s.kind==='distress'?2:0,description:({wreck:'Isolate the damaged drive, then recover the courier flight data from its orange case.',distress:'Clear the perimeter, repair the transmitter by the shelter, then recover the survey team cache.',convoy:'Ambush the armed supply convoy and seize its shipment.',patrol:'A roaming pirate patrol carries valuable field intelligence.',friendly:'Colonial scouts can share a spare supply case. Follow the cyan beacon.',bunker:'Override the listening post locker to release its sealed supplies.',relic:'Hold a steady scan to decode an ancient pulse lattice for cannon refits.'})[s.kind],reward:s.kind==='friendly'?35:s.kind==='convoy'?130:s.kind==='distress'?100:s.kind==='relic'?110:70}));
}
