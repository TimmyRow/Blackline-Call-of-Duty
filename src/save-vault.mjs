import {SAVE_KEY,validateSave} from './progression.mjs';
const PREFIX='blackline.vault.v1.';
const allowed=id=>['slot1','slot2','slot3','checkpoint','previous'].includes(id);
export function readVault(storage,id){try{return allowed(id)?validateSave(JSON.parse(storage.getItem(PREFIX+id)||'null')):null;}catch{return null;}}
export function storeSlot(storage,id,save){try{const value=validateSave(save);if(!allowed(id)||!value)return false;storage.setItem(PREFIX+id,JSON.stringify(value));return true;}catch{return false;}}
export function checkpoint(storage,save){try{const value=validateSave(save);if(!value)return false;const last=readVault(storage,'checkpoint');if(last&&value.savedAt-last.savedAt<60000)return true;if(last&&!storeSlot(storage,'previous',last))return false;return storeSlot(storage,'checkpoint',value);}catch{return false;}}
export function vaultEntries(storage){return ['slot1','slot2','slot3','checkpoint','previous'].map((id,i)=>{const save=readVault(storage,id);return{id,name:i<3?'Save slot '+(i+1):i===3?'Recovery checkpoint':'Previous checkpoint',available:!!save,description:save?`${save.campaign.planet} · ${save.campaign.completed.length} secured · ${Math.floor(save.campaign.salvage)} salvage · ${new Date(save.savedAt).toLocaleString()}`:'Empty',manual:i<3};});}
export function promoteSave(storage,save){try{const value=validateSave(save);if(!value)return false;storage.setItem(SAVE_KEY,JSON.stringify(value));return true;}catch{return false;}}
