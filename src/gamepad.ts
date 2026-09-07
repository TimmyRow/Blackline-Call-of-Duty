import {readPad,PAD_KEYS,controllerSettings} from './gamepad-rules.mjs';
type Actions={enabled:()=>boolean;context:()=>string;settings?:()=>ReturnType<typeof controllerSettings>;key:(code:string,down:boolean)=>void;move:(x:number,z:number)=>void;look:(x:number,y:number,dt:number)=>void;fire:(v:boolean)=>void;aim:(v:boolean)=>void;active:()=>void;disconnect:()=>void;pause:()=>void;missions:()=>void;back:()=>void;panel:()=>HTMLElement|null;wake:()=>void};
export function createGamepad(actions:Actions){
 let index:number|null=null,previous:boolean[]=[],blocked=new Set<number>(),held=new Set<string>(),context='',nextNav=0,navDirection=0,connected=false,moveBlocked=false,lookBlocked=false,nextWake=0,hasConnected=false;
 function release(){for(const key of held)actions.key(key,false);held.clear();actions.move(0,0);actions.fire(false);actions.aim(false);}
 function reset(){release();previous.forEach((v,i)=>{if(v)blocked.add(i);});moveBlocked=true;lookBlocked=true;navDirection=0;}
 function controls(){return Array.from(actions.panel()?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)')??[]).filter(e=>e.getClientRects().length>0&&!e.closest('[hidden]'));}
 function focus(el:HTMLElement|undefined){el?.focus();el?.scrollIntoView({block:'nearest',inline:'nearest'});}
 function navigate(direction:number){const items=controls();if(!items.length)return;const i=items.indexOf(document.activeElement as HTMLElement);focus(items[i<0?(direction<0?items.length-1:0):(i+direction+items.length)%items.length]);}
 function adjust(direction:number){const el=document.activeElement;if(el instanceof HTMLInputElement&&el.type==='range'){const step=+el.step||1;el.value=String(Math.round(Math.max(+el.min,Math.min(+el.max,+el.value+direction*step))*10000)/10000);el.dispatchEvent(new Event('input',{bubbles:true}));}else if(el instanceof HTMLSelectElement){let next=el.selectedIndex+direction;while(next>=0&&next<el.options.length&&el.options[next].disabled)next+=direction;if(next>=0&&next<el.options.length){el.selectedIndex=next;el.dispatchEvent(new Event('change',{bubbles:true}));}}else navigate(direction);}
 function disconnect(){if(!connected)return;const wasActive=actions.enabled();release();connected=false;index=null;previous=[];blocked.clear();context='';moveBlocked=false;lookBlocked=false;if(wasActive)actions.disconnect();}
 return {reset,get connected(){return connected;},poll(dt:number,now:number){
  let pads:readonly (Gamepad|null)[]=[];try{pads=navigator.getGamepads?.()??[];}catch{disconnect();return;}
  const pad=index===null?pads.find(p=>p?.connected&&p.mapping==='standard'):pads[index];
  if(!pad||!pad.connected||pad.mapping!=='standard'){disconnect();return;}
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
  if(pressed(9)){reset();actions.pause();return;}
  if(pressed(8)){reset();actions.missions();return;}
  if(current==='intro'){if(pressed(0)||pressed(1))actions.back();return;}
  if(current!=='playing'){
   const mx=moveBlocked?0:sample.move.x,my=moveBlocked?0:sample.move.y;
   const vertical=down(12)||my<-.55?-1:down(13)||my>.55?1:0;
   const horizontal=down(14)||mx<-.55?-1:down(15)||mx>.55?1:0;
   const direction=vertical||horizontal*2;
   if(direction&&(direction!==navDirection||now>=nextNav)){if(vertical)navigate(vertical);else adjust(horizontal);nextNav=now+(direction!==navDirection?360:140);}navDirection=direction;
   if(pressed(4)||pressed(5)){const tab=actions.panel()?.querySelector<HTMLButtonElement>(pressed(4)?'[data-section="missions"]':'[data-section="equipment"]');tab?.click();focus(tab??undefined);}
   if(pressed(0)){const items=controls(),focused=document.activeElement as HTMLElement;const button=items.includes(focused)?focused:items[0];button?.click();}
   if(pressed(1))actions.back();return;
  }
  navDirection=0;actions.move(moveBlocked?0:sample.move.x,moveBlocked?0:sample.move.y);actions.aim(down(6));actions.fire(down(7));actions.look(lookBlocked?0:sample.look.x,lookBlocked?0:sample.look.y,dt);
  for(const [button,key] of Object.entries(PAD_KEYS)){const i=+button;if(down(i)&&!held.has(key)){held.add(key);actions.key(key,true);if(actions.context()!==current){reset();return;}}else if(!down(i)&&held.delete(key))actions.key(key,false);}
 }};
}
