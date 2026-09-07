export function touchDevice(nav= navigator,media=matchMedia){return media('(pointer: coarse)').matches||/iPhone|iPad|iPod/.test(nav.userAgent)||(nav.platform==='MacIntel'&&nav.maxTouchPoints>1);}
export function stickVector(dx,dy,radius=48){const length=Math.hypot(dx,dy);if(length<radius*.16)return {x:0,z:0};const magnitude=Math.min(1,(length/radius-.16)/.84);return {x:dx/length*magnitude,z:dy/length*magnitude};}
export function renderRatio(touch,width,height,dpr=1,scale=1){return Math.min(dpr,touch?Math.min(1,Math.sqrt(950000/Math.max(1,width*height))):1.5)*scale;}
