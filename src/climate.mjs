/** A saved expedition clock drives gradual atmosphere changes; no wall-clock timers. */
export const DAY_DURATION = 2400;
export const WEATHER_DURATION = 330;
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const pattern=[.62,.95,.18,0,.32,.78,1,.12];
export function climateAt(time=0,override={}){
 const elapsed=Math.max(0,Number.isFinite(time)?time:0);
 const hour=override.hour===undefined?(19.1+elapsed/DAY_DURATION*24)%24:((override.hour%24)+24)%24;
 const phase=elapsed/WEATHER_DURATION,index=Math.floor(phase),blend=smooth((phase-index-.65)/.35);
 let rain=pattern[index%pattern.length]+(pattern[(index+1)%pattern.length]-pattern[index%pattern.length])*blend;
 if(override.weather==='clear')rain=0;else if(override.weather==='rain')rain=.62;else if(override.weather==='storm')rain=1;
 const daylight=smooth((Math.sin((hour-6)/24*Math.PI*2)+.16)/.5);
 const twilight=1-Math.min(1,Math.abs(Math.sin((hour-6)/24*Math.PI*2))*3.5);
 return {hour,daylight,twilight,rain,storm:smooth((rain-.7)/.3),wind:2+rain*9,weather:rain>.8?'storm':rain>.24?'rain':'clear',cycleSeconds:DAY_DURATION};
}
