import {MAIN_CONTRACTS,QUEST_PEOPLE} from './quest-data.mjs';
import {CONTRACTS,contractProgress} from './progression.mjs';
import {REGION_SITES,SPECIAL_SITES,getPlanetAt} from './region-layout.mjs';
import {DESTINATION_SITES} from './world-destinations.mjs';
export const AUTHORED_SITES=[...REGION_SITES,...SPECIAL_SITES,...DESTINATION_SITES];
export function missionDestination(contract,c,sites,position){
 if(contract.bearing)return AUTHORED_SITES.find(s=>s.id===contract.bearing)||sites.find(s=>s.id===contract.bearing)||null;
 const candidates=sites.filter(s=>contract.kind==='discoveries'?!c.discovered.includes(s.id):contract.kind==='scanned'?!c.scanned.includes(s.id):contract.kind==='signals'?s.id.startsWith('encounter:')&&!c.encountersCompleted.includes(s.id):false);
 return candidates.sort((a,b)=>Math.hypot(a.x-position.x,a.z-position.z)-Math.hypot(b.x-position.x,b.z-position.z))[0]??null;
}
export function missionBoard(c,sites,position){
 return CONTRACTS.filter(contract=>!MAIN_CONTRACTS.includes(contract.id)&&!!c.contracts[contract.id]).map(contract=>{const target=missionDestination(contract,c,sites,position),remote=target&&getPlanetAt(target.x,target.z).id!==getPlanetAt(position.x,position.z).id,p=contractProgress(c,contract),status=c.contracts[contract.id]??'available';
  return {giver:QUEST_PEOPLE.find(p=>p.quests.includes(contract.id))?.name??'Field contact',id:contract.id,title:contract.title,description:contract.description,status,reward:contract.reward,current:Math.min(p.current,p.target),total:p.target,target,
   location:target?`${getPlanetAt(target.x,target.z).name} · ${remote?'PLANET TRAVEL REQUIRED':Math.round(Math.hypot(target.x-position.x,target.z-position.z))+' m'}`:'ANY REGION',
   instruction:remote?`Board Kestrel and use Equipment & Travel to jump to ${getPlanetAt(target.x,target.z).name}, then follow the mission marker.`:target?`Follow the marker to ${target.name}.`:contract.kind==='air'?'Board Kestrel and engage airborne pirate patrols.':contract.kind==='signals'?'Fly or walk farther from settlements to find new distress signals.':'Explore farther, then scan for new locations.'};
 });
}
