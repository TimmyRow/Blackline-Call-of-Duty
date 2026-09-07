import {readPad,PAD_KEYS,controllerSettings} from './gamepad-rules.mjs';
type Actions={enabled:()=>boolean;context:()=>string;vehicle?:()=>boolean;panMap?:(x:number,z:number,dt:number)=>void;settings?:()=>ReturnType<typeof controllerSettings>;key:(code:string,down:boolean)=>void;move:(x:number,z:number)=>void;look:(x:number,y:number,dt:number)=>void;fire:(v:boolean)=>void;aim:(v:boolean)=>void;active:()=>void;disconnect:()=>void;pause:()=>void;map:()=>void;stop:()=>void;back:()=>void;panel:()=>HTMLElement|null;wake:()=>void};
export function createGamepad(actions:Actions){
 let index:number|null=null,previous:boolean[]=[],blocked=new Set<number>(),held=new Set<string>(),context='',nextNav=0,navDirection=0,connected=false,moveBlocked=false,lookBlocked=false,nextWake=0,hasConnected=false;
 let sprint=false,crouch=false,vehicle=false;
 function release(){sprint=crouch=false;for(const key of held)actions.key(key,false);held.clear();actions.move(0,0);actions.fire(false);actions.aim(false);}
 function reset(){release();previous.forEach((v,i)=>{if(v)blocked.add(i);});moveBlocked=true;lookBlocked=true;navDirection=0;}
 function controls(){return Array.from(actions.panel()?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)')??[]).filter(e=>e.getClientRects().length>0&&!e.closest('[hidden]'));}
 function focus(el:HTMLElement|undefined){el?.focus();el?.scrollIntoView({block:'nearest',inline:'nearest'});}
 function navigate(direction:number){const items=controls();if(!items.length)return;const i=items.indexOf(document.activeElement as HTMLElement);focus(items[i<0?(direction<0?items.length-1:0):(i+direction+items.length)%items.length]);}
 function adjust(direction:number){const el=document.activeElement;if(el instanceof HTMLInputElement&&el.type==='range'){const step=+el.step||1;el.value=String(Math.round(Math.max(+el.min,Math.min(+el.max,+el.value+direction*step))*10000)/10000);el.dispatchEvent(new Event('input',{bubbles:true}));}else if(el instanceof HTMLSelectElement){let next=el.selectedIndex+direction;while(next>=0&&next<el.options.length&&el.options[next].disabled)next+=direction;if(next>=0&&next<el.options.length){el.selectedIndex=next;el.dispatchEvent(new Event('change',{bubbles:true}));}}else navigate(direction);}
 function disconnect(){if(!connected)return;const wasActive=actions.enabled();release();connected=false;index=null;previous=[];blocked.clear();context='';moveBlocked=false;lookBlocked=false;if(wasActive)actions.disconnect();}
 return {reset,get connected(){return connected;},poll(dt:number,now:number){
  let pads:readonly (Gamepad|null)[]=[];try{pads=navigator.getGamepads?.()??[];}catch{disconnect();return;}
  // A dormant virtual/second controller must not capture the playable controller.
  const standard=pads.filter((p):p is Gamepad=>!!p?.connected&&p.mapping==='standard');
  const hasInput=(p:Gamepad)=>p.buttons.some(b=>b.pressed||b.value>.25)||p.axes.some(v=>Math.abs(v)>.4);
  const selected=standard.find(p=>p.index===index);
  const pad=selected&&hasInput(selected)?selected:standard.find(hasInput)??selected??standard[0];
  if(!pad||!pad.connected||pad.mapping!=='standard'){disconnect();return;}
  if(connected&&index!==pad.index){reset();previous=[];blocked.clear();index=pad.index;}
  const reconnecting=!connected&&hasConnected;if(!connected){index=pad.index;connected=true;hasConnected=true;previous=[];}
  const sample=readPad(pad,previous,actions.settings?.())!;previous=sample.down;if(reconnecting){sample.down.forEach((v,i)=>{if(v)blocked.add(i);});moveBlocked=true;lookBlocked=true;}
  const activity=sample.down.some(Boolean)||Math.hypot(sample.move.x,sample.move.y,sample.look.x,sample.look.y)>.01;
  if(activity){actions.active();if(now>=nextWake){nextWake=now+1000;actions.wake();}}
  if(!actions.enabled())return;
  const current=actions.context();
  if(current!==context){const first=!context;release();context=current;navDirection=0;if(!first){sample.down.forEach((v,i)=>{if(v)blocked.add(i);});moveBlocked=true;lookBlocked=true;}if(current!=='playing'&&current!=='intro'&&!controls().includes(document.activeElement as HTMLElement))focus(controls()[0]);}
  sample.down.forEach((v,i)=>{if(!v)blocked.delete(i);});
  if(Math.hypot(sample.move.x,sample.move.y)<.01)moveBlocked=false;
  if(Math.hypot(sample.look.x,sample.look.y)<.01)lookBlocked=false;
  const pressed=(i:number)=>sample.pressed[i]&&!blocked.has(i),down=(i:number)=>sample.down[i]&&!blocked.has(i);
  if(pressed(9)){reset();actions.map();return;}
  if(pressed(8)){reset();actions.pause();return;}
  if(current==='intro'){if(pressed(0)||pressed(1))actions.back();return;}
  if(current!=='playing'){
   const mx=moveBlocked?0:sample.move.x,my=moveBlocked?0:sample.move.y;
   const vertical=down(12)||my<-.55?-1:down(13)||my>.55?1:0;
   const horizontal=down(14)||mx<-.55?-1:down(15)||mx>.55?1:0;
   const direction=vertical||horizontal*2;
   if(direction&&(direction!==navDirection||now>=nextNav)){if(vertical)navigate(vertical);else adjust(horizontal);nextNav=now+(direction!==navDirection?360:140);}navDirection=direction;
   const panel=actions.panel();
   if(!controls().includes(document.activeElement as HTMLElement))focus(controls()[0]);
   if(pressed(4)||pressed(5)){
    if(current==='map')panel?.querySelector<HTMLButtonElement>(pressed(4)?'[data-zoom="out"]':'[data-zoom="in"]')?.click();
    else{const tabs=Array.from(panel?.querySelectorAll<HTMLButtonElement>('[data-section]')??[]).filter(e=>!e.hidden);const i=tabs.findIndex(e=>e.getAttribute('aria-pressed')==='true');const tab=tabs[(i+(pressed(4)?-1:1)+tabs.length)%tabs.length];tab?.click();focus(tab);}
   }
   if(pressed(0)){const items=controls(),focused=document.activeElement as HTMLElement;const button=items.includes(focused)?focused:items[0];if(button instanceof HTMLSelectElement)adjust(1);else button?.click();}
   const rx=lookBlocked?0:sample.look.x,ry=lookBlocked?0:sample.look.y;
   if(current==='map')actions.panMap?.(rx,ry,dt);
   else if(Math.abs(ry)>.01)panel?.scrollBy({top:ry*650*Math.min(.05,dt),behavior:'instant'});
   if(pressed(1))actions.back();return;
  }
  navDirection=0;
  // B cancels held actions and brakes; movement must return to neutral before restarting.
  if(down(1)){release();moveBlocked=true;sample.down.forEach((v,i)=>{if(v&&i!==1)blocked.add(i);});actions.stop();actions.look(lookBlocked?0:sample.look.x,lookBlocked?0:sample.look.y,dt);return;}
  actions.move(moveBlocked?0:sample.move.x,moveBlocked?0:sample.move.y);actions.aim(down(6));actions.fire(down(7));actions.look(lookBlocked?0:sample.look.x,lookBlocked?0:sample.look.y,dt);
  const inVehicle=actions.vehicle?.()??false;
  if(inVehicle!==vehicle){sprint=crouch=false;vehicle=inVehicle;}
  if(pressed(13)&&!vehicle){crouch=!crouch;sprint=false;}
  if(pressed(0)&&!vehicle)crouch=false;
  if(pressed(10)){sprint=!sprint;if(sprint)crouch=false;}
  const moving=!moveBlocked&&Math.hypot(sample.move.x,sample.move.y)>.2;
  if((!moving&&!(vehicle&&(down(0)||down(13)))&&!pressed(10))||(!vehicle&&(down(6)||crouch)))sprint=false;
  for(const [button,key] of Object.entries(PAD_KEYS)){const i=+button,heldDown=i===13?(vehicle?down(i):crouch):i===10?sprint:down(i);if(heldDown&&!held.has(key)){held.add(key);actions.key(key,true);if(actions.context()!==current){reset();return;}}else if(!heldDown&&held.delete(key))actions.key(key,false);}
 }};
}
