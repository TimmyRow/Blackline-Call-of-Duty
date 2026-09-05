export const MAGAZINE = 30;
export const RELOAD_SECONDS = 1.85;
export function reloadAmmo(ammo, reserve) { const loaded=Math.min(MAGAZINE-ammo,reserve);return {ammo:ammo+loaded,reserve:reserve-loaded}; }
export function bulletDamage(head, distance) { return head ? 110 : distance > 35 ? 28 : 38; }
export function canInteract(player, terminal, alive) { return alive === 0 && Math.hypot(player.x-terminal.x,player.z-terminal.z)<3; }
export function grenadeDamage(distance) { return Math.max(0, 150*(1-distance/7)); }
