import {heightAt} from './region-layout.mjs';

// Completed milestone IDs use the existing validated save list. Only new arrivals
// opt in, so returning expeditions never acquire an unexpected tutorial gate.
const STARTED='crashfall:arrival',REGROUPED='crashfall:regroup',DEFENDED='crashfall:defense';
export const CRASHFALL_SITE='crashfall';
export const CRASHFALL_RALLY={id:CRASHFALL_SITE,name:'SURVIVOR RALLY',x:18,z:190,elevation:heightAt(18,190),kind:'recovery',faction:'friendly',radius:5};
export const CRASHFALL_RAIDERS=[{x:45,z:177},{x:29,z:160},{x:-24,z:170}].map((p,i)=>({...p,id:`crashfall:raider:${i}`,site:CRASHFALL_SITE,y:heightAt(p.x,p.z)+.2}));
export function beginCrashfall(c){if(c.onboarding?.stage!=='cell'||c.completed.includes(STARTED))return false;c.completed.push(STARTED);return true;}
export function crashfallStatus(c){
 if(c.onboarding?.stage!=='ship'||!c.completed.includes(STARTED)||c.completed.includes(DEFENDED))return null;
 const defending=c.completed.includes(REGROUPED);
 return {stage:defending?'defend':'regroup',target:CRASHFALL_RALLY,title:defending?'Hold the survivor rally':'Regroup with the survivors',description:defending?'Three raiders are closing on the wreck. Defeat them with your squad, then take the emergency cell to Kestrel.':'Bring the emergency cell to the survivor rally north of the wreck. Regroup with your squad before crossing to Pathfinder.'};
}
export function crashfallEnemies(c,position){return crashfallStatus(c)?.stage==='defend'&&Math.hypot(position.x-CRASHFALL_RALLY.x,position.z-CRASHFALL_RALLY.z)<650?CRASHFALL_RAIDERS:[];}
export function stepCrashfall(c,position,held,dt,enemyHealth){
 const status=crashfallStatus(c);if(!status)return null;
 if(status.stage==='regroup'){
  const near=Math.hypot(position.x-CRASHFALL_RALLY.x,position.y-CRASHFALL_RALLY.elevation-1.7,position.z-CRASHFALL_RALLY.z)<5;
  c.onboarding.progress=near&&held?(c.onboarding.progress||0)+Math.max(0,Math.min(dt,.1)):0;
  if(c.onboarding.progress<.6)return null;c.onboarding.progress=0;c.completed.push(REGROUPED);return 'regroup';
 }
 // Missing streamed enemies are not kills; all three deaths must be recorded.
 if(!CRASHFALL_RAIDERS.every(e=>typeof enemyHealth.get(e.id)==='number'&&enemyHealth.get(e.id)<=0))return null;
 c.completed.push(DEFENDED);c.salvage+=60;return 'defended';
}
export function recoveryBrief(c){
 const crash=crashfallStatus(c);if(crash)return crash;
 if(c.onboarding?.stage==='cell')return {title:'Escape the wreck',description:'Leave the broken hull and recover the cyan emergency power cell beside the wreck. Your squad survived the impact.'};
 if(c.onboarding?.stage==='ship')return {title:'Find your ship',description:'Follow Kestrel’s beacon north through the road signs to Pathfinder Landing. Install the emergency cell beside its hull.'};
 return {title:'Your first flight',description:'Board the restored Kestrel. Once aboard, meet Mara Voss at Pathfinder’s communications shelter to learn what brought down your transport.'};
}
