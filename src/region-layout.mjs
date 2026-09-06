export const REGION_START = {x:0,z:110};
export const REGION_SITES = [
 {id:'harbour',name:'Cold Harbour',x:0,z:-32,elevation:0,action:'Recover the invasion manifest',verb:'RECOVER INVASION MANIFEST',effect:'Patrol positions revealed on the field map',radius:31,holdSeconds:3},
 {id:'relay',name:'Northwatch Relay',x:-110,z:-100,elevation:11,action:'Disable the surveillance relay',verb:'DISABLE SURVEILLANCE',effect:'Enemy detection range reduced across the region',radius:30,holdSeconds:4},
 {id:'depot',name:'Tidebreak Battery',x:115,z:-75,elevation:3,action:'Cut the fire-control uplink',verb:'CUT FIRE CONTROL',effect:'Enemy fire coordination slowed across the region',radius:30,holdSeconds:4}
];
export const REGION_ROADS = [
 [[0,110],[0,75],[0,38],[0,12],[0,-32]],
 [[0,75],[-35,55],[-68,17],[-98,-32],[-110,-100]],
 [[0,75],[42,46],[86,15],[115,-28],[115,-75]],
 [[-110,-100],[-72,-129],[0,-145],[73,-120],[115,-75]],
 [[0,-32],[-42,-56],[-80,-85],[-110,-100]],
 [[0,-32],[40,-46],[80,-62],[115,-75]]
];
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function heightAt(x,z){
 let h=4+Math.sin(x*.017)*Math.cos(z*.019)*4.2+Math.sin((x-z)*.012)*2.3;
 const harbour=Math.hypot(x/31,(z+10)/43);h*=smooth(1,1.42,harbour);
 for(const site of [...REGION_SITES.slice(1),{...REGION_START,elevation:2}]){const d=Math.hypot(x-site.x,z-site.z);h=site.elevation+(h-site.elevation)*smooth(19,43,d);}
 const shore=Math.hypot(x*.96,(z+2)*1.04);h=h*(1-smooth(166,205,shore))-8*smooth(166,205,shore);
 return h;
}
export function regionName(x,z){
 const closest=[...REGION_SITES].sort((a,b)=>Math.hypot(x-a.x,z-a.z)-Math.hypot(x-b.x,z-b.z))[0];
 if(Math.hypot(x-closest.x,z-closest.z)<closest.radius)return closest.name;
 if(z>80)return 'South Landing';if(z<-120)return 'North Coast';return x< -40?'Northwatch Road':x>40?'Tidebreak Road':'Harbour Approach';
}
export const ENEMY_SPAWNS = [
 {site:'harbour',x:-9,z:-7},{site:'harbour',x:8,z:-13},{site:'harbour',x:-3,z:-21},{site:'harbour',x:3,z:-35},
 {site:'relay',x:-118,z:-94},{site:'relay',x:-103,z:-110},{site:'relay',x:-96,z:-89},
 {site:'depot',x:108,z:-68},{site:'depot',x:124,z:-83},{site:'depot',x:104,z:-88},
 {site:'road',x:-64,z:19},{site:'road',x:72,z:27}
];
