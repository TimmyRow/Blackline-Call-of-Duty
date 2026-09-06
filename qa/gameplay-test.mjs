import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Users/jcrow/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
  headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const errors = [], results = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const snapshot = () => page.evaluate(() => window.blacklineQA.snapshot());
const advance = async seconds => {
  const target = (await snapshot()).time + seconds;
  await page.waitForFunction(t => window.blacklineQA.snapshot().time >= t, target, { timeout: 15000 });
};
const reset = async () => {
  for (const key of ['w', 'a', 's', 'd', 'Shift', 'Control', 'c', 'e', 'Space']) await page.keyboard.up(key);
  await page.mouse.up({ button: 'left' }); await page.mouse.up({ button: 'right' });
  await page.evaluate(() => window.blacklineQA.start()); await advance(.15);
};
const test = async (name, run) => {
  try { await reset(); const detail = await run(); results.push({ name, pass: true, detail }); }
  catch (error) { results.push({ name, pass: false, error: error.message, snapshot: await snapshot() }); }
  console.log(JSON.stringify(results.at(-1)));
};
try {
  await page.goto(process.env.GAME_URL || 'http://localhost:5180/');
  await page.waitForFunction(() => !!window.blacklineQA, null, { timeout: 90000 });
  await test('spatial visibility respects solid cover and terrain', async () => {
    const checks=await page.evaluate(()=>({cover:window.blacklineQA.blocked([-5.8,1,4],[-5.8,1,-2]),above:window.blacklineQA.blocked([-5.8,10,4],[-5.8,10,-2]),terrain:window.blacklineQA.blocked([0,8,110],[0,-2,110])}));
    assert.equal(checks.cover,true);assert.equal(checks.above,false);assert.equal(checks.terrain,true);return checks;
  });
  await test('real WASD movement and sprint speed', async () => {
    const initial = await snapshot(); await page.keyboard.down('w'); await advance(.5); await page.keyboard.up('w');
    const walked = await snapshot(); const walk = initial.position[2] - walked.position[2];
    assert(walk > 1.7 && walk < 3.1, `walk distance ${walk}`);
    await page.keyboard.down('Shift'); await page.keyboard.down('w'); await advance(.5); await page.keyboard.up('w'); await page.keyboard.up('Shift');
    const sprint = walked.position[2] - (await snapshot()).position[2]; assert(sprint > walk * 1.2, `walk=${walk}, sprint=${sprint}`);
    return { walk, sprint };
  });
  await test('physical harbour cover blocks movement', async () => {
    await page.evaluate(() => {window.blacklineQA.teleport(-5.8, 4); window.blacklineQA.look(0,0);});
    await page.keyboard.down('w'); await advance(1); await page.keyboard.up('w');
    const position = (await snapshot()).position; assert(position[2] > 1.8 && position[2] < 2.15, `cover z=${position[2]}`); return { position };
  });
  await test('real reload conserves ammo, partial reserve works', async () => {
    await page.evaluate(() => window.blacklineQA.setAmmo(8, 40)); await page.keyboard.press('r'); await advance(2.05);
    let s = await snapshot(); assert.equal(s.ammo, 30); assert.equal(s.reserve, 18);
    await page.evaluate(() => window.blacklineQA.setAmmo(4, 6)); await page.keyboard.press('r'); await advance(2.05);
    s = await snapshot(); assert.equal(s.ammo, 10); assert.equal(s.reserve, 0); return { ammo: s.ammo, reserve: s.reserve };
  });
  await test('jump and crouch change actual camera height', async () => {
    const standing = (await snapshot()).position[1]; await page.keyboard.press('Space');
    await page.waitForFunction(y => window.blacklineQA.snapshot().position[1] > y + .25, standing, { timeout: 5000 });
    const jumpHeight = (await snapshot()).position[1]; await advance(.9); await page.keyboard.down('c'); await advance(.3);
    const crouching = (await snapshot()).position[1]; assert(crouching < standing - .35, `standing=${standing}, crouching=${crouching}`);
    assert.equal(await page.locator('#stance').textContent(), 'CROUCHED'); await page.keyboard.up('c'); await advance(.3);
    assert((await snapshot()).position[1] > standing - .15); return { standing, jumpHeight, crouching };
  });
  await test('right mouse aim and representative ADS screenshot', async () => {
    await page.mouse.move(800, 450); await page.mouse.down({ button: 'right' }); await advance(.65);
    assert(await page.locator('#crosshair').evaluate(e => e.classList.contains('aiming')));
    await page.screenshot({ path: 'qa/aim.png' }); await page.mouse.up({ button: 'right' }); await advance(.1);
    assert.equal(await page.locator('#crosshair').evaluate(e => e.classList.contains('aiming')), false); return { screenshot: 'qa/aim.png' };
  });
  await test('grenade real key decrements once', async () => {
    await page.keyboard.press('g'); await advance(.1); assert.equal((await snapshot()).grenades, 2); return { grenades: 2 };
  });
  await test('center raycast headshot kills a healthy target', async () => {
    const index = 2; const enemy = (await snapshot()).enemyPositions[index].position;
    await page.evaluate(([x, , z]) => window.blacklineQA.teleport(x, z + 4), enemy); await advance(.15);
    await page.mouse.move(800, 450); await page.mouse.down({ button: 'right' }); await advance(.2);
    const s = await snapshot(), e = s.enemyPositions[index].position;
    const dx = e[0] - s.position[0], dz = e[2] - s.position[2], dy = e[1] + 1.62 - s.position[1];
    await page.evaluate(([yaw, pitch]) => window.blacklineQA.look(yaw, pitch), [Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))]);
    await advance(.06); await page.mouse.down();
    await page.waitForFunction(() => window.blacklineQA.snapshot().ammo < 30, null, { timeout: 4000 });
    await page.mouse.up(); await page.mouse.up({ button: 'right' });
    const after = await snapshot(); assert(after.enemyPositions[index].health <= 0, `target health=${after.enemyPositions[index].health}; fired=${30-after.ammo}`);
    assert.equal(after.kills, 1); assert.equal(after.enemyPositions[index].health, -10); assert(after.ammo <= 29 && after.ammo >= 27, `unexpected automatic burst ammo=${after.ammo}`); return { targetHealth: after.enemyPositions[index].health, ammo: after.ammo };
  });
  await test('pause freezes simulation and resume clears held input', async () => {
    await page.keyboard.down('w'); await advance(.15); await page.keyboard.press('p');
    const paused = await snapshot(); assert.equal(paused.mode, 'paused'); await page.waitForTimeout(400);
    const still = await snapshot(); assert.equal(still.time, paused.time); assert.deepEqual(still.position, paused.position);
    await page.keyboard.up('w'); await page.locator('#deploy').click();
    await page.waitForFunction(() => window.blacklineQA.snapshot().mode === 'playing'); await advance(.25);
    const resumed = await snapshot(); assert(Math.abs(resumed.position[2] - paused.position[2]) < .05, 'held movement survived pause');
    return { pausedTime: paused.time, resumedTime: resumed.time };
  });
  await test('death and redeploy reset the mission', async () => {
    await page.evaluate(() => window.blacklineQA.damage(100)); assert.equal((await snapshot()).mode, 'dead');
    assert.equal(await page.locator('#title').textContent(), 'SIGNAL LOST');
    await page.locator('#deploy').click(); await page.waitForFunction(() => window.blacklineQA.snapshot().mode === 'playing');
    const s = await snapshot(); assert.equal(s.health, 100); assert.equal(s.ammo, 30); assert.equal(s.kills, 0); assert.equal(s.stage, 0);
    return { health: s.health, stage: s.stage };
  });
  await test('downed squadmate revives with real held E', async () => {
    const ally=(await snapshot()).squad.members[0].position;
    await page.evaluate(([x,,z])=>{window.blacklineQA.hurtAlly(0,100);window.blacklineQA.teleport(x,z+2);},ally);
    assert.equal((await snapshot()).squad.members[0].down,true);
    await page.keyboard.down('e');await advance(3.2);await page.keyboard.up('e');
    const member=(await snapshot()).squad.members[0];assert.equal(member.down,false);assert(member.health>=70);return member;
  });
  console.log(JSON.stringify({ summary: { passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length }, errors, results }));
  if (errors.length || results.some(r => !r.pass)) process.exitCode = 1;
} finally { await browser.close(); }
