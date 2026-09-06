import {REGION_SITES,REGION_START} from './region-layout.mjs';
/** @returns {{completed:string[],progress:Record<string,number>,tracked:string,discovered:string[],distanceWalked:number,extracted:boolean}} */
export function createCampaign(){return {completed:[],progress:{},tracked:'harbour',discovered:[],distanceWalked:0,extracted:false};}
export function nearestSite(position,campaign){return REGION_SITES.filter(s=>!campaign.completed.includes(s.id)).sort((a,b)=>Math.hypot(position.x-a.x,position.z-a.z)-Math.hypot(position.x-b.x,position.z-b.z))[0]??null;}
export function trackedSite(position,campaign){return REGION_SITES.find(s=>s.id===campaign.tracked&&!campaign.completed.includes(s.id))??nearestSite(position,campaign);}
export function advanceCampaign(campaign,position,interacting,dt){
 let completed=null;
 for(const site of REGION_SITES){
  const distance=Math.hypot(position.x-site.x,position.z-site.z);
  if(distance<site.radius&&!campaign.discovered.includes(site.id))campaign.discovered.push(site.id);
  if(campaign.completed.includes(site.id))continue;
  if(distance<2.8&&Math.abs(position.y-(site.elevation+1.7))<2&&interacting){campaign.progress[site.id]=(campaign.progress[site.id]??0)+dt;if(campaign.progress[site.id]>=site.holdSeconds){campaign.completed.push(site.id);completed=site.id;}}
  else campaign.progress[site.id]=Math.max(0,(campaign.progress[site.id]??0)-dt*.7);
 }
 if(campaign.completed.length===REGION_SITES.length&&Math.hypot(position.x-REGION_START.x,position.z-REGION_START.z)<4&&interacting)campaign.extracted=true;
 return completed;
}
export function regionalEffects(campaign){return {detectionScale:campaign.completed.includes('relay')?.58:1,fireDelayScale:campaign.completed.includes('depot')?1.8:1,patrolIntel:campaign.completed.includes('harbour'),signalStrength:Math.round((1-campaign.completed.length/REGION_SITES.length)*100)};}
