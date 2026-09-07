/** Small, deterministic expedition systems; presentation stays in the runtime. */
export function scanSignals(c,sites,position,level=0){
 c.scanned??=[];const range=1100+350*level,found=[];
 for(const site of sites){if(c.scanned.includes(site.id)||Math.hypot(site.x-position.x,site.z-position.z,(site.elevation??0)-position.y)>range)continue;c.scanned.push(site.id);if(!c.discovered.includes(site.id))c.discovered.push(site.id);found.push(site);}
 c.scanned=c.scanned.slice(-6000);const reward=Math.min(40,found.length*5);c.salvage+=reward;
 return {found,reward,range};
}
export function regionalWar(c,sites){
 const secured=sites.filter(s=>s.faction==='pirate'&&c.completed.includes(s.id)).length;
 const convoys=(c.encountersCompleted??[]).filter(id=>id.includes('convoy')).length;
 const pressure=Math.max(.5,1-secured*.13-Math.min(2,convoys)*.1);
 return {pressure,secured,label:secured?'COLONIAL FOOTHOLD':'CONTESTED FRONTIER',description:secured?`${secured} secured local bases reduce nearby pirate garrisons. Convoy losses weaken their supply lines.`:'Pirate alarms call reinforcements. Secure bases and intercept convoys to weaken nearby garrisons.'};
}
export function boardingStatus(c){
 if(!c.boarding?.disabled)return {stage:'disable',label:'DISABLE CORSAIR ENGINES',description:'Use Kestrel cannons on the orange engine on the starboard stern before boarding.'};
 if(!(c.rescued??[]).includes('corsair'))return {stage:'rescue',label:'RESCUE THE CORSAIR PRISONER',description:'Land on the aft deck, clear the guards, and hold USE at the cyan rescue beacon inside.'};
 if(!c.completed.includes('corsair'))return {stage:'cargo',label:'RECOVER CORSAIR CARGO',description:'The prisoner is safe. Recover the cargo at the ship center to secure this vessel.'};
 return {stage:'complete',label:'CORSAIR SECURED',description:'The prisoner is safe and this vessel can resupply your squad.'};
}
export function rescuePrisoner(c,id){c.rescued??=[];if(c.rescued.includes(id)||!c.boarding?.disabled)return false;c.rescued.push(id);c.salvage+=120;return true;}
export function jumpPermission({flying,altitude,speed,health,energy,cooldown,current,destination}){
 if(current===destination)return 'Already orbiting this planet';
 if(!flying)return 'Board Kestrel to travel';
 if(altitude<250)return 'Climb above 250 m ground clearance';
 if(speed>80)return 'Slow below 80 m/s';
 if(health<30)return 'Repair hull above 30';
 if(energy<30)return 'Requires 30 ship energy';
 if(cooldown>0)return `Drive cooling: ${Math.ceil(cooldown)} s`;
 return null;
}
