/** Persistent expedition progression, with validated browser storage and one-time rewards. */
export const SAVE_KEY='blackline.expedition.v1';
export const UPGRADES=[
 {id:'armor',name:'Ceramic inserts',description:'Reduce incoming infantry damage by 12% per level.',cost:120,max:3},
 {id:'handling',name:'Weapon stabilizer',description:'Reduce recoil and reload time by 12% per level.',cost:100,max:3},
 {id:'engine',name:'Vector thrusters',description:'Improve Kestrel cruise and boost performance.',cost:160,max:3},
 {id:'shield',name:'Reinforced hull',description:'Increase Kestrel hull capacity.',cost:140,max:3},
 {id:'cannon',name:'Pulse accelerator',description:'Increase cannon damage against interceptors.',cost:180,max:3}
];
export const CONTRACTS=[
 {id:'coast',title:'Break the blockade',description:'Secure Cold Harbour and recover its pirate cargo.',kind:'site',target:'harbour',reward:120,bearing:'harbour'},
 {id:'survey',title:'Beyond the road',description:'Discover five different locations anywhere on Orison.',kind:'discoveries',target:5,reward:140},
 {id:'array',title:'The listening post',description:'Recover the Northwatch Array intelligence cache.',kind:'site',target:'relay',reward:150,bearing:'relay'},
 {id:'raider',title:'Sea wolves',description:'Board the Corsair and claim its cargo.',kind:'site',target:'corsair',reward:200,bearing:'corsair'},
 {id:'orbit',title:'Silent anchorage',description:'Land at Meridian and secure the station.',kind:'site',target:'station',reward:240,bearing:'station'},
 {id:'aces',title:'Clear skies',description:'Destroy two pirate interceptors in flight.',kind:'air',target:2,reward:180},
 {id:'signals',title:'Someone is still out there',description:'Resolve two frontier signals: rescues, wrecks or lost caches.',kind:'signals',target:2,reward:130}
];
export function ensureProgression(c){c.upgrades??={};c.contracts??={};c.journal??=[];c.encountersCompleted??=[];c.oceanKills??=0;c.blueprints??=[];c.onboarding??={stage:'launch',introSeen:true,progress:0};return c;}
export function journal(c,title,text,time=0){ensureProgression(c);c.journal.unshift({title:String(title).slice(0,100),text:String(text).slice(0,400),time:Math.max(0,time)});c.journal=c.journal.slice(0,40);}
export function contractProgress(c,contract){const n=contract.kind==='site'?(c.completed.includes(contract.target)?1:0):contract.kind==='discoveries'?c.discovered.length:contract.kind==='air'?c.airKills:c.encountersCompleted?.length||0;return {current:n,target:contract.kind==='site'?1:contract.target};}
export function acceptContract(c,id){ensureProgression(c);const contract=CONTRACTS.find(x=>x.id===id);if(!contract||c.contracts[id])return false;c.contracts[id]='active';return true;}
export function resolveContracts(c){ensureProgression(c);const rewards=[];for(const contract of CONTRACTS){if(c.contracts[contract.id]!=='active')continue;const p=contractProgress(c,contract);if(p.current<p.target)continue;c.contracts[contract.id]='complete';c.salvage+=contract.reward;rewards.push(contract);}return rewards;}
export function upgradeCost(c,item){return Math.ceil(item.cost*((c.upgrades?.[item.id]||0)+1)*(c.blueprints?.includes(item.id)?.75:1));}
export function buyUpgrade(c,id,atBase){ensureProgression(c);const item=UPGRADES.find(x=>x.id===id);if(!item)return {ok:false,reason:'Unknown equipment'};if(!atBase)return {ok:false,reason:'Visit Pathfinder, a friendly carrier or a secured base to refit.'};const level=c.upgrades[id]||0,cost=upgradeCost(c,item);if(level>=item.max)return {ok:false,reason:'Fully upgraded'};if(c.salvage<cost)return {ok:false,reason:`Requires ${cost} salvage`};c.salvage-=cost;c.upgrades[id]=level+1;return {ok:true,level:level+1,cost,name:item.name};}
const num=(v,min,max,fallback=0)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
const strings=v=>Array.isArray(v)?[...new Set(v.filter(x=>typeof x==='string'&&x.length<100))].slice(0,6000):[];
const vector=v=>Array.isArray(v)&&v.length===3&&v.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<1e7)?v:null;
export function validateSave(raw){
 if(!raw||raw.version!==1||!raw.campaign||!vector(raw.position))return null;
 const v=raw.campaign,c=ensureProgression({completed:strings(v.completed),discovered:strings(v.discovered),tracked:typeof v.tracked==='string'?v.tracked:null,progress:{},salvage:num(v.salvage,0,1e7),raids:num(v.raids,0,6000),distanceWalked:num(v.distanceWalked,0,1e10),distanceFlown:num(v.distanceFlown,0,1e10),airKills:num(v.airKills,0,1e6),oceanKills:num(v.oceanKills,0,1e6),resuppliedAt:{},visited:{},encountersCompleted:strings(v.encountersCompleted)});
 c.onboarding={stage:['cell','ship','launch','complete'].includes(v.onboarding?.stage)?v.onboarding.stage:'launch',introSeen:true,progress:0};
 c.blueprints=strings(v.blueprints).filter(id=>UPGRADES.some(u=>u.id===id));
 for(const u of UPGRADES)c.upgrades[u.id]=Math.floor(num(v.upgrades?.[u.id],0,u.max));for(const k of CONTRACTS)if(['active','complete'].includes(v.contracts?.[k.id]))c.contracts[k.id]=v.contracts[k.id];
 c.journal=Array.isArray(v.journal)?v.journal.filter(e=>e&&typeof e.title==='string'&&typeof e.text==='string').slice(0,40).map(e=>({title:e.title.slice(0,100),text:e.text.slice(0,400),time:num(e.time,0,1e9)})):[];
 const counters=raw.state||{},enemyHealth=Array.isArray(raw.enemyHealth)?raw.enemyHealth.filter(e=>Array.isArray(e)&&typeof e[0]==='string'&&e[0].length<140&&Number.isFinite(e[1])).slice(-1600).map(([k,n])=>[k,num(n,-2000,100)]):[];
 return {version:1,campaign:c,position:raw.position,state:{time:num(counters.time,0,1e9),health:num(counters.health,1,100,100),ammo:num(counters.ammo,0,30,30),reserve:num(counters.reserve,0,360,180),grenades:num(counters.grenades,0,5,3),kills:num(counters.kills,0,1e6),shots:num(counters.shots,0,1e8),hits:num(counters.hits,0,1e8),yaw:num(counters.yaw,-1e8,1e8),pitch:num(counters.pitch,-1.45,1.45)},enemyHealth,ship:vector(raw.ship),marine:vector(raw.marine),marineYaw:num(raw.marineYaw,-1e8,1e8),savedAt:num(raw.savedAt,0,1e15)};
}
export function readSave(storage){try{return validateSave(JSON.parse(storage.getItem(SAVE_KEY)||'null'));}catch{return null;}}
export function writeSave(storage,data){try{const value=validateSave({...data,version:1,savedAt:Date.now()});if(!value)return false;storage.setItem(SAVE_KEY,JSON.stringify(value));return true;}catch{return false;}}
