/** Support is deliberately weaker than the player: companions never sweep distant camps. */
export function canSupport({memberDistance,playerDistance,focused=false,holding=false}) {
 return focused && memberDistance <= 72 && playerDistance <= 85;
}
export function supportShot(memberIndex,shotNumber,focused=false) {
 const hit = (shotNumber * 7 + memberIndex * 3) % 10 < (focused ? 7 : 4);
 return {damage:hit ? (memberIndex ? 16 : 10) : 0, cooldown:(memberIndex ? 3.7 : 2.65) * (focused ? .74 : 1),hit};
}
export function mayBuddyRevive(distance,threatDistance,holding=false,requested=false) {
 return requested && !holding && distance < 8 && threatDistance > 32;
}
export function medicAid({health,distance,cooldown=0,available=true,level=0}){return available&&cooldown<=0&&distance<=12?Math.min(Math.max(0,100-health),35+Math.min(3,Math.max(0,level))*10):0;}
