/** Deterministic combat tuning. Presentation and collision remain in their adapters. */
export const ENEMY_ROLES = Object.freeze({
 scout: {health:65,shield:0,speed:4.8,range:48,preferredRange:15,damage:7,cooldown:1.25,strafe:1,telegraph:.2,color:0xe9ad59},
 shielded: {health:100,shield:70,speed:2.4,range:54,preferredRange:20,damage:10,cooldown:1.65,strafe:.2,telegraph:.4,color:0x66c8ff},
 sniper: {health:75,shield:0,speed:2.8,range:115,preferredRange:66,damage:28,cooldown:4.2,strafe:.1,telegraph:1.3,color:0xe175eb},
 drone: {health:48,shield:22,speed:4.1,range:58,preferredRange:24,damage:6,cooldown:1.05,strafe:1.2,telegraph:.3,color:0x61e1c5},
 heavy: {health:185,shield:0,speed:1.65,range:65,preferredRange:27,damage:17,cooldown:2.2,strafe:.05,telegraph:.75,color:0xff7252},
});
const roles=Object.keys(ENEMY_ROLES);
export function roleForId(id){let hash=2166136261;for(const ch of String(id))hash=Math.imul(hash^ch.charCodeAt(0),16777619);return roles[(hash>>>0)%roles.length];}
export function roleStats(role){return ENEMY_ROLES[role]??ENEMY_ROLES.scout;}
export function enemyTactic(role,{distance,time=0,id=0}){
 const stats=roleStats(role),advance=distance>stats.preferredRange+5?1:distance<stats.preferredRange*.6?-.65:0;
 return {advance,strafe:Math.sin(time*.8+Number(id||0))*stats.strafe,canFire:distance<=stats.range};
}
/** Short, rate-limited reaction windows reward hits without allowing permanent stun. */
export function impactResponse(role,{damage=0,shieldBefore=0,shieldAfter=0,time=0,lastImpact=-10}={}){
 const shieldBreak=shieldBefore>0&&shieldAfter<=0;
 if(damage<=0||time-lastImpact<.65)return {duration:0,shieldBreak};
 return {duration:shieldBreak?.42:role==='heavy'?.08:damage>=20?.19:.09,shieldBreak};
}
export const WEAPONS=Object.freeze({
 ballistic:{name:'BR-7 / BALLISTIC',damage:32,headMultiplier:2.2,shieldMultiplier:.65,range:125,interval:.11,capacity:30,reload:1.85,recoil:.026,color:0xffd391},
 energy:{name:'ARC-9 / ENERGY',damage:24,headMultiplier:1.5,shieldMultiplier:2,range:100,interval:.24,capacity:100,cost:9,recharge:15,rechargeDelay:1.6,reload:0,recoil:.012,color:0x67eaff},
});
export function weaponDamage(kind,head=false,distance=0){const w=WEAPONS[kind]??WEAPONS.ballistic;return distance>w.range?0:w.damage*(head?w.headMultiplier:1)*Math.max(.65,1-Math.max(0,distance-35)/220);}
/** Shield damage consumes a proportional fraction of a shot; overflow damages health. */
export function damageCombat(state,amount,kind='ballistic'){
 const damage=Math.max(0,Number.isFinite(amount)?amount:0),shield=Math.max(0,state.shield||0),factor=(WEAPONS[kind]??{shieldMultiplier:1}).shieldMultiplier;
 const absorbed=Math.min(shield,damage*factor);
 return {health:Math.max(0,state.health-Math.max(0,damage-absorbed/factor)),shield:shield-absorbed,absorbed};
}
export function shieldCapacity(level=0){return 70+Math.max(0,Math.min(3,level))*20;}
/** Pass simulation time, never wall time. Damage resets state.lastDamage in the caller. */
export function rechargeShield(state,dt,time,level=0){const capacity=shieldCapacity(level);return Math.min(capacity,Math.max(0,state.shield||0)+(state.health>0&&time-state.lastDamage>=5?Math.max(0,dt)*20:0));}
export function rechargeEnergy(energy,dt,sinceShot){return Math.min(100,Math.max(0,energy)+(sinceShot>=WEAPONS.energy.rechargeDelay?Math.max(0,dt)*WEAPONS.energy.recharge:0));}
