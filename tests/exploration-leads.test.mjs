import test from 'node:test';
import assert from 'node:assert/strict';
import {DISCOVERIES,EXPLORATION_LINKS,claimDiscovery,explorationLeads} from '../src/frontier-discoveries.mjs';

test('leads require the recovered source and disappear after recovering their destination',()=>{
 const c={salvage:0,blueprints:[],clues:[]};
 assert.deepEqual(explorationLeads(c),[]);
 claimDiscovery(c,'clue:roadside-repair');
 assert.deepEqual(explorationLeads(c).map(l=>l.target.id),['clue:relay-feed']);
 claimDiscovery(c,'clue:relay-feed');
 assert.deepEqual(explorationLeads(c).map(l=>l.target.id),['clue:survey-wreck']);
 claimDiscovery(c,'clue:survey-wreck');
 assert.deepEqual(explorationLeads(c),[]);
 assert.deepEqual(c.blueprints,['handling']);
 assert.equal(c.salvage,95);
 assert.equal(claimDiscovery(c,'clue:survey-wreck'),null);
 assert.equal(c.salvage,95);
});

test('existing saves derive leads without changing accepted missions or awarding anything',()=>{
 assert.deepEqual(explorationLeads({}),[]);
 const c={clues:['clue:evacuation-stop','clue:coast-lookout'],activeMission:'main',tracked:'mara',salvage:15,contracts:{}};
 const before=JSON.stringify(c),leads=explorationLeads(JSON.parse(before));
 assert.deepEqual(leads.map(l=>l.target.id),['clue:basalt-gate','clue:wayfarer-buoy']);
 assert.equal(JSON.stringify(c),before);
 assert.equal(leads[1].target.ocean,true);
 assert.equal(leads[1].target.elevation,1);
});

test('every authored trail resolves to a reachable discovery and never loops',()=>{
 const ids=new Set(DISCOVERIES.map(d=>d.id));
 for(const link of EXPLORATION_LINKS){
  assert(ids.has(link.from)&&ids.has(link.to));
  const seen=new Set([link.from]);let next=link.to;
  while(next){assert(!seen.has(next));seen.add(next);next=EXPLORATION_LINKS.find(l=>l.from===next)?.to;}
 }
 const leads=explorationLeads({clues:EXPLORATION_LINKS.map(l=>l.from)});
 for(const {target} of leads)assert([target.x,target.z,target.elevation].every(Number.isFinite));
});
