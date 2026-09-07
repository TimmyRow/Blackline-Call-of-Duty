import {controllerSettings} from './gamepad-rules.mjs';
const KEY='blackline.controller.v1';
export function installControllerSettings(panel:HTMLElement){
 let value=controllerSettings();try{value=controllerSettings(JSON.parse(localStorage.getItem(KEY)||'{}'));}catch{}
 const guide=panel.querySelector<HTMLElement>('.controller-guide')!;
 guide.insertAdjacentHTML('beforeend','<label>Aiming speed<input id="pad-ads" type="range" min="0.2" max="0.8" step="0.05"></label><label>Flight look speed<input id="pad-flight" type="range" min="0.5" max="2" step="0.1"></label><label>Movement stick deadzone<input id="pad-move-deadzone" type="range" min="0.05" max="0.4" step="0.01"></label><label>Look stick deadzone<input id="pad-look-deadzone" type="range" min="0.05" max="0.4" step="0.01"></label><p class="controller-setting-tip">Raise a deadzone if your stick drifts. In menus: left stick / D-pad to move, A to select, B to return. Left / right adjusts settings.</p><button type="button" id="pad-reset" class="secondary">RESET CONTROLLER SETTINGS</button><p id="pad-settings-status" role="status" aria-live="polite"></p>');
 const fields={sensitivity:'pad-sensitivity',ads:'pad-ads',flight:'pad-flight',moveDeadzone:'pad-move-deadzone',lookDeadzone:'pad-look-deadzone',invert:'pad-invert'} as const;
 function sync(){for(const [key,id] of Object.entries(fields)){const input=panel.querySelector<HTMLInputElement>('#'+id)!;if(input.type==='checkbox')input.checked=value.invert;else{input.value=String(value[key as keyof typeof value]);input.setAttribute('aria-valuetext',input.value);const output=input.parentElement!.querySelector('output')||input.parentElement!.appendChild(document.createElement('output'));output.textContent=input.value;}}}
 function save(){try{localStorage.setItem(KEY,JSON.stringify(value));}catch{panel.querySelector('#pad-settings-status')!.textContent='Settings apply now; this browser could not save them.';}}
 for(const [key,id] of Object.entries(fields)){const input=panel.querySelector<HTMLInputElement>('#'+id)!;input.addEventListener('input',()=>{value=controllerSettings({...value,[key]:input.type==='checkbox'?input.checked:+input.value});sync();save();});}
 panel.querySelector('#pad-reset')!.addEventListener('click',()=>{value=controllerSettings();sync();save();});sync();
 return {get value(){return value;}};
}
