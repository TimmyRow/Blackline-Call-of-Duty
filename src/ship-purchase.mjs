// Ownership lives in the validated milestone list; legacy expeditions retain their ship.
export const CITY={id:'port-astra',name:'Port Astra City',x:-1120,z:-1030,elevation:54,kind:'outpost',district:'city',faction:'friendly',radius:105,description:'A colonial city of apartment blocks, markets and an open-sky ship hangar. Buy your first Kestrel at Hangar 03.'};
export const HANGAR={id:'astra-hangar',name:'PORT ASTRA / HANGAR 03',x:CITY.x+10,z:CITY.z+53,elevation:CITY.elevation,kind:'hangar',faction:'friendly',radius:4};
export const SHIP_BERTH={x:CITY.x,z:CITY.z+35,y:CITY.elevation+2.31};
export const SHIP_PRICE=300;
export const ASTRA_APPROACH=[[-690,-540,52],[-690,-640,51],[-800,-725,50],[-900,-790,50],[-1030,-830,52],[-1120,-880,54],[-1120,-940,54]];
export const PURCHASE_ROUTE='ship:purchase-route',SHIP_OWNED='ship:owned';
export const usesShipPurchase=c=>c.completed.includes(PURCHASE_ROUTE);
export const ownsShip=c=>!usesShipPurchase(c)||c.completed.includes(SHIP_OWNED);
export function shipOffer(c){
 if(ownsShip(c))return {available:false,description:'Kestrel belongs to you. Board at its beacon.'};
 if(c.onboarding.stage!=='complete'||!c.story.briefed||!['harbour','relay'].every(id=>c.completed.includes(id)))return {available:false,description:'Hangar clearance requires Mara’s briefing, the Cold Harbour ledger and the Northwatch transmission keys. Follow your main quest on foot.'};
 const missing=Math.max(0,SHIP_PRICE-c.salvage);
 return {available:!missing,description:missing?`Kestrel costs ${SHIP_PRICE} salvage. You have ${c.salvage}; earn ${missing} more from ground missions, camps or survey work.`:`Buy Kestrel for ${SHIP_PRICE} salvage at the Hangar 03 sales terminal. Includes squad seats, cannons and a jump drive.`};
}
export function buyFirstShip(c,position){
 if(![position.x,position.y,position.z].every(Number.isFinite)||Math.hypot(position.x-HANGAR.x,position.z-HANGAR.z,position.y-HANGAR.elevation-1.7)>4)return {ok:false,reason:'Visit the Hangar 03 sales terminal.'};
 const offer=shipOffer(c);if(!offer.available)return {ok:false,reason:offer.description};
 c.salvage-=SHIP_PRICE;c.completed.push(SHIP_OWNED);return {ok:true};
}
