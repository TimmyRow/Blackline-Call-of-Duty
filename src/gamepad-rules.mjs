/** W3C standard mapping: Xbox layout, radial deadzones, bounded analog input. */
export function stick(x=0,y=0,deadzone=.18){
 x=Number.isFinite(x)?Math.max(-1,Math.min(1,x)):0;y=Number.isFinite(y)?Math.max(-1,Math.min(1,y)):0;
 const length=Math.hypot(x,y);if(length<=deadzone)return {x:0,y:0};
 const scale=Math.min(1,(length-deadzone)/(1-deadzone))/length;return {x:x*scale,y:y*scale};
}
export function readPad(pad,previous=[]){
 if(!pad||pad.connected===false||pad.mapping!=='standard')return null;
 const down=Array.from({length:17},(_,i)=>{const b=pad.buttons?.[i];return !!b&&(b.pressed||b.value>(previous[i]?.15:.25));});
 return {down,pressed:down.map((v,i)=>v&&!previous[i]),move:stick(pad.axes?.[0],pad.axes?.[1]),look:stick(pad.axes?.[2],pad.axes?.[3])};
}
export const PAD_KEYS={0:'Space',1:'ControlLeft',2:'KeyR',3:'KeyX',4:'KeyG',5:'KeyE',10:'ShiftLeft',11:'KeyF',12:'KeyV',13:'Tab',14:'KeyO',15:'KeyH'};
