import test from 'node:test';
import assert from 'node:assert/strict';
import {climateAt,DAY_DURATION,WEATHER_DURATION} from '../src/climate.mjs';

test('saved expedition time reproduces climate and a complete day wraps',()=>{
 assert.deepEqual(climateAt(872),climateAt(872));
 assert.ok(Math.abs(climateAt(DAY_DURATION).hour-climateAt(0).hour)<1e-9);
 assert.equal(climateAt(0).weather,'clear');
 assert.equal(climateAt(0).daylight,1);
});
test('weather transitions are continuous and include clear skies and storms',()=>{
 const states=new Set();let previous=climateAt(0);
 for(let t=1;t<WEATHER_DURATION*10;t++){const next=climateAt(t);states.add(next.weather);assert.ok(Math.abs(next.rain-previous.rain)<.035);assert.ok(next.rain>=0&&next.rain<=1);previous=next;}
 assert.deepEqual([...states].sort(),['clear','rain','storm']);
});
test('climate QA overrides distinguish noon, night and weather without changing clock',()=>{
 assert.equal(climateAt(0,{hour:12,weather:'clear'}).daylight,1);
 assert.equal(climateAt(0,{hour:0,weather:'storm'}).daylight,0);
 assert.equal(climateAt(0,{hour:12,weather:'clear'}).rain,0);
 assert.equal(climateAt(0,{hour:0,weather:'storm'}).storm,1);
 assert.deepEqual(climateAt(NaN),climateAt(0));
});
