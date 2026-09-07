import {readPad,PAD_KEYS} from './gamepad-rules.mjs';
type Actions={enabled:()=>boolean;context:()=>string;key:(code:string,down:boolean)=>void;move:(x:number,z:number)=>void;look:(x:number,y:number,dt:number)=>void;fire:(v:boolean)=>void;aim:(v:boolean)=>void;active:()=>void;disconnect:()=>void;pause:()=>void;missions:()=>void;back:()=>void;panel:()=>HTMLElement|null;wake:()=>void};
export function createGamepad(actions:Actions){
 let index:number|null=null,previous:boolean[]=[],blocked=new Set<number>(),held=new Set<string>(),context='',nextNav=0,navDirection=0,connected=false;
 function release(){for(const key of held)actions.key(key,false);held.clear();actions.move(0,0);actions.fire(false);actions.aim(false);}
 function reset(){release();previous.forEach((v,i)=>{if(v)blocked.add(i);});}
 function controls(){return Array.from(actions.panel()?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)')??[]).filter(e=>e.getClientRects().length>0&&!e.closest('[hidden]'));}
 function navigate(direction:number){const items=controls();if(!items.length)return;const i=items.indexOf(document.activeElement as HTMLElement),next=items[(i+direction+items.length)%items.length];next.focus();next.scrollIntoView({block:'nearest'});}
 function adjust(direction:number){const el=document.activeElement;if(el instanceof HTMLInputElement&&el.type==='range'){el.value=String(Math.max(+el.min,Math.min(+el.max,+el.value+direction*(+el.step||1))));el.dispatchEvent(new Event('input',{bubbles:true}));}else if(el instanceof HTMLSelectElement){el.selectedIndex=Math.max(0,Math.min(el.options.length-1,el.selectedIndex+direction));el.dispatchEvent(new Event('change',{bubbles:true}));}else navigate(direction);}
 return {reset,get connected(){return connected;},poll(dt:number,now:number){
  let pads:readonly (Gamepad|null)[]=[];try{pads=navigator.getGamepads?.()??[];}catch{if(connected){const wasActive=actions.enabled();release();connected=false;index=null;previous=[];blocked.clear();if(wasActive)actions.disconnect();}return;}
  const pad=index===null?pads.find(p=>p?.connected&&p.mapping==='standard'):pads[index];
  if(!pad||!pad.connected||pad.mapping!=='standard'){if(connected){const wasActive=actions.enabled();release();connected=false;index=null;previous=[];blocked.clear();if(wasActive)actions.disconnect();}return;}
  if(!connected){index=pad.index;connected=true;previous=[];}
  const sample=readPad(pad,previous)!;previous=sample.down;
  const activity=sample.down.some(Boolean)||Math.hypot(sample.move.x,sample.move.y,sample.look.x,sample.look.y)>.01;
  if(activity){actions.active();actions.wake();}
  if(!actions.enabled())return;
  const current=actions.context();if(current!==context){release();context=current;sample.down.forEach((v,i)=>{if(v)blocked.add(i);});}
  sample.down.forEach((v,i)=>{if(!v)blocked.delete(i);});
  const pressed=(i:number)=>sample.pressed[i]&&!blocked.has(i),down=(i:number)=>sample.down[i]&&!blocked.has(i);
  if(pressed(9)){reset();actions.pause();return;}
  if(pressed(8)){reset();actions.missions();return;}
  if(current==='intro'){if(pressed(0)||pressed(1))actions.back();return;}
  if(current!=='playing'){
   const direction=sample.down[12]||sample.move.y<-.55?-1:sample.down[13]||sample.move.y>.55?1:0;
   if(direction&&(direction!==navDirection||now>=nextNav)){navigate(direction);nextNav=now+(direction!==navDirection?360:140);}navDirection=direction;
   if(pressed(14))adjust(-1);if(pressed(15))adjust(1);
   if(pressed(4)||pressed(5)){const tab=actions.panel()?.querySelector<HTMLButtonElement>(pressed(4)?'[data-section="missions"]':'[data-section="equipment"]');tab?.click();tab?.focus();}
   if(pressed(0)){const items=controls(),focused=document.activeElement as HTMLElement;const button=items.includes(focused)?focused:items[0];button?.click();}
   if(pressed(1))actions.back();return;
  }
  navDirection=0;actions.move(sample.move.x,sample.move.y);actions.aim(down(6));actions.fire(down(7));actions.look(sample.look.x,sample.look.y,dt);
  for(const [button,key] of Object.entries(PAD_KEYS)){const i=+button;if(down(i)&&!held.has(key)){held.add(key);actions.key(key,true);if(actions.context()!==current){reset();return;}}else if(!down(i)&&held.delete(key))actions.key(key,false);}
 }};
}
