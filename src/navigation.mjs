export function headingDegrees(yaw){return ((-yaw*180/Math.PI)%360+360)%360;}
export function bearingTo(from,to){return (Math.atan2(to.x-from.x,from.z-to.z)*180/Math.PI+360)%360;}
export function bearingDelta(target,heading){return ((target-heading+540)%360)-180;}
export function cardinal(heading){return ['N','NE','E','SE','S','SW','W','NW'][Math.round(heading/45)%8];}
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
