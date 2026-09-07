export function headingDegrees(yaw){return ((-yaw*180/Math.PI)%360+360)%360;}
export function bearingTo(from,to){return (Math.atan2(to.x-from.x,from.z-to.z)*180/Math.PI+360)%360;}
export function bearingDelta(target,heading){return ((target-heading+540)%360)-180;}
export function cardinal(heading){return ['N','NE','E','SE','S','SW','W','NW'][Math.round(heading/45)%8];}
export function formatDistance(distance){return distance>=1000?`${(distance/1000).toFixed(1)} km`:`${Math.round(distance)} m`;}
// Shared by atlas, compass and the world pin so every surface describes one signal.
export function targetNavigation(position,yaw,target){
 if(!target)return null;
 const elevation=target.elevation??target.y??0,vertical=elevation-(position.y??0),distance=Math.hypot(target.x-position.x,vertical,target.z-position.z),delta=bearingDelta(bearingTo(position,target),headingDegrees(yaw));
 return {distance,distanceLabel:formatDistance(distance),vertical,verticalLabel:Math.abs(vertical)<8?'LEVEL':`${vertical>0?'↑':'↓'} ${formatDistance(Math.abs(vertical))}`,delta,arrow:Math.abs(delta)<=60?'◇':delta<0?'◀':'▶',offscreen:Math.abs(delta)>60};
}
export function flightGuidance({position,tracked,speed=0,altitude=0,landed=false}){
 if(landed)return {label:'GEAR LOCKED',detail:'Disembark or rise to lift off',danger:false};
 const deck=tracked&&['carrier','station','corvette','capital-ship'].includes(tracked.kind),hostile=tracked?.faction==='pirate'||tracked?.faction==='hostile';
 const near=tracked&&Math.hypot(tracked.x-position.x,tracked.z-position.z)<500;
 return {label:deck?(hostile?'HOSTILE DECK':tracked.faction==='friendly'?'FRIENDLY DECK':'NEUTRAL DECK'):'VTOL APPROACH',detail:near?`${speed>=19?'BRAKE · ':''}Approach below 19 m/s · ${deck?'deck '+Math.round(tracked.elevation??tracked.y??0)+' m':'height '+Math.round(altitude)+' m AGL'}${hostile?' · Boarding resistance':''}`:`${Math.round(speed)} m/s · ${Math.round(altitude)} m AGL${deck?' · Deck '+Math.round(tracked.elevation??tracked.y??0)+' m':''}`,danger:!!hostile};
}
export const RECOVERY_CELL={x:0,z:206};
export function recoveryStep(c,position,target,held,dt,aboard){
 const q=c.onboarding;if(!q||q.stage==='complete')return null;
 if(q.stage==='launch'&&aboard){q.stage='complete';q.progress=0;return 'complete';}
 if(!['cell','ship'].includes(q.stage))return null;
 const near=Math.hypot(position.x-target.x,position.y-target.y,position.z-target.z)<5;
 q.progress=near&&held?(q.progress||0)+dt:0;
 if(q.progress<2)return null;
 const prior=q.stage;q.stage=prior==='cell'?'ship':'launch';q.progress=0;return prior;
}
