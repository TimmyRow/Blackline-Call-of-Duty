/** Deterministic survey coordinates. Terrain and discoveries share one seed. */
export const SEA_LEVEL = 0;
export const REGION_START = {x:0,z:110};
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function worldHash(x,z,s=0){let n=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^Math.imul(s+17,1274126177);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
function noise(x,z){const a=Math.floor(x),b=Math.floor(z),u=smooth(0,1,x-a),v=smooth(0,1,z-b);return (worldHash(a,b)*(1-u)+worldHash(a+1,b)*u)*(1-v)+(worldHash(a,b+1)*(1-u)+worldHash(a+1,b+1)*u)*v;}
function rawHeight(x,z){
 const continental=(noise(x/1900+3,z/1900-2)-.43)*250;
 const hills=(noise(x/320+21,z/320+19)-.5)*65+(noise(x/95,z/95)-.5)*10;
 let h=continental+hills;
 // A broad starting peninsula meets an ocean to the south, then gives way to other continents.
 const r=Math.hypot(x*.75,(z+380)*.9),island=38-Math.max(0,r-520)*.11+noise(x/230,z/230)*28;
 h=h+(island-h)*(1-smooth(1050,1600,r));const approach=Math.hypot(x,z-70);h=19+(h-19)*smooth(190,550,approach);
 for(const p of [{x:240,z:900},{x:-650,z:1140}]){const d=Math.hypot(x-p.x,z-p.z);h=-23+(h+23)*smooth(120,330,d);}
 return h;
}
export const REGION_SITES=[
 {id:'harbour',name:'Cold Harbour',x:0,z:-10,elevation:18,kind:'outpost',faction:'pirate',description:'Occupied colonial freight settlement. Recover the pirate route ledger.',action:'Recover the invasion manifest',verb:'RECOVER INVASION MANIFEST',effect:'Patrol positions revealed on the field map',radius:65,holdSeconds:3},
 {id:'relay',name:'Northwatch Array',x:-690,z:-540,elevation:52,kind:'outpost',faction:'pirate',description:'A surveillance compound on the northern heights.',action:'Disable the surveillance relay',verb:'DISABLE SURVEILLANCE',effect:'Enemy detection range reduced across the region',radius:60,holdSeconds:4},
 {id:'depot',name:'Tidebreak Arsenal',x:780,z:-370,elevation:35,kind:'camp',faction:'pirate',description:'Mercenary barracks, ammunition stores and stolen colony supplies.',action:'Cut the fire-control uplink',verb:'CUT FIRE CONTROL',effect:'Enemy fire coordination slowed across the region',radius:65,holdSeconds:4}
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
 if(Math.hypot(x,z)<360||[...REGION_SITES,...SPECIAL_SITES].some(s=>Math.hypot(s.x-x,s.z-z)<220))return null;
 const y=rawHeight(x,z);if(y<9)return null;
 const roll=worldHash(cx,cz,3),kind=roll<.18?'ruin':roll<.56?'camp':'outpost';
 const names=['Blackglass','Wraith','Cinder','Redwater','Hollow','Vesper','Ashfall','Ironwake'];
 return {id:`${kind}:${cx}:${cz}`,name:`${names[Math.floor(worldHash(cx,cz,4)*names.length)]} ${kind==='ruin'?'Relic':kind==='camp'?'Encampment':'Settlement'}`,x,z,elevation:y,kind,faction:kind==='ruin'?'neutral':'pirate',description:kind==='ruin'?'An abandoned alien survey structure. Search the remains for supplies.':'Independent pirate activity beyond the colonial defence line.',radius:kind==='ruin'?45:62};
}
export function getWorldSites(x,z,radius=1800){
 const sites=[...REGION_SITES,...SPECIAL_SITES].filter(s=>Math.hypot(s.x-x,s.z-z)<=radius+s.radius);
 for(let cx=Math.floor((x-radius)/CELL);cx<=Math.floor((x+radius)/CELL);cx++)for(let cz=Math.floor((z-radius)/CELL);cz<=Math.floor((z+radius)/CELL);cz++){
 const site=generatedSite(cx,cz);if(site&&Math.hypot(site.x-x,site.z-z)<=radius+site.radius)sites.push(site);
 }return sites;
}
export function heightAt(x,z){
 let h=rawHeight(x,z);
 const candidates=[...REGION_SITES,{...REGION_START,elevation:16,radius:32}];
 // Jittered cell sites need only the surrounding nine cells when flattening terrain.
 const cx=Math.floor(x/CELL),cz=Math.floor(z/CELL);
 for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const site=generatedSite(cx+i,cz+j);if(site)candidates.push(site);}
 for(const s of candidates){const d=Math.hypot(x-s.x,z-s.z);if(d<110)h=s.elevation+(h-s.elevation)*smooth(s.radius+8,s.radius+42,d);}
 return h;
}
export function getLandingPads(x,z,radius=1800){
 return [{id:'landing',name:'Pathfinder Landing',x:REGION_START.x,z:REGION_START.z,y:16.16,radius:16},...getWorldSites(x,z,radius).map(s=>({id:s.id,name:s.name,x:s.x,z:s.z+(s.kind==='carrier'?20:s.kind==='pirate-ship'?18:s.kind==='station'?28:35),y:s.elevation+.16,radius:s.kind==='station'?26:s.kind==='carrier'?20:s.kind==='pirate-ship'?16:13}))].filter(s=>Math.hypot(s.x-x,s.z-z)<=radius);
}
export const REGION_ROADS=[];
export function regionName(x,z){if(Math.hypot(x-REGION_START.x,z-REGION_START.z)<48)return 'Pathfinder Landing';const sites=getWorldSites(x,z,220).sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z));if(sites[0]&&Math.hypot(sites[0].x-x,sites[0].z-z)<sites[0].radius+15)return sites[0].name;return heightAt(x,z)<SEA_LEVEL?'Orison Ocean':Math.hypot(x,z)<1500?'Ash Coast Wilderness':'Uncharted Frontier';}
export const ENEMY_SPAWNS=REGION_SITES.flatMap(s=>[{site:s.id,x:s.x-19,z:s.z-24},{site:s.id,x:s.x+22,z:s.z-19},{site:s.id,x:s.x-24,z:s.z+21},{site:s.id,x:s.x+26,z:s.z+24}]);
