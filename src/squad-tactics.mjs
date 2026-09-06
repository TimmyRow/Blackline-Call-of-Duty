/** Support is deliberately weaker than the player: companions never sweep distant camps. */
export function canSupport({memberDistance,playerDistance,focused=false,holding=false}) {
 return memberDistance <= (focused ? 72 : holding ? 23 : 34) && playerDistance <= (focused ? 85 : 28);
}
export function supportShot(memberIndex,shotNumber,focused=false) {
 const hit = (shotNumber * 7 + memberIndex * 3) % 10 < (focused ? 7 : 4);
 return {damage:hit ? (memberIndex ? 16 : 10) : 0, cooldown:(memberIndex ? 3.7 : 2.65) * (focused ? .74 : 1),hit};
}
export function mayBuddyRevive(distance,threatDistance,holding=false) {
 return !holding && distance < 8 && threatDistance > 32;
}
