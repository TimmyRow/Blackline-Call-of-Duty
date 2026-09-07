/** Separate coordinate sectors keep the existing Orison survey and saves stable. */
export const PLANETS = [
 {id:'orison',name:'Orison',x:0,z:0,arrival:{x:0,y:16.16,z:110},description:'Temperate coast, colonial settlements and an occupied orbital anchorage.'},
 {id:'vesper',name:'Vesper',x:42000,z:0,arrival:{x:42000,y:58.16,z:35},description:'An amber desert world of salt basins, obsidian ridges and ancient signal vaults.'}
];
export function getPlanetAt(x,z){return Math.hypot(x-42000,z)<10000?PLANETS[1]:PLANETS[0];}
export function getPlanetArrival(id){const planet=PLANETS.find(p=>p.id===id);return planet?{...planet.arrival}:null;}
export const BIOMES={
 coast:{id:'coast',name:'Ash Coast',ground:'#53695b',rock:'#7c8987',plant:'#344d3d',density:1},
 forest:{id:'forest',name:'Luminous Forest',ground:'#344958',rock:'#718591',plant:'#427e8c',density:1.25},
 desert:{id:'desert',name:'Amber Dunes',ground:'#ae7951',rock:'#8b6657',plant:'#856674',density:.18},
 volcanic:{id:'volcanic',name:'Obsidian Reach',ground:'#3a3943',rock:'#575061',plant:'#7e6176',density:.25},
 salt:{id:'salt',name:'Glass Salt Basin',ground:'#c6bda8',rock:'#a99895',plant:'#688a87',density:.1}
};
export function biomeAt(x,z){
 if(getPlanetAt(x,z).id==='vesper'){
  const lx=x-42000;if(lx<-700)return BIOMES.volcanic;if(z>550)return BIOMES.salt;return BIOMES.desert;
 }
 if(Math.hypot(x,z)<1500)return BIOMES.coast;
 if(x>1200&&z<-1100)return BIOMES.desert;
 if(x<-1200&&z>900)return BIOMES.volcanic;
 return BIOMES.forest;
}
/** Dunes and ridges differ from Orison's noisy hills; the basin has no ocean. */
export function vesperHeight(x,z){
 const lx=x-42000,r=Math.hypot(lx,z);
 const dunes=Math.sin(lx/115+Math.sin(z/290)*1.6)*12+Math.sin(z/190)*9;
 const ridge=Math.pow((Math.sin(lx/410+z/740)+1)/2,5)*110;
 const basin=1-Math.min(1,Math.abs(z-1150)/850);
 return 42+dunes+ridge*(lx<-650?1:.3)-basin*19+Math.min(40,r*.001);
}
export const DESTINATION_SITES=[
 {id:'vesper-port',name:'Sunfall Expedition Port',x:42000,z:0,elevation:58,kind:'outpost',district:'market',faction:'friendly',radius:72,description:'A colonial refit stop above Vesper’s amber dunes. Explore the exchange and resupply.'},
 {id:'vesper-vault',name:'The Echo Vault',x:41320,z:-540,elevation:72,kind:'ruin',faction:'neutral',radius:64,description:'Ancient resonators surround a sheltered archive. Recover a lost survey blueprint.'},
 {id:'vesper-mine',name:'Obsidian Extraction',x:40900,z:120,elevation:82,kind:'camp',district:'mining',faction:'pirate',radius:65,description:'Pirates strip rare crystals from the volcanic escarpment.'},
 {id:'vesper-salt',name:'Glass Basin Survey',x:42450,z:960,elevation:32,kind:'ruin',faction:'neutral',radius:60,description:'A forgotten alien observatory rises out of the salt flats.'},
 {id:'island-redoubt',name:'Breakwater Redoubt',x:650,z:960,elevation:8,kind:'camp',district:'salvage',faction:'pirate',radius:70,description:'An occupied island salvage battery guards the carrier approach.'}
];

/** Solid wall segments share these tested open routes with the scene builder. */
export function getDestinationInterior(kind){
 if(kind==='station')return [
  {name:'TRANSIT SPINE',sub:'HANGARS / OBSERVATION',x:0,z:-28,w:14,d:38,h:7,door:10,role:'corridor'},
  {name:'OBSERVATION',sub:'MERIDIAN / ORISON OVERLOOK',x:0,z:-59,w:66,d:24,h:10,door:10,role:'observation'}
 ];
 if(kind==='pirate-ship')return [
  {name:'BOARDING ACCESS',sub:'CARGO / DETENTION / BRIDGE',x:0,z:-28,w:22,d:28,h:7,door:8,role:'cargo'},
  {name:'CORSAIR BRIDGE',sub:'NAVIGATION / RECOVER SHIP RECORDS',x:0,z:-53,w:22,d:22,h:8,door:8,role:'bridge'}
 ];
 return [];
}
export function interiorWallBoxes(room){
 const {x,z,w,d,h,door}=room,wing=(w-door)/2;
 return [
  {x:x-w/2,y:h/2,z,w:.5,h,d}, {x:x+w/2,y:h/2,z,w:.5,h,d},
  ...[-1,1].flatMap(end=>[
   ...[-1,1].map(side=>({x:x+side*(door/2+wing/2),y:h/2,z:z+end*d/2,w:wing,h,d:.5})),
   {x,y:h-.6,z:z+end*d/2,w:door,h:1.2,d:.5}
  ])
 ];
}
