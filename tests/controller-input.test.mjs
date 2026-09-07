import test from 'node:test';
import assert from 'node:assert/strict';
import {controllerSettings,controllerLook,readPad} from '../src/gamepad-rules.mjs';
import {createGamepad} from '../src/gamepad.ts';

function fixture(context='playing'){
 const state={context,vehicle:false,active:true,keys:new Set(),move:[0,0],look:[0,0],fire:false,aim:false,pauses:0,disconnects:0,wakes:0,clicks:0};
 const pad={index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
 let pads=[pad],time=0;
 const button={getClientRects:()=>[{}],closest:()=>null,focus(){document.activeElement=this;},scrollIntoView(){},click(){state.clicks++;}};
 globalThis.document={activeElement:null};
 globalThis.HTMLInputElement=class {};globalThis.HTMLSelectElement=class {};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{getGamepads:()=>pads}});
 const api=createGamepad({enabled:()=>state.active,context:()=>state.context,vehicle:()=>state.vehicle,key(k,v){v?state.keys.add(k):state.keys.delete(k);},move(x,z){state.move=[x,z];},look(x,y){state.look=[x,y];},fire(v){state.fire=v;},aim(v){state.aim=v;},active(){state.active=true;},disconnect(){state.disconnects++;state.context='paused';},pause(){state.pauses++;state.context=state.context==='playing'?'paused':'playing';},missions(){state.context='journal';},back(){state.context='playing';},panel:()=>({querySelectorAll:()=>[button]}),wake(){state.wakes++;}});
 return {state,pad,api,poll(){api.poll(.016,time);time+=16;},press(i,value=1){pad.buttons[i]={pressed:value>.5,value};},disconnect(){pads=[];},reconnect(){pads=[pad];}};
}
test('controller settings reject corrupt values and bound sensitivity/deadzones',()=>{
 const value=controllerSettings({sensitivity:Infinity,ads:9,moveDeadzone:-4,lookDeadzone:.9,invert:'true'});
 assert.equal(value.sensitivity,1);assert.equal(value.ads,.8);assert.equal(value.moveDeadzone,.05);assert.equal(value.lookDeadzone,.4);assert.equal(value.invert,false);assert.deepEqual(controllerSettings(null),controllerSettings());
});
test('look has precise centre response, separate ADS and flight speeds, inversion, bounded frame time',()=>{
 const normal=controllerLook(.25,.5,.016),ads=controllerLook(.25,.5,.016,{},true),flight=controllerLook(.25,.5,.016,{flight:1.5},true,true);
 assert(normal.yaw<0&&normal.pitch<0);assert(Math.abs(ads.yaw/normal.yaw-.35)<1e-9);assert(Math.abs(flight.yaw/normal.yaw-1.5)<1e-9);
 assert.equal(controllerLook(0,.5,.016,{invert:true}).pitch,-normal.pitch);assert.deepEqual(controllerLook(1,1,9),controllerLook(1,1,.05));assert.equal(Math.abs(controllerLook(NaN,Infinity,NaN).yaw),0);
});
test('movement and look sticks have independently adjustable drift rejection',()=>{
 const f=fixture();f.pad.axes=[.15,0,.15,0];const s=readPad(f.pad,[],{moveDeadzone:.2,lookDeadzone:.1});assert.equal(s.move.x,0);assert(s.look.x>0);
});
test('first A selects menu, held A cannot leak into jump after deployment',()=>{
 const f=fixture('menu');f.press(0);f.poll();assert.equal(f.state.clicks,1);f.state.context='playing';f.poll();assert(!f.state.keys.has('Space'));f.press(0,0);f.poll();f.press(0);f.poll();assert(f.state.keys.has('Space'));
});
test('pause clears movement ADS fire and boost; held inputs require neutral before resuming',()=>{
 const f=fixture();f.state.vehicle=true;f.pad.axes=[.8,0,.5,0];f.press(6);f.press(7);f.press(10);f.poll();assert(f.state.fire&&f.state.aim);assert(f.state.keys.has('ShiftLeft'));f.press(9);f.poll();assert.equal(f.state.context,'paused');assert.deepEqual(f.state.move,[0,0]);assert(!f.state.fire&&!f.state.aim);assert.equal(f.state.keys.size,0);
 f.state.context='playing';f.poll();assert.deepEqual(f.state.move,[0,0]);assert.deepEqual(f.state.look,[0,0]);assert(!f.state.fire);f.pad.axes=[0,0,0,0];for(let i=0;i<17;i++)f.press(i,0);f.poll();f.pad.axes=[.8,0,.5,0];f.press(7);f.poll();assert(f.state.move[0]>0&&f.state.look[0]>0&&f.state.fire);
});
test('disconnect releases controls exactly once and reconnect can resume',()=>{
 const f=fixture();f.press(7);f.press(10);f.poll();f.disconnect();f.poll();f.poll();assert.equal(f.state.disconnects,1);assert(!f.state.fire);assert.equal(f.state.keys.size,0);f.press(7,0);f.press(10,0);f.reconnect();f.poll();f.press(9);f.poll();assert.equal(f.state.context,'playing');assert(f.api.connected);
});
test('continuous stick input does not spam audio resume every frame',()=>{
 const f=fixture();f.pad.axes[0]=1;for(let i=0;i<60;i++)f.poll();assert.equal(f.state.wakes,1);
});

test('reconnecting while A is held cannot automatically leave the pause screen',()=>{
 const f=fixture();f.poll();f.disconnect();f.poll();f.press(0);f.reconnect();f.poll();assert.equal(f.state.clicks,0);assert.equal(f.state.context,'paused');f.press(0,0);f.poll();f.press(0);f.poll();assert.equal(f.state.clicks,1);
});


test('B toggles crouch on foot, A stands and jumps, and vehicles use hold-to-descend',()=>{
 const f=fixture();f.poll();f.press(1);f.poll();f.press(1,0);f.poll();assert(f.state.keys.has('KeyC'));
 f.press(0);f.poll();assert(!f.state.keys.has('KeyC'));assert(f.state.keys.has('Space'));f.press(0,0);f.poll();
 f.state.vehicle=true;f.press(1);f.poll();assert(f.state.keys.has('KeyC'));f.press(1,0);f.poll();assert(!f.state.keys.has('KeyC'));
});

test('click sprint continues after release, stops on neutral or aim, and resets at menus',()=>{
 const f=fixture();f.pad.axes[1]=-1;f.press(10);f.poll();f.press(10,0);f.poll();assert(f.state.keys.has('ShiftLeft'));
 f.press(6);f.poll();assert(!f.state.keys.has('ShiftLeft'));f.press(6,0);f.poll();f.press(10);f.poll();f.press(10,0);f.poll();assert(f.state.keys.has('ShiftLeft'));
 f.pad.axes[1]=0;f.poll();assert(!f.state.keys.has('ShiftLeft'));f.press(1);f.poll();assert(f.state.keys.has('KeyC'));f.api.reset();assert.equal(f.state.keys.size,0);
});

test('an idle virtual pad does not swallow the active Xbox controller',()=>{
 const f=fixture();const idle={...f.pad,index:0,axes:[0,0,0,0],buttons:[]};f.pad.index=2;
 Object.defineProperty(navigator,'getGamepads',{value:()=>[idle,null,f.pad]});f.poll();f.pad.axes[1]=-1;f.press(0);f.poll();
 f.pad.axes[1]=0;f.press(0,0);f.poll();f.pad.axes[1]=-1;f.press(0);f.poll();assert.equal(f.state.move[1],-1);assert(f.state.keys.has('Space'));
});
