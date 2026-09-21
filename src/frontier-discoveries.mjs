import {ROADSIDE_STORIES,WORLD_LANDMARKS,heightAt,getPlanetAt,biomeAt} from './region-layout.mjs';
import {targetNavigation,bearingTo,cardinal} from './navigation.mjs';
export const DISCOVERIES=[
 ...ROADSIDE_STORIES.map((s,i)=>({id:'clue:'+s.id,name:s.name,x:s.x+3,z:s.z+3,reward:20,blueprint:null,ocean:false,story:[
 'A passenger list records civilians reaching Pathfinder. Someone stayed behind to keep the road open.',
 'The repair crew left a field manual. Their final radio call came from the northern listening post.',
 'A cut cable still carries a burst transmission: the pirates are listening for the missing fleet.',
 'The manifest names two armed trucks on the arsenal road. Iris at Cold Harbour needs their route stopped.',
 'The coastwatch log records a supply buoy north of CNS Wayfarer. Approach by launch and stop beside its light.'
 ][i]})),
 ...WORLD_LANDMARKS.filter(s=>s.kind==='cave'||s.kind==='wreck').map(s=>({id:'clue:'+s.id,name:s.name+' archive',x:s.x+(s.kind==='cave'?3.4:0),z:s.z-6,reward:55,blueprint:s.kind==='cave'?'scanner':'handling',ocean:false,story:s.kind==='cave'?'Sheltered survey equipment holds a rare calibration schematic. Refit costs fall by 25%.':'The recorder describes the lost fleet crossing this world before the blockade. A recovered stabilizer schematic reduces refit costs by 25%.'})),
 {id:'clue:wayfarer-buoy',name:'Wayfarer distress buoy',x:240,z:780,reward:40,blueprint:null,ocean:true,story:'Wayfarer reports pirates boarding its deck. Return to the carrier and help its crew repel the boarding party.'}
];
export function discoverySites(){return DISCOVERIES.map(s=>({...s,elevation:s.ocean?1:heightAt(s.x,s.z),kind:'signal',faction:'neutral',radius:4,description:s.story}));}
// Leads are derived from recovered records, so old saves gain them without migration.
export const EXPLORATION_LINKS=[
 {from:'clue:evacuation-stop',to:'clue:basalt-gate',hint:'A route scribbled on the passenger list marks survey supplies hidden inside Basalt Gate.'},
 {from:'clue:roadside-repair',to:'clue:relay-feed',hint:'Follow the repair crew’s cable route to recover the severed Northwatch transmission.'},
 {from:'clue:relay-feed',to:'clue:survey-wreck',hint:'The burst transmission names a downed survey craft. Its recorder may explain what happened to the fleet.'},
 {from:'clue:supply-spill',to:'clue:coast-lookout',hint:'A delivery receipt points to a coastwatch log overlooking the water.'},
 {from:'clue:coast-lookout',to:'clue:wayfarer-buoy',hint:'Take a launch to the marked buoy north of Wayfarer. Stop beside its light to recover the distress message.'}
];
export function explorationLeads(c){
 const recovered=new Set(c.clues??[]),sites=discoverySites();
 return EXPLORATION_LINKS.flatMap(link=>{
  if(!recovered.has(link.from)||recovered.has(link.to))return [];
  const source=DISCOVERIES.find(s=>s.id===link.from),target=sites.find(s=>s.id===link.to);
  return source&&target?[{source,target,hint:link.hint}]:[];
 });
}
export function explorationBriefs(c,position){
 const current=getPlanetAt(position.x,position.z);
 return explorationLeads(c).map(lead=>{
  const t=lead.target,planet=getPlanetAt(t.x,t.z),local=planet.id===current.id;
  const landmark=WORLD_LANDMARKS.find(s=>'clue:'+s.id===t.id);
  const approach=t.ocean?'Ocean signal · Bring a launch':landmark?.kind==='cave'?'Cave archive · Approach on foot':landmark?.kind==='wreck'?'Wreck interior · Approach on foot':'Roadside record · Approach on foot';
  const nav=local?targetNavigation(position,0,t):null;
  return {...lead,distance:nav?.distance??null,
   travelLabel:nav?(nav.distance<5?'At the signal':`${nav.distanceLabel}${Math.hypot(t.x-position.x,t.z-position.z)>=1?' '+cardinal(bearingTo(position,t)):''} · ${nav.verticalLabel}`):`Return to ${planet.name} · Planet jump required`,
   context:`${planet.name} / ${t.ocean?'Ocean':biomeAt(t.x,t.z).name} · ${approach}`};
 }).sort((a,b)=>(a.distance??Infinity)-(b.distance??Infinity));
}
export function claimDiscovery(c,id){const item=DISCOVERIES.find(s=>s.id===id);c.clues??=[];if(!item||c.clues.includes(id))return null;c.clues.push(id);c.salvage+=item.reward;if(item.blueprint&&!c.blueprints.includes(item.blueprint))c.blueprints.push(item.blueprint);if(item.ocean)c.oceanEvent=1;return item;}
export const BOARDERS=['wayfarer:boarding:0','wayfarer:boarding:1'];
export function oceanBoarders(c,position){if(c.oceanEvent!==1||Math.hypot(position.x-240,position.z-900)>500)return [];return BOARDERS.map((id,i)=>({id,site:'carrier',x:232+i*16,y:12.2,z:948}));}
export function finishOceanEvent(c,health){if(c.oceanEvent!==1||!BOARDERS.every(id=>health.has(id)&&health.get(id)<=0))return false;c.oceanEvent=2;c.salvage+=80;return true;}
