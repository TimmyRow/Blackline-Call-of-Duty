import test from 'node:test';
import assert from 'node:assert/strict';
import {heightAt} from '../src/region-layout.mjs';
function collisionHeight(x,z){const gx=Math.floor(x/8)*8,gz=Math.floor(z/8)*8,u=(x-gx)/8,v=(z-gz)/8,a=heightAt(gx,gz),b=heightAt(gx+8,gz),c=heightAt(gx,gz+8),d=heightAt(gx+8,gz+8);return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);}
test('the actual eight-metre terrain triangles cannot rise through landing district floors',()=>{
 for(const [a,c,w,d]of [[-33,85,18,21],[32,83,17,21],[-34,125,18,19],[34,128,17,21]]){
  for(let x=a-w/2+.7;x<a+w/2-.7;x+=1.2)for(let z=c-d/2+.7;z<c+d/2-.7;z+=1.2)assert.ok(collisionHeight(x,z)<16.08,`Terrain breaches the floor at ${x}, ${z}`);
 }
});
