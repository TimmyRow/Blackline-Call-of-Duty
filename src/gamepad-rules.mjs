/** W3C standard mapping: Xbox layout, radial deadzones, bounded analog input. */
export function stick(x=0,y=0,deadzone=.18){
 deadzone=Number.isFinite(deadzone)?Math.max(.05,Math.min(.4,deadzone)):.18;
 x=Number.isFinite(x)?Math.max(-1,Math.min(1,x)):0;y=Number.isFinite(y)?Math.max(-1,Math.min(1,y)):0;
 const length=Math.hypot(x,y);if(length<=deadzone)return {x:0,y:0};
 const scale=Math.min(1,(length-deadzone)/(1-deadzone))/length;return {x:x*scale,y:y*scale};
}
export function readPad(pad,previous=[],settings={}){
 if(!pad||pad.connected===false||pad.mapping!=='standard')return null;
 const down=Array.from({length:17},(_,i)=>{const b=pad.buttons?.[i];return !!b&&(b.pressed||b.value>(previous[i]?.15:.25));});
 const config=controllerSettings(settings);
 return {down,pressed:down.map((v,i)=>v&&!previous[i]),move:stick(pad.axes?.[0],pad.axes?.[1],config.moveDeadzone),look:stick(pad.axes?.[2],pad.axes?.[3],config.lookDeadzone)};
}
export const PAD_KEYS={0:'Space',1:'KeyC',2:'KeyR',3:'KeyX',4:'KeyG',5:'KeyE',10:'ShiftLeft',11:'KeyF',12:'KeyV',13:'Tab',14:'KeyO',15:'KeyH'};
export function controllerSettings(value={}){
 const v=value&&typeof value==='object'?value:{};
 const bounded=(key,fallback,min,max)=>Number.isFinite(v[key])?Math.max(min,Math.min(max,v[key])):fallback;
 return {sensitivity:bounded('sensitivity',1,.4,2),ads:bounded('ads',.35,.2,.8),flight:bounded('flight',1,.5,2),moveDeadzone:bounded('moveDeadzone',.18,.05,.4),lookDeadzone:bounded('lookDeadzone',.14,.05,.4),invert:v.invert===true};
}
/** Gentle precision curve near centre; full deflection retains a fast turn. */
export function controllerLook(x,y,dt,settings={},aiming=false,flying=false){
 const c=controllerSettings(settings),frame=Number.isFinite(dt)?Math.max(0,Math.min(.05,dt)):0;
 const speed=2.6*c.sensitivity*(flying?c.flight:aiming?c.ads:1)*frame;
 const curve=v=>Number.isFinite(v)?Math.sign(v)*Math.pow(Math.min(1,Math.abs(v)),1.6):0;
 return {yaw:-curve(x)*speed,pitch:-curve(y)*speed*(c.invert?-1:1)};
}
