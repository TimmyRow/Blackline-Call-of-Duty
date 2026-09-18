/** Five authored operations. Movement, fighting and interaction all stay in the open world. */
const phase=(x,z,action,clear=false,wave=0)=>({x,z,action,clear,wave,seconds:1.2});
export const OPERATIONS=[
 {id:'op-infiltration',site:'encounter:bunker:ridge',x:-420,z:85,title:'Ghost frequency',description:'Reach the breaker, copy the listening post records, then leave by the ridge. Sneak through or fight your way in.',reward:160,phases:[phase(5,1,'ISOLATE EXTERIOR RELAY'),phase(0,1,'DOWNLOAD LISTENING RECORDS'),phase(34,18,'TRANSMIT FROM THE RIDGE')]},
 {id:'op-rescue',site:'encounter:distress:coast',x:-175,z:140,title:'No one left behind',description:'Clear the survey camp, restore the transmitter and guide the survivors to a safe extraction beacon.',reward:180,phases:[phase(-3,2,'REPAIR DISTRESS TRANSMITTER',true),phase(0,5,'FREE SURVEY SURVIVORS',true),phase(35,28,'SIGNAL SURVIVOR EXTRACTION')]},
 {id:'op-defense',site:'encounter:friendly:landing',x:354,z:-146,title:'Hold the road',description:'Answer Colonial Recon’s call. Defend their road position against two pirate teams, then recover the relief supplies.',reward:200,phases:[phase(0,5,'ACTIVATE RELIEF BEACON'),phase(0,5,'SECURE FIRST DEFENSE LINE',false,1),phase(0,5,'SECURE SECOND DEFENSE LINE',false,2),phase(0,5,'RELEASE RELIEF SUPPLIES')]},
 {id:'op-sabotage',site:'encounter:convoy:arsenal',x:326,z:-122,title:'Two charges, one chance',description:'Plant charges on both supply trucks, then reach the roadside firing point. Combat is optional if you can slip past the escort.',reward:190,phases:[phase(3,1,'ARM FIRST SUPPLY TRUCK'),phase(-3,-10,'ARM SECOND SUPPLY TRUCK'),phase(-34,24,'DETONATE FROM COVER')]},
 {id:'op-escape',site:'encounter:wreck:landing',x:83,z:176,title:'The courier’s last message',description:'Recover the lost flight recorder, then evade the pirate recovery team and deliver it at the rendezvous.',reward:170,phases:[phase(0,5,'RECOVER FLIGHT RECORDER'),phase(36,-30,'DELIVER RECORDER AT RENDEZVOUS',false,1)]}
];
export const OPERATION_CONTRACTS=OPERATIONS.map(o=>({id:o.id,title:o.title,description:o.description,kind:'operation',target:1,reward:o.reward,bearing:o.site}));
export function normalizeRescuePositions(raw){
 if(!Array.isArray(raw)||raw.length!==2)return null;
 const valid=raw.every(p=>Array.isArray(p)&&p.length===3&&p.every(n=>typeof n==='number'&&Number.isFinite(n))&&Math.hypot(p[0]+175,p[2]-140)<220&&p[1]>-100&&p[1]<500);
 return valid?raw.map(p=>[...p]):null;
}
export function normalizeOperations(raw){const result={};for(const op of OPERATIONS){const n=raw?.[op.id];if(n&&typeof n==='object'){const stage=Math.max(0,Math.min(op.phases.length,Math.floor(Number(n.stage)||0))),survivors=op.id==='op-rescue'&&stage===2?normalizeRescuePositions(n.survivors):null;result[op.id]=survivors?{stage,survivors}:{stage};}}return result;}
export function operationForSite(c,id){return OPERATIONS.find(o=>o.site===id&&c.contracts?.[o.id]==='active')??null;}
export function operationStage(c,op){return Math.min(op.phases.length,c.operations?.[op.id]?.stage??0);}
export function operationPhase(c,op){return op.phases[operationStage(c,op)]??null;}
export function operationTarget(c,op,site){const step=operationPhase(c,op);if(!step)return null;return {...site,id:op.site,name:step.action,x:(site?.x??op.x)+step.x,z:(site?.z??op.z)+step.z,radius:4,kind:'operation',faction:'friendly'};}
export function operationWaveIds(op,wave){return wave?[0,1].map(i=>`${op.id}:wave:${wave}:${i}`):[];}
export function operationEnemies(c,position,heightAt){const enemies=[];for(const op of OPERATIONS){if(c.contracts?.[op.id]!=='active')continue;const step=operationPhase(c,op);if(Math.hypot(position.x-op.x,position.z-op.z)>400||!step)continue;if(op.id==='op-infiltration'){for(let i=0;i<2;i++){const x=op.x+(i?13:-13),z=op.z-10;enemies.push({id:op.id+':sentry:'+i,site:op.site,x,y:heightAt(x,z)+.2,z});}}if(!step.wave)continue;operationWaveIds(op,step.wave).forEach((id,i)=>{const x=op.x+(i?24:-24),z=op.z-26;enemies.push({id,site:op.site,x,y:heightAt(x,z)+.2,z});});}return enemies;}
export function operationBlocked(c,op,guards,health){const step=operationPhase(c,op);if(!step)return 'OPERATION COMPLETE';if(step.clear&&guards>0)return `${guards} HOSTILES · SECURE THE PERIMETER`;if(op.id==='op-defense'&&step.wave&&!operationWaveIds(op,step.wave).every(id=>health.has(id)&&health.get(id)<=0))return `DEFEND RELIEF TEAM · WAVE ${step.wave} / 2`;return null;}
export function createOperationRunner(){let active='',progress=0,release=false;return{
 fraction(){return Math.min(1,progress/1.2);},
 reset(){active='';progress=0;release=false;},
 step(c,op,held,dt,guards,health){if(!held)release=false;if(!op||!held||release||operationBlocked(c,op,guards,health)){active='';progress=0;return null;}if(active!==op.id){active=op.id;progress=0;}progress+=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;if(progress<1.2)return null;c.operations??={};const stage=operationStage(c,op)+1;c.operations[op.id]={stage};active='';progress=0;release=true;return {op,stage,complete:stage>=op.phases.length};}
};}
