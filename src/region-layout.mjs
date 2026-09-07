import {CITY,ASTRA_APPROACH} from './ship-purchase.mjs';
/** Deterministic survey coordinates. Terrain and discoveries share one seed. */
import {PLANETS,getPlanetAt,getPlanetArrival,biomeAt,vesperHeight,DESTINATION_SITES} from './world-destinations.mjs';
export {PLANETS,getPlanetAt,getPlanetArrival,biomeAt};
export const SEA_LEVEL = 0;
export const REGION_START = {x:0,z:110};
const building=(a,c,w,d,h,label)=>({a,c,w,d,h,label});
const BUILDING_LAYOUTS={
 city:[...[-72,-38,38,72].flatMap((a,i)=>[-65,-25].map((c,j)=>building(a,c,24,27,18+(i+j)%3*8,['ASTRA RESIDENCES','CIVIC EXCHANGE','COLONIAL MEDICAL','TRANSIT OFFICES'][i]))),building(-48,37,29,32,16,'HANGAR WORKSHOPS'),building(48,37,29,32,20,'FLIGHT ACADEMY'),building(-43,79,26,20,12,'MARKET ARCADE'),building(43,79,26,20,15,'CREW LODGINGS')],
 landing:[building(-33,-25,18,21,12,'PATHFINDER / 01'),building(32,-27,17,21,10,'FLIGHT STORES'),building(-34,15,18,19,9,'SQUAD QUARTERS'),building(34,18,17,21,11,'ORBITAL TRANSIT')],
 harbour:[building(-29,-23,15,24,11,'NORTH FREIGHT'),building(29,-26,16,22,10,'CUSTOMS / 12'),building(-30,25,16,19,8,'SERVICE / 04'),building(31,26,16,20,9,'ENGINEERING'),building(-28,63,15,21,10,'DOCKYARD / 08'),building(29,65,17,20,8,'FLIGHT STORES')],
 relay:[building(30,-26,19,25,6,'ARRAY CONTROL'),building(-30,25,16,19,5,'SIGNAL SERVICE')],
 mining:[building(31,-26,18,25,9,'ORE REFINERY'),building(-30,25,16,19,6,'SHIFT BARRACKS')],
 market:[building(-29,-26,17,22,9,'EXCHANGE STORES'),building(31,26,18,20,7,'TRANSIT CONTROL')],
 salvage:[building(-30,25,17,20,7,'BREAKER WORKSHOP')],ruin:[]
};
export function settlementStyle(site){if(!site.id||site.id==='landing-services')return 'landing';if(site.id==='harbour'||site.id==='relay')return site.id;if(site.kind==='ruin')return 'ruin';if(site.id==='depot')return 'mining';return site.district||'mining';}
export function getSettlementBuildings(site){return BUILDING_LAYOUTS[settlementStyle(site)]||BUILDING_LAYOUTS.mining;}
export const ROADSIDE_STORIES=[
 {id:'evacuation-stop',name:'Last Evacuation',x:-150,z:55,kind:'evacuation'},
 {id:'roadside-repair',name:'Abandoned Repair Crew',x:177,z:32,kind:'repair'},
 {id:'relay-feed',name:'Severed Northwatch Feed',x:-445,z:-300,kind:'power'},
 {id:'supply-spill',name:'Scattered Ammunition Shipment',x:444,z:-207,kind:'cargo'},
 {id:'coast-lookout',name:'Coastwatch Rest Stop',x:105,z:340,kind:'lookout'}
];
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function worldHash(x,z,s=0){let n=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^Math.imul(s+17,1274126177);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
function noise(x,z){const a=Math.floor(x),b=Math.floor(z),u=smooth(0,1,x-a),v=smooth(0,1,z-b);return (worldHash(a,b)*(1-u)+worldHash(a+1,b)*u)*(1-v)+(worldHash(a,b+1)*(1-u)+worldHash(a+1,b+1)*u)*v;}
function rawHeight(x,z){
 const planetDistance=Math.hypot(x-42000,z);
 if(planetDistance<8000)return vesperHeight(x,z);
 const continental=(noise(x/1900+3,z/1900-2)-.43)*250;
 const hills=(noise(x/320+21,z/320+19)-.5)*65+(noise(x/95,z/95)-.5)*10;
 let h=continental+hills;
 // A broad starting peninsula meets an ocean to the south, then gives way to other continents.
 const r=Math.hypot(x*.75,(z+380)*.9),island=38-Math.max(0,r-520)*.11+noise(x/230,z/230)*28;
 h=h+(island-h)*(1-smooth(1050,1600,r));const approach=Math.hypot(x,z-70);h=19+(h-19)*smooth(190,550,approach);
 for(const p of [{x:240,z:900},{x:-650,z:1140}]){const d=Math.hypot(x-p.x,z-p.z);h=-23+(h+23)*smooth(120,330,d);}
 // Remote continents gain ridgelines and a tidal river. The authored coast and
 // its road network remain exactly as surveyed; site terraces flatten afterward.
 const frontier=smooth(1650,2300,Math.hypot(x,z));
 const ridge=Math.pow(1-Math.abs(noise(x/740+52,z/740-17)*2-1),7)*135;
 h+=ridge*frontier;
 const river=Math.abs(x-(2450+Math.sin(z/490)*180+Math.sin(z/1700)*320));
 h+=(Math.min(h,-4)-h)*(1-smooth(24,82,river))*frontier;
 if(planetDistance<10000)h+=(vesperHeight(x,z)-h)*(1-smooth(8000,10000,planetDistance));
 return h;
}
export const WORLD_LANDMARKS=[
 {id:'basalt-gate',name:'Basalt Gate',x:-290,z:-210,kind:'cave',description:'A sheltered basalt arch above the coastal road.'},
 {id:'survey-wreck',name:'Fallen Surveyor',x:340,z:-570,kind:'wreck',description:'A fractured survey vessel in the northern hills.'},
 {id:'tidal-river',name:'Glasswater Estuary',x:2450,z:0,kind:'river',description:'A broad tidal channel cuts through the frontier ridges.'},
 {id:'vesper-cave',name:'The Hushed Grotto',x:41660,z:-240,kind:'cave',description:'An open obsidian tunnel shelters a forgotten survey cache.'},
 {id:'vesper-wreck',name:'Saltwind Surveyor',x:42380,z:560,kind:'wreck',description:'An expedition ship lost on the edge of the salt basin.'}
];
export const REGION_SITES=[
 {id:'harbour',name:'Cold Harbour',x:0,z:-10,elevation:18,kind:'outpost',faction:'pirate',description:'Occupied colonial freight settlement. Recover the pirate route ledger.',action:'Recover the invasion manifest',verb:'RECOVER INVASION MANIFEST',effect:'Patrol positions revealed on the field map',radius:65,holdSeconds:3},
 {id:'relay',name:'Northwatch Array',x:-690,z:-540,elevation:52,kind:'outpost',faction:'pirate',description:'A surveillance compound on the northern heights.',action:'Disable the surveillance relay',verb:'DISABLE SURVEILLANCE',effect:'Enemy detection range reduced across the region',radius:60,holdSeconds:4},
 {id:'depot',name:'Tidebreak Arsenal',x:780,z:-370,elevation:35,kind:'camp',faction:'pirate',description:'Mercenary barracks, ammunition stores and stolen colony supplies.',action:'Cut the fire-control uplink',verb:'CUT FIRE CONTROL',effect:'Enemy fire coordination slowed across the region',radius:65,holdSeconds:4},
 CITY
];
export const SPECIAL_SITES=[
 {id:'carrier',name:'CNS Wayfarer',x:240,z:900,elevation:12,kind:'carrier',faction:'friendly',description:'A mobile squad base. Land on the open flight deck to regroup and rearm.',radius:95},
 {id:'corsair',name:'Corsair Boarding Target',x:-650,z:1140,elevation:9,kind:'pirate-ship',faction:'pirate',description:'Pirate ocean raider. Board the aft deck and clear the bridge.',radius:75},
 {id:'station',name:'Meridian Anchorage',x:1150,z:470,elevation:1800,kind:'station',faction:'pirate',description:'A hostile orbital anchorage above the coast. Land and explore its pressure deck.',radius:160}
];
const CELL=700;
const siteCache=new Map();
function generatedSite(cx,cz){const key=`${cx}:${cz}`;if(siteCache.has(key))return siteCache.get(key);const result=makeGeneratedSite(cx,cz);if(siteCache.size>4096)siteCache.clear();siteCache.set(key,result);return result;}
function makeGeneratedSite(cx,cz){
 const x=cx*CELL+105+worldHash(cx,cz,1)*490,z=cz*CELL+105+worldHash(cx,cz,2)*490;
 if(Math.hypot(x,z)<360||[...REGION_SITES,...SPECIAL_SITES,...DESTINATION_SITES].some(s=>Math.hypot(s.x-x,s.z-z)<220))return null;
 const y=rawHeight(x,z);if(y<9)return null;
 const roll=worldHash(cx,cz,3),kind=roll<.18?'ruin':roll<.56?'camp':'outpost';
 const names=['Blackglass','Wraith','Cinder','Redwater','Hollow','Vesper','Ashfall','Ironwake'];
 const districtRoll=worldHash(cx,cz,5),district=districtRoll<.34?'mining':districtRoll<.68?'market':'salvage';
 return {id:`${kind}:${cx}:${cz}`,name:`${names[Math.floor(worldHash(cx,cz,4)*names.length)]} ${kind==='ruin'?'Relic':kind==='camp'?'Encampment':district==='mining'?'Extraction':district==='salvage'?'Breaker Yard':'Freeport'}`,x,z,elevation:y,kind,district,faction:kind==='ruin'?'neutral':'pirate',description:kind==='ruin'?'An abandoned alien survey structure. Search the remains for supplies.':district==='salvage'?'A scrapyard of broken survey ships, stripped engines and a working salvage workshop.':district==='mining'?'An occupied extraction town with workshops, ore conveyors and crew quarters.':'A pirate trading settlement of supply stalls, cargo warehouses and operations rooms.',radius:kind==='ruin'?45:62};
}
export function getWorldSites(x,z,radius=1800){
 const sites=[...REGION_SITES,...SPECIAL_SITES,...DESTINATION_SITES].filter(s=>Math.hypot(s.x-x,s.z-z)<=radius+s.radius);
 for(let cx=Math.floor((x-radius)/CELL);cx<=Math.floor((x+radius)/CELL);cx++)for(let cz=Math.floor((z-radius)/CELL);cz<=Math.floor((z+radius)/CELL);cz++){
 const site=generatedSite(cx,cz);if(site&&Math.hypot(site.x-x,site.z-z)<=radius+site.radius)sites.push(site);
 }return sites;
}
export function heightAt(x,z){
 let h=rawHeight(x,z);
 // Grade a walkable coastal causeway under the city highway, including its curved shoulders.
 let roadDistance=Infinity,roadHeight=0;
 for(let i=1;i<ASTRA_APPROACH.length;i++){const a=ASTRA_APPROACH[i-1],b=ASTRA_APPROACH[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz))),d=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);if(d<roadDistance){roadDistance=d;roadHeight=a[2]+(b[2]-a[2])*t;}}
 if(roadDistance<70)h=roadHeight+(h-roadHeight)*smooth(36,70,roadDistance);
 const candidates=[...REGION_SITES,...DESTINATION_SITES,{...REGION_START,elevation:16,radius:32}];
 // Jittered cell sites need only the surrounding nine cells when flattening terrain.
 const cx=Math.floor(x/CELL),cz=Math.floor(z/CELL);
 for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const site=generatedSite(cx+i,cz+j);if(site)candidates.push(site);}
 let nearestFootprint=Infinity,foundationHeight=0;
 for(const s of candidates){const d=Math.hypot(x-s.x,z-s.z);if(d<Math.max(110,s.radius+50)){h=s.elevation+(h-s.elevation)*smooth(s.radius+8,s.radius+42,d);
  // Grade complete building footprints, including the eight-metre terrain cell
  // around each edge. Choose the nearest foundation when adjacent districts meet.
  for(const {a,c,w,d:l}of getSettlementBuildings(s)){const edge=Math.max(Math.abs(x-s.x-a)-w/2,Math.abs(z-s.z-c)-l/2);if(edge<nearestFootprint){nearestFootprint=edge;foundationHeight=s.elevation;}}
 }}
 if(nearestFootprint<17)h=foundationHeight+(h-foundationHeight)*smooth(8,17,nearestFootprint);
 // A cave has an actual graded, unobstructed tunnel floor. The roof is geometry.
 for(const landmark of WORLD_LANDMARKS)if(landmark.kind==='cave'){
  const distance=Math.hypot(x-landmark.x,z-landmark.z);
  if(distance<40){const floor=rawHeight(landmark.x,landmark.z);h=floor+(h-floor)*smooth(26,40,distance);}
 }
 return h;
}
export function getLandingPads(x,z,radius=1800){
 return [{id:'landing',name:'Pathfinder Landing',x:REGION_START.x,z:REGION_START.z,y:16.16,radius:16},...getWorldSites(x,z,radius).map(s=>({id:s.id,name:s.name,x:s.x,z:s.z+(s.kind==='carrier'?20:s.kind==='pirate-ship'?18:s.kind==='station'?28:35),y:s.elevation+.16,radius:s.kind==='station'?26:s.kind==='carrier'?20:s.kind==='pirate-ship'?16:13}))].filter(s=>Math.hypot(s.x-x,s.z-z)<=radius);
}
export const REGION_ROADS=[];
export function regionName(x,z){if(Math.hypot(x-REGION_START.x,z-REGION_START.z)<48)return 'Pathfinder Landing';const sites=getWorldSites(x,z,220).sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z));if(sites[0]&&Math.hypot(sites[0].x-x,sites[0].z-z)<sites[0].radius+15)return sites[0].name;return heightAt(x,z)<SEA_LEVEL?'Orison Ocean':getPlanetAt(x,z).id==='vesper'?`Vesper / ${biomeAt(x,z).name}`:Math.hypot(x,z)<1500?'Ash Coast Wilderness':biomeAt(x,z).name;}
export const ENEMY_SPAWNS=REGION_SITES.filter(s=>s.faction==='pirate').flatMap(s=>[{site:s.id,x:s.x-19,z:s.z-24},{site:s.id,x:s.x+22,z:s.z-19},{site:s.id,x:s.x-24,z:s.z+21},{site:s.id,x:s.x+26,z:s.z+24}]);
