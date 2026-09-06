/** Open-ended expedition rules. Coordinates and discovered sites are deterministic world data. */
export function createAdventure(){return {completed:[],discovered:[],tracked:null,progress:{},salvage:0,raids:0,distanceWalked:0,distanceFlown:0,resuppliedAt:{},visited:{},airKills:0};}
export function siteDistance(position,site){return Math.hypot(position.x-site.x,position.z-site.z,position.y-(site.elevation+1.7));}
export function stepAdventure(state,sites,position,held,dt,guards,time){
 let event=null;
 for(const site of sites){
  const distance=siteDistance(position,site);
  if(distance<Math.max(site.radius,100)&&!state.discovered.includes(site.id)){state.discovered.push(site.id);event={type:'discover',site};}
  const done=state.completed.includes(site.id),friendly=site.faction==='friendly'||(done&&site.faction==='pirate');
  if(distance>6||!held||(!friendly&&done)){state.progress[site.id]=Math.max(0,(state.progress[site.id]||0)-dt);continue;}
  if(!done&&site.faction==='pirate'&&guards(site.id)>0)continue;
  if(friendly&&time-(state.resuppliedAt[site.id]??-100)<20)continue;
  state.progress[site.id]=(state.progress[site.id]||0)+dt;
  if(state.progress[site.id]<(friendly?1.2:2.5))continue;
  state.progress[site.id]=0;
  if(friendly){state.resuppliedAt[site.id]=time;state.visited[site.id]=true;return {type:'resupply',site};}
  state.completed.push(site.id);state.salvage+=site.kind==='pirate-ship'?180:site.faction==='pirate'?100:60;if(site.faction==='pirate')state.raids++;
  return {type:'loot',site};
 }
 return event;
}
export function interactionLabel(state,site,guardCount,time){
 if(site.faction==='friendly'||(state.completed.includes(site.id)&&site.faction==='pirate'))return time-(state.resuppliedAt[site.id]??-100)<20?'SUPPLIES REPLENISHING':'HOLD E · RESUPPLY SQUAD / REPAIR SHIP';
 if(state.completed.includes(site.id))return 'SITE SECURED · KEEP EXPLORING';
 if(site.faction==='pirate'&&guardCount>0)return `${guardCount} PIRATES REMAIN · CLEAR THE SITE`;
 return site.faction==='pirate'?'HOLD E · CLAIM PIRATE CARGO':'HOLD E · RECOVER ANCIENT SALVAGE';
}
