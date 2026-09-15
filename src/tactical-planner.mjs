/** Pure decisions. The adapter must validate cover with the live physics world. */
export function tacticalIntent(role, {
 distance, preferredRange, range, healthRatio=1, time=0, seed=0,
 visible=true, lastImpact=-10, cover=/** @type {any} */(null), coverDistance=Infinity,
}) {
 const side=Math.sin(seed*13.7)>=0?1:-1;
 const retreat=healthRatio<=.28 && distance<preferredRange*1.4;
 if(retreat)return {mode:'retreat',advance:-1,strafe:side*.45,canFire:visible&&distance<=range};
 if(cover && (healthRatio<.6 || time-lastImpact<1.5))
  return {mode:'cover',goal:cover,advance:coverDistance>1?1:0,strafe:0,canFire:visible&&coverDistance<=1&&distance<=range};
 // Stable side and six-second phases avoid per-frame oscillation. Heavy units hold lanes.
 const flank=visible && (role==='scout'||role==='drone') && distance>8 && distance<range*.8 && Math.floor((time+seed)/6)%3===1;
 if(flank)return {mode:'flank',advance:distance>preferredRange? .3:0,strafe:side*1.5,canFire:distance<=range};
 return {mode:visible?'engage':'search',advance:visible?(distance>preferredRange+5?1:distance<preferredRange*.6?-.65:0):(distance>2?1:0),strafe:0,canFire:visible&&distance<=range};
}

/** At most eight candidates; query this on a slow scan, never for every fixed step.
 * candidateClear validates capsule occupancy, path and safe floor (no ocean/drop).
 * hidesFromThreat validates a torso-height sight line against fixed world cover.
 */
export function selectCover(position,threat,{candidateClear,hidesFromThreat},radius=7){
 let best=null,score=Infinity;
 for(let i=0;i<8;i++){
  const angle=i*Math.PI/4,p={x:position.x+Math.cos(angle)*radius,y:position.y,z:position.z+Math.sin(angle)*radius};
  if(!candidateClear(position,p)||!hidesFromThreat(p,threat))continue;
  const s=Math.hypot(p.x-threat.x,p.z-threat.z);
  // Prefer the nearest threat-facing edge, not an unnecessary deep detour.
  if(s<score){score=s;best=p;}
 }
 return best;
}

/** Optional descent assistance only changes downward target speed. All controls survive. */
export function assistedDescent(altitude,requestedSpeed,enabled=true,safe=true){
 if(!enabled||!safe||requestedSpeed>=0)return requestedSpeed;
 return -Math.min(-requestedSpeed,Math.max(2,Math.max(0,altitude-.2)*.7));
}

export function landingImpactDamage(downwardSpeed){return Math.min(42,Math.max(0,downwardSpeed-16)*.65);}
