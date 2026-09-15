export function normalizeBase(value){return{reserve:Math.max(0,Math.min(600,Math.floor(Number(value?.reserve)||0))),grenades:Math.max(0,Math.min(10,Math.floor(Number(value?.grenades)||0))) };}
export function serviceAction(c,state,id,atBase){
 if(!atBase)return{ok:false,message:'Visit a friendly settlement or secured base.'};
 c.baseLocker=normalizeBase(c.baseLocker);
 if(id==='deposit'){const ammo=Math.min(60,state.reserve,600-c.baseLocker.reserve),grenades=Math.min(1,state.grenades,10-c.baseLocker.grenades);state.reserve-=ammo;state.grenades-=grenades;c.baseLocker.reserve+=ammo;c.baseLocker.grenades+=grenades;return{ok:ammo+grenades>0,message:`Stored ${ammo} rounds and ${grenades} grenades at your squad bases.`};}
 if(id==='withdraw'){const ammo=Math.min(60,c.baseLocker.reserve,360-state.reserve),grenades=Math.min(1,c.baseLocker.grenades,5-state.grenades);state.reserve+=ammo;state.grenades+=grenades;c.baseLocker.reserve-=ammo;c.baseLocker.grenades-=grenades;return{ok:ammo+grenades>0,message:`Collected ${ammo} rounds and ${grenades} grenades.`};}
 const cost=id==='repair'?20:id==='supplies'?25:id==='regroup'?0:-1;
 if(cost<0)return{ok:false,message:'Unknown service.'};
 if(c.salvage<cost)return{ok:false,message:`Requires ${cost} salvage.`};
 c.salvage-=cost;
 if(id==='supplies'){state.reserve=Math.min(360,state.reserve+120);state.grenades=Math.min(5,state.grenades+2);}
 if(id==='repair'){state.health=100;state.energy=100;}
 return{ok:true,message:id==='repair'?'Squad treated and vehicles repaired.':id==='supplies'?'Field ammunition and grenades issued.':'Squad regrouped. Ready for your next mission.'};
}
