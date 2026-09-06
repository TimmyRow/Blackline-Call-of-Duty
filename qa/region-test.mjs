import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {REGION_SITES, REGION_START, REGION_ROADS, heightAt} from '../src/region-layout.mjs';

const browser = await chromium.launch({
  executablePath:process.env.CHROME_PATH || 'C:/Users/jcrow/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
  headless:true, args:['--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({viewport:{width:1600, height:900}, deviceScaleFactor:1});
const errors = [], results = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
const snapshot = () => page.evaluate(() => window.blacklineQA.snapshot());
const advance = async seconds => {
  const target = (await snapshot()).time + seconds;
  await page.waitForFunction(t => window.blacklineQA.snapshot().time >= t, target, {timeout:30000});
};
const release = async () => {
  for (const key of ['w', 'a', 's', 'd', 'Shift', 'Control', 'c', 'e', 'Space']) await page.keyboard.up(key);
  await page.mouse.up({button:'left'}); await page.mouse.up({button:'right'});
};
const reset = async () => {
  await release();
  await page.evaluate(() => {window.blacklineQA.start(); window.blacklineQA.clear(); window.blacklineQA.look(0, 0);});
  await advance(.2);
};
const test = async (name, run) => {
  if (process.env.REGION_TEST_MATCH && !name.includes(process.env.REGION_TEST_MATCH)) return;
  try {await reset(); results.push({name, pass:true, detail:await run()});}
  catch (error) {results.push({name, pass:false, error:error.message, snapshot:await snapshot()});}
  await release();
  console.log(JSON.stringify(results.at(-1)));
};
const expectedEffects = completed => ({
  detectionScale:completed.includes('relay') ? .58 : 1,
  fireDelayScale:completed.includes('depot') ? 1.8 : 1,
  patrolIntel:completed.includes('harbour'),
  signalStrength:Math.round((1 - completed.length / REGION_SITES.length) * 100),
});

try {
  await page.goto(process.env.GAME_URL || 'http://localhost:5180/');
  await page.waitForFunction(() => !!window.blacklineQA, null, {timeout:90000});

  await test('walk continuously from landing through the former arena boundary', async () => {
    const initial = await snapshot();
    assert.deepEqual(initial.campaign.completed, [], 'clearing enemies completed a mission');
    assert(Math.abs(initial.position[0] - REGION_START.x) < .1);
    assert(Math.abs(initial.position[2] - REGION_START.z) < .1);
    await page.screenshot({path:'qa/region-start.png'});
    const samples = [{time:initial.time, position:initial.position, region:initial.region}];
    await page.keyboard.down('Shift'); await page.keyboard.down('w');
    while ((await snapshot()).position[2] > 16) {
      await advance(.25);
      const s = await snapshot(), previous = samples.at(-1);
      assert.equal(s.mode, 'playing');
      const displacement = Math.hypot(s.position[0] - previous.position[0], s.position[2] - previous.position[2]);
      assert(displacement < 13 * (s.time - previous.time) + .3, `discontinuous position jump ${displacement}`);
      assert(s.time - initial.time < 35, `blocked before former boundary at ${s.position}`);
      samples.push({time:s.time, position:s.position, region:s.region});
    }
    await release();
    const final = await snapshot();
    assert(final.position[2] < 20.5, `former boundary stopped traversal at ${final.position[2]}`);
    assert(final.campaign.distanceWalked > 90, `distance counter=${final.campaign.distanceWalked}`);
    assert.deepEqual(final.campaign.completed, []);
    await page.screenshot({path:'qa/region-boundary-crossing.png'});
    await writeFile('qa/region-walk-samples.json', JSON.stringify(samples, null, 2));
    return {start:initial.position, finish:final.position, simulatedSeconds:final.time - initial.time, distanceWalked:final.campaign.distanceWalked, regions:[...new Set(samples.map(s => s.region))], samples:samples.length};
  });

  await test('field map tracks mission buttons and B changes two allies orders', async () => {
    let s = await snapshot();
    assert.equal(s.squad.members.length, 2);
    assert.equal(s.squad.order, 'follow');
    const initialAllies = s.squad.members.map(member => member.position);
    await page.keyboard.down('w'); await advance(3); await page.keyboard.up('w');
    const following = await snapshot();
    const followed = following.squad.members.map((member, i) => Math.hypot(member.position[0] - initialAllies[i][0], member.position[2] - initialAllies[i][2]));
    assert(followed.every(distance => distance > 2), `allies failed to follow moving player: ${followed}`);
    await page.keyboard.press('b'); await advance(.05);
    assert.equal((await snapshot()).squad.order, 'hold');
    const held = await snapshot();
    await page.keyboard.down('w'); await advance(2.5); await page.keyboard.up('w');
    const afterHold = await snapshot();
    assert(held.position[2] - afterHold.position[2] > 8, 'player did not move independently while squad held');
    const holdDrift = afterHold.squad.members.map((member, i) => Math.hypot(member.position[0] - held.squad.members[i].position[0], member.position[2] - held.squad.members[i].position[2]));
    assert(holdDrift.every(distance => distance < .2), `squad drifted while ordered to hold: ${holdDrift}`);
    await page.keyboard.press('b'); await advance(.05);
    assert.equal((await snapshot()).squad.order, 'follow');
    await advance(2);
    const rejoined = (await snapshot()).squad.members.map((member, i) => Math.hypot(member.position[0] - afterHold.squad.members[i].position[0], member.position[2] - afterHold.squad.members[i].position[2]));
    assert(rejoined.every(distance => distance > 3), `squad did not resume following: ${rejoined}`);
    for (const site of REGION_SITES) {
      await page.keyboard.press('Tab');
      const button = page.locator(`button[data-site="${site.id}"]`);
      if (await button.count()) await button.click();
      else await page.getByRole('button', {name:new RegExp(site.name, 'i')}).click();
      assert.equal((await snapshot()).campaign.tracked, site.id);
    }
    await page.keyboard.press('Tab');
    await page.screenshot({path:'qa/region-field-map.png'});
    await page.keyboard.press('Escape'); await advance(.1);
    assert.equal((await snapshot()).mode, 'playing');
    return {tracked:(await snapshot()).campaign.tracked, squadMembers:s.squad.members.length, followed, holdDrift, rejoined};
  });

  await test('real held interactions complete sites in arbitrary order, apply effects, and require return extraction', async () => {
    const completed = [], partials = {};
    for (const id of ['relay', 'depot', 'harbour']) {
      const site = REGION_SITES.find(site => site.id === id);
      await page.evaluate(({x, z}) => window.blacklineQA.teleport(x, z), site);
      await advance(.2);
      let s = await snapshot();
      assert(Math.abs(s.position[1] - (heightAt(site.x, site.z) + 1.7)) < .3, `${id} camera is not grounded: ${s.position}`);
      assert(s.campaign.discovered.includes(id));
      await page.screenshot({path:`qa/region-${id}.png`});
      await page.keyboard.down('e'); await advance(1); await page.keyboard.up('e');
      const partial = (await snapshot()).campaign.progress[id];
      assert(partial >= .9 && partial < 1.5, `${id} hold=${partial}`);
      await advance(.3);
      assert((await snapshot()).campaign.progress[id] < partial, `${id} interaction did not decay`);
      await page.keyboard.down('e');
      await page.waitForFunction(id => window.blacklineQA.snapshot().campaign.completed.includes(id), id, {timeout:30000});
      await page.keyboard.up('e');
      completed.push(id); partials[id] = partial;
      s = await snapshot();
      assert.deepEqual(s.campaign.completed, completed);
      assert.deepEqual(s.effects, expectedEffects(completed));
      assert.equal(s.mode, 'playing');
      assert.equal(s.campaign.extracted, false);
    }
    await page.evaluate(() => {window.blacklineQA.teleport(0, 75); window.blacklineQA.look(0, 0);});
    await advance(.1);
    const before = (await snapshot()).position;
    await page.keyboard.down('w'); await advance(.6); await page.keyboard.up('w');
    const after = (await snapshot()).position;
    assert(before[2] - after[2] > 1.8, `movement stopped after completing sites: ${before} to ${after}`);
    await page.keyboard.down('e'); await advance(.2); await page.keyboard.up('e');
    assert.equal((await snapshot()).campaign.extracted, false, 'extracted away from landing');
    await page.evaluate(({x, z}) => window.blacklineQA.teleport(x, z), REGION_START);
    await advance(.2); assert.equal((await snapshot()).mode, 'playing');
    await page.keyboard.down('e');
    await page.waitForFunction(() => window.blacklineQA.snapshot().mode === 'won', null, {timeout:10000});
    await page.keyboard.up('e');
    assert.equal((await snapshot()).campaign.extracted, true);
    await page.screenshot({path:'qa/region-extracted.png'});
    return {completed, partials, movementAfterCompletion:before[2] - after[2], mode:(await snapshot()).mode};
  });

  if (process.env.TEST_REGION_SLOPES === '1') await test('walk relay road slopes with continuous grounded movement', async () => {
    const road = REGION_ROADS[1], samples = [];
    await page.evaluate(([x,z]) => window.blacklineQA.teleport(x,z), road[0]);
    await advance(.2);
    for (const [x,z] of road.slice(1)) {
      const startTime = (await snapshot()).time;
      while (true) {
        const s = await snapshot(), dx = x - s.position[0], dz = z - s.position[2];
        if (Math.hypot(dx,dz) < 2) break;
        assert(s.time - startTime < 20, `stuck on relay road toward ${x},${z}, at ${s.position}`);
        await page.evaluate(yaw => window.blacklineQA.look(yaw,0), Math.atan2(-dx,-dz));
        await page.keyboard.down('Shift'); await page.keyboard.down('w'); await advance(.2);
        const moved = await snapshot();
        assert(Math.abs(moved.position[1] - heightAt(moved.position[0],moved.position[2]) - 1.7) < 1.4, `ungrounded on slope at ${moved.position}`);
        samples.push(moved.position);
      }
      await release();
    }
    await page.screenshot({path:'qa/region-relay-road.png'});
    return {samples:samples.length, finish:(await snapshot()).position};
  });

  let recorded = results;
  if (process.env.REGION_TEST_MATCH) {
    try {
      const previous = JSON.parse(await readFile('qa/region-results.json', 'utf8'));
      recorded = [...previous.results.filter(r => !results.some(current => current.name === r.name)), ...results];
    } catch {}
  }
  const report = {summary:{passed:recorded.filter(r => r.pass).length, failed:recorded.filter(r => !r.pass).length}, errors, results:recorded};
  await writeFile('qa/region-results.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (errors.length || results.some(r => !r.pass)) process.exitCode = 1;
} finally {await browser.close();}
