import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaign, nearestSite, trackedSite, advanceCampaign, regionalEffects} from '../src/campaign.mjs';
import {REGION_START, REGION_SITES, REGION_ROADS, ENEMY_SPAWNS, heightAt, regionName} from '../src/region-layout.mjs';

const at = site => ({x:site.x, y:site.elevation + 1.7, z:site.z});
const complete = (campaign, site) => advanceCampaign(campaign, at(site), true, site.holdSeconds);
const permutations = values => values.length ? values.flatMap((value, i) => permutations(values.filter((_, j) => i !== j)).map(rest => [value, ...rest])) : [[]];

test('all six mission orders work without kill counts or prior-site gates', () => {
  for (const order of permutations(REGION_SITES)) {
    const campaign = createCampaign();
    for (const site of order) {
      assert.equal(complete(campaign, site), site.id);
      assert.equal(campaign.extracted, false);
    }
    assert.deepEqual(campaign.completed, order.map(site => site.id));
  }
});

test('being present or discovering a site never completes its mission', () => {
  const campaign = createCampaign();
  for (const site of REGION_SITES) advanceCampaign(campaign, at(site), false, 100);
  assert.deepEqual(campaign.completed, []);
  assert.deepEqual(campaign.discovered, REGION_SITES.map(site => site.id));
  for (const site of REGION_SITES) advanceCampaign(campaign, at(site), false, 100);
  assert.equal(campaign.discovered.length, REGION_SITES.length);
});

test('interruption decays held interaction and moving away cannot finish it', () => {
  const campaign = createCampaign(), site = REGION_SITES[1];
  advanceCampaign(campaign, at(site), true, 2);
  advanceCampaign(campaign, at(site), false, 1);
  assert.equal(campaign.progress[site.id], 1.3);
  advanceCampaign(campaign, {...at(site), x:site.x + 4}, true, 1);
  assert(Math.abs(campaign.progress[site.id] - .6) < 1e-10);
  advanceCampaign(campaign, at(site), false, 100);
  assert.equal(campaign.progress[site.id], 0);
  assert.deepEqual(campaign.completed, []);
  assert.equal(complete(campaign, site), site.id);
});

test('terminal interaction requires horizontal and vertical proximity', () => {
  const campaign = createCampaign(), site = REGION_SITES[1];
  advanceCampaign(campaign, {...at(site), x:site.x + 3}, true, 10);
  advanceCampaign(campaign, {...at(site), y:site.elevation + 5}, true, 10);
  assert.deepEqual(campaign.completed, []);
  assert.equal(complete(campaign, site), site.id);
  assert.equal(advanceCampaign(campaign, at(site), true, 10), null);
  assert.deepEqual(campaign.completed, [site.id]);
});

test('each mission grants only its advertised regional effect', () => {
  const expected = {
    harbour:{detectionScale:1, fireDelayScale:1, patrolIntel:true, signalStrength:67},
    relay:{detectionScale:.58, fireDelayScale:1, patrolIntel:false, signalStrength:67},
    depot:{detectionScale:1, fireDelayScale:1.8, patrolIntel:false, signalStrength:67},
  };
  assert.deepEqual(regionalEffects(createCampaign()), {detectionScale:1, fireDelayScale:1, patrolIntel:false, signalStrength:100});
  for (const site of REGION_SITES) {
    const campaign = createCampaign(); complete(campaign, site);
    assert.deepEqual(regionalEffects(campaign), expected[site.id]);
  }
  const campaign = createCampaign(); REGION_SITES.forEach(site => complete(campaign, site));
  assert.deepEqual(regionalEffects(campaign), {detectionScale:.58, fireDelayScale:1.8, patrolIntel:true, signalStrength:0});
});

test('extraction requires every site, an explicit interaction, and landing proximity', () => {
  const campaign = createCampaign(), landing = {...REGION_START, y:heightAt(REGION_START.x, REGION_START.z) + 1.7};
  advanceCampaign(campaign, landing, true, 10);
  assert.equal(campaign.extracted, false);
  REGION_SITES.slice(0, 2).forEach(site => complete(campaign, site));
  advanceCampaign(campaign, landing, true, 10);
  assert.equal(campaign.extracted, false);
  complete(campaign, REGION_SITES[2]);
  advanceCampaign(campaign, {...landing, x:landing.x + 5}, true, 10);
  assert.equal(campaign.extracted, false);
  advanceCampaign(campaign, landing, false, 10);
  assert.equal(campaign.extracted, false);
  advanceCampaign(campaign, landing, true, .1);
  assert.equal(campaign.extracted, true);
});

test('tracked target overrides nearest and falls back after completion or invalid tracking', () => {
  const campaign = createCampaign(), relay = REGION_SITES[1], depot = REGION_SITES[2];
  assert.equal(nearestSite(at(relay), campaign).id, relay.id);
  assert.equal(trackedSite(at(relay), campaign).id, 'harbour');
  campaign.tracked = depot.id;
  assert.equal(trackedSite(at(relay), campaign).id, depot.id);
  complete(campaign, depot);
  assert.equal(trackedSite(at(relay), campaign).id, relay.id);
  campaign.tracked = 'unknown';
  assert.equal(trackedSite(at(relay), campaign).id, relay.id);
  REGION_SITES.filter(site => site.id !== depot.id).forEach(site => complete(campaign, site));
  assert.equal(nearestSite(at(relay), campaign), null);
  assert.equal(trackedSite(at(relay), campaign), null);
});

test('terrain is finite throughout the region and all traversable road samples', () => {
  for (let x = -205; x <= 205; x += 5) for (let z = -205; z <= 205; z += 5) {
    assert(Number.isFinite(heightAt(x, z)), `invalid terrain at ${x},${z}`);
    assert.equal(typeof regionName(x, z), 'string');
  }
  for (const road of REGION_ROADS) for (let i = 1; i < road.length; i++) {
    const [a, b] = [road[i - 1], road[i]];
    for (let t = 0; t <= 1; t += .02) assert(Number.isFinite(heightAt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)));
  }
  for (const spawn of ENEMY_SPAWNS) assert(Number.isFinite(heightAt(spawn.x, spawn.z)));
});

test('mission terminal elevations and landing spawn match walkable terrain', () => {
  for (const site of REGION_SITES) {
    assert(Math.abs(heightAt(site.x, site.z) - site.elevation) < .001, `${site.name} terminal floats or clips`);
    assert.equal(regionName(site.x, site.z), site.name);
  }
  assert.equal(heightAt(REGION_START.x, REGION_START.z), 2);
  assert.equal(regionName(REGION_START.x, REGION_START.z), 'South Landing');
});
