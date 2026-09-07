/** Persistent expedition progression, with validated browser storage and one-time rewards. */
export const SAVE_KEY='blackline.expedition.v1';
export const UPGRADES=[
 {id:'armor',name:'Ceramic inserts',description:'Reduce incoming infantry damage by 12% per level.',cost:120,max:3},
 {id:'handling',name:'Weapon stabilizer',description:'Reduce recoil and reload time by 12% per level.',cost:100,max:3},
 {id:'engine',name:'Vector thrusters',description:'Improve Kestrel cruise and boost performance.',cost:160,max:3},
 {id:'shield',name:'Reinforced hull',description:'Increase Kestrel hull capacity.',cost:140,max:3},
 {id:'cannon',name:'Pulse accelerator',description:'Increase cannon damage against interceptors.',cost:180,max:3},
 {id:'scanner',name:'Survey aperture',description:'Extend scanner range by 350 m per level.',cost:110,max:3},
 {id:'reactor',name:'Jump reactor',description:'Reduce jump cooldown by 10 s and improve flight energy recharge by 15% per level.',cost:190,max:3},
 {id:'medical',name:'Field medical kit',description:'Requested medic aid restores 10 more health per level.',cost:100,max:3},
 {id:'shieldCell',name:'Personal shield cell',description:'Increase rechargeable personal shield capacity by 20 per level.',cost:130,max:3}
];
export const CONTRACTS=[
 {id:'vesper-mine',title:'Break the extraction ring',description:'Liberate the Obsidian Extraction camp on Vesper.',kind:'site',target:'vesper-mine',reward:180,bearing:'vesper-mine'},
 {id:'echo-vault',title:'Voices in the dunes',description:'Travel to Vesper and recover the Echo Vault archive.',kind:'site',target:'vesper-vault',reward:160,bearing:'vesper-vault'},
 {id:'breakwater',title:'The island battery',description:'Take Breakwater Redoubt and open the carrier approach.',kind:'site',target:'island-redoubt',reward:170,bearing:'island-redoubt'},
 {id:'coast',title:'Break the blockade',description:'Secure Cold Harbour and recover its pirate cargo.',kind:'site',target:'harbour',reward:120,bearing:'harbour'},
 {id:'survey',title:'Beyond the road',description:'Discover five different locations anywhere on Orison.',kind:'discoveries',target:5,reward:140},
 {id:'array',title:'The listening post',description:'Recover the Northwatch Array intelligence cache.',kind:'site',target:'relay',reward:150,bearing:'relay'},
 {id:'raider',title:'Operation Safe Harbour',description:'Answer the captured allied vessel’s distress call. Disable the pirate engines from the air or sabotage them on deck, rescue the crew, repel the counterattack and reclaim the ship. Includes a free vector-thruster refit.',kind:'site',target:'corsair',reward:200,bearing:'corsair'},
 {id:'orbit',title:'Silent anchorage',description:'Land at Meridian and secure the station.',kind:'site',target:'station',reward:240,bearing:'station'},
 {id:'aces',title:'Clear skies',description:'Destroy two pirate interceptors in flight.',kind:'air',target:2,reward:180},
 {id:'signals',title:'Someone is still out there',description:'Resolve two frontier signals: rescues, wrecks or lost caches.',kind:'signals',target:2,reward:130},
 {id:'rescue',title:'Bring them home',description:'Rescue a captive from the disabled Corsair.',kind:'rescued',target:1,rescuedId:'corsair',reward:220,bearing:'corsair'},
 {id:'surveyor',title:'A wider horizon',description:'Scan five points of interest with the survey pulse.',kind:'scanned',target:5,reward:160}
];
export function ensureProgression(c){c.upgrades??={};c.contracts??={};c.journal??=[];c.encountersCompleted??=[];c.oceanKills??=0;c.blueprints??=[];c.scanned??=[];c.rescued??=[];c.boarding??={disabled:false};c.planet??='orison';c.activeMission??=null;c.safeHarbour??={announced:false,defending:false,repelled:false,rewarded:false};c.onboarding??={stage:'launch',introSeen:true,progress:0};return c;}
export function journal(c,title,text,time=0){ensureProgression(c);c.journal.unshift({title:String(title).slice(0,100),text:String(text).slice(0,400),time:Math.max(0,time)});c.journal=c.journal.slice(0,40);}
export function contractProgress(c,contract){const n=contract.kind==='site'?(c.completed.includes(contract.target)?1:0):contract.kind==='discoveries'?c.discovered.length:contract.kind==='air'?c.airKills:contract.kind==='rescued'?(contract.rescuedId?Number(c.rescued?.includes(contract.rescuedId)):(c.rescued?.length||0)):contract.kind==='scanned'?(c.scanned?.length||0):c.encountersCompleted?.length||0;return {current:n,target:contract.kind==='site'?1:contract.target};}
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
 const target=v.trackedTarget;if(target&&target.id===c.tracked&&typeof target.name==='string'&&[target.x,target.z,target.elevation].every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<1e7))c.trackedTarget={id:target.id,name:target.name.slice(0,100),x:target.x,z:target.z,elevation:target.elevation,kind:typeof target.kind==='string'?target.kind.slice(0,30):'signal',faction:['friendly','pirate','neutral'].includes(target.faction)?target.faction:'neutral',radius:num(target.radius,1,2000,20)};
 c.activeMission=CONTRACTS.some(k=>k.id===v.activeMission)?v.activeMission:null;
 c.safeHarbour={announced:v.safeHarbour?.announced===true,defending:v.safeHarbour?.defending===true,repelled:v.safeHarbour?.repelled===true,rewarded:v.safeHarbour?.rewarded===true};
 c.onboarding={stage:['cell','ship','launch','complete'].includes(v.onboarding?.stage)?v.onboarding.stage:'launch',introSeen:true,progress:0};
 c.blueprints=strings(v.blueprints).filter(id=>UPGRADES.some(u=>u.id===id));
 c.scanned=strings(v.scanned);c.rescued=strings(v.rescued);c.boarding={disabled:v.boarding?.disabled===true};c.planet=typeof v.planet==='string'&&/^[a-z][a-z0-9-]{0,39}$/.test(v.planet)?v.planet:'orison';
 if(c.completed.includes('corsair')){if(!v.safeHarbour)c.safeHarbour={announced:true,defending:true,repelled:true,rewarded:true};c.boarding.disabled=true;if(!c.rescued.includes('corsair'))c.rescued.push('corsair');}
 for(const u of UPGRADES)c.upgrades[u.id]=Math.floor(num(v.upgrades?.[u.id],0,u.max));for(const k of CONTRACTS)if(['active','complete'].includes(v.contracts?.[k.id]))c.contracts[k.id]=v.contracts[k.id];
 c.journal=Array.isArray(v.journal)?v.journal.filter(e=>e&&typeof e.title==='string'&&typeof e.text==='string').slice(0,40).map(e=>({title:e.title.slice(0,100),text:e.text.slice(0,400),time:num(e.time,0,1e9)})):[];
 const counters=raw.state||{},enemyHealth=Array.isArray(raw.enemyHealth)?raw.enemyHealth.filter(e=>Array.isArray(e)&&typeof e[0]==='string'&&e[0].length<140&&Number.isFinite(e[1])).slice(-1600).map(([k,n])=>[k,num(n,-2000,185)]):[];
 return {version:1,campaign:c,position:raw.position,state:{weapon:counters.weapon==='energy'?'energy':'ballistic',energy:num(counters.energy,0,100,100),shield:num(counters.shield,0,130,70),time:num(counters.time,0,1e9),health:num(counters.health,1,100,100),ammo:num(counters.ammo,0,30,30),reserve:num(counters.reserve,0,360,180),grenades:num(counters.grenades,0,5,3),kills:num(counters.kills,0,1e6),shots:num(counters.shots,0,1e8),hits:num(counters.hits,0,1e8),yaw:num(counters.yaw,-1e8,1e8),pitch:num(counters.pitch,-1.45,1.45)},enemyHealth,ship:vector(raw.ship),marine:vector(raw.marine),marineYaw:num(raw.marineYaw,-1e8,1e8),savedAt:num(raw.savedAt,0,1e15)};
}
export function readSave(storage){try{return validateSave(JSON.parse(storage.getItem(SAVE_KEY)||'null'));}catch{return null;}}
export function writeSave(storage,data){try{const value=validateSave({...data,version:1,savedAt:Date.now()});if(!value)return false;storage.setItem(SAVE_KEY,JSON.stringify(value));return true;}catch{return false;}}
