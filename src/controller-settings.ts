import {controllerSettings} from './gamepad-rules.mjs';
const KEY='blackline.controller.v1',MODE_KEY='blackline.input-mode.v1';
export function installControllerSettings(panel:HTMLElement){
 let value=controllerSettings();try{value=controllerSettings(JSON.parse(localStorage.getItem(KEY)||'{}'));}catch{}
 type InputMode='auto'|'controller'|'keyboard';
 let mode:InputMode='auto',testing=false,lastPoll=0,cancelSince=0,lastButton='None yet';
 try{const saved=localStorage.getItem(MODE_KEY);if(saved==='controller'||saved==='keyboard')mode=saved;}catch{}
 panel.insertAdjacentHTML('afterbegin','<section id="pad-input-setup"><h3>INPUT SETUP</h3><label>Play with<select id="input-mode"><option value="auto">Auto — prefer a connected controller</option><option value="controller">Xbox controller only</option><option value="keyboard">Keyboard and mouse</option></select></label><p>Controller mode blocks mouse and keyboard commands from desktop controller software. Select Keyboard and mouse here to switch back.</p><button class="secondary" id="pad-test-toggle">TEST MY CONTROLLER</button><div id="pad-live-test" hidden><p id="pad-device-status" role="status">Press a controller button to connect.</p><p id="pad-input-test"></p><p>Move each stick and press A. The display should say LEFT STICK and A. Gameplay and menu actions stay paused. Hold B for one second to finish testing.</p></div></section>');
 const modeSelect=panel.querySelector<HTMLSelectElement>('#input-mode')!;
 modeSelect.value=mode;
 function setMode(next:InputMode,notify=true){mode=next;modeSelect.value=mode;try{localStorage.setItem(MODE_KEY,mode);}catch{}if(notify)window.dispatchEvent(new Event('blackline-input-mode'));}
 modeSelect.onchange=()=>setMode(modeSelect.value as InputMode);
 function setTesting(next:boolean){testing=next;cancelSince=0;panel.querySelector<HTMLElement>('#pad-live-test')!.hidden=!next;panel.querySelector('#pad-test-toggle')!.textContent=next?'DONE TESTING':'TEST MY CONTROLLER';window.dispatchEvent(new Event('blackline-input-mode'));}
 panel.querySelector('#pad-test-toggle')!.addEventListener('click',()=>setTesting(!testing));
 function poll(now:number){if(panel.hidden){testing=false;return;}if(now-lastPoll<100)return;lastPoll=now;if(!testing)return;
  const status=panel.querySelector('#pad-device-status')!,display=panel.querySelector('#pad-input-test')!;
  try{const pads=Array.from(navigator.getGamepads?.()??[]).filter((p):p is Gamepad=>!!p?.connected);const pad=pads.find(p=>p.buttons.some(b=>b.pressed||b.value>.25)||p.axes.some(a=>Math.abs(a)>.25))??pads[0];
   if(!pad){status.textContent='No controller input received. Press a button. If the controller only moves the mouse, turn off its desktop mouse mode, then reconnect.';display.textContent='Waiting for actual controller buttons and sticks.';return;}
   status.textContent=pad.id+(pad.mapping==='standard'?' · Xbox layout detected':' · Unrecognized layout: '+(pad.mapping||'unmapped'));
   const labels=['A','B','X','Y','LB','RB','LT','RT','View / pause','Menu / map','Left stick click','Right stick click','D-pad up','D-pad down','D-pad left','D-pad right'];
   const pressed=pad.buttons.flatMap((b,i)=>b.pressed||b.value>.25?[labels[i]??'Button '+i]:[]);if(pressed.length)lastButton=pressed.join(' + ');
   if(pad.mapping==='standard'&&(pad.buttons[1]?.pressed||pad.buttons[1]?.value>.25)){if(!cancelSince)cancelSince=now;else if(now-cancelSince>=1000){setTesting(false);return;}}else cancelSince=0;
   const axis=(i:number)=>(pad.axes[i]??0).toFixed(2);display.textContent='Last button: '+lastButton+' | LEFT STICK '+axis(0)+', '+axis(1)+' | RIGHT STICK '+axis(2)+', '+axis(3);
  }catch{status.textContent='The browser is not allowing controller input on this page.';display.textContent='Open the game directly in Edge and try again.';}
 }
 const guide=panel.querySelector<HTMLElement>('.controller-guide')!;
 guide.insertAdjacentHTML('beforeend','<label>Aiming speed<input id="pad-ads" type="range" min="0.2" max="0.8" step="0.05"></label><label>Flight look speed<input id="pad-flight" type="range" min="0.5" max="2" step="0.1"></label><label>Movement stick deadzone<input id="pad-move-deadzone" type="range" min="0.05" max="0.4" step="0.01"></label><label>Look stick deadzone<input id="pad-look-deadzone" type="range" min="0.05" max="0.4" step="0.01"></label><p class="controller-setting-tip">Raise a deadzone if your stick drifts. In menus: left stick / D-pad to move, A to select, B to return. Left / right adjusts settings.</p><button type="button" id="pad-reset" class="secondary">RESET CONTROLLER SETTINGS</button><p id="pad-settings-status" role="status" aria-live="polite"></p>');
 const fields={sensitivity:'pad-sensitivity',ads:'pad-ads',flight:'pad-flight',moveDeadzone:'pad-move-deadzone',lookDeadzone:'pad-look-deadzone',invert:'pad-invert'} as const;
 function sync(){for(const [key,id] of Object.entries(fields)){const input=panel.querySelector<HTMLInputElement>('#'+id)!;if(input.type==='checkbox')input.checked=value.invert;else{input.value=String(value[key as keyof typeof value]);input.setAttribute('aria-valuetext',input.value);const output=input.parentElement!.querySelector('output')||input.parentElement!.appendChild(document.createElement('output'));output.textContent=input.value;}}}
 function save(){try{localStorage.setItem(KEY,JSON.stringify(value));}catch{panel.querySelector('#pad-settings-status')!.textContent='Settings apply now; this browser could not save them.';}}
 for(const [key,id] of Object.entries(fields)){const input=panel.querySelector<HTMLInputElement>('#'+id)!;input.addEventListener('input',()=>{value=controllerSettings({...value,[key]:input.type==='checkbox'?input.checked:+input.value});sync();save();});}
 panel.querySelector('#pad-reset')!.addEventListener('click',()=>{value=controllerSettings();sync();save();});sync();
 return {get value(){return value;},get mode(){return mode;},get testing(){return testing;},lockController(){if(mode==='auto')setMode('controller',false);},startTest(){setMode('controller');setTesting(true);},poll};
}
