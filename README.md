# BLACKLINE — Ash Coast

A Three.js FPS prototype set in a frontier war on a connected coastal colony. Walk from your dropship to Cold Harbour, Northwatch Relay and Tidebreak Battery through continuous terrain. Complete objectives in any order, then return to the landing to extract. Vale and Rook follow and fight alongside you; order them to hold while you approach a camp alone.

This is an original playable prototype, below Call of Duty / AAA production quality. Ships establish the science-fiction setting but are not pilotable. Visual comparisons and current limitations are documented in `qa/REVIEW.md`.

## Run

```sh
npm install
npm run dev -- --port 5180
```

Open the printed URL in a desktop WebGL 2 browser. Click **Land on Ash Coast** to capture the mouse. When pointer capture is unavailable, hold the left mouse button to look and fire.

| Input | Action |
| --- | --- |
| WASD | Move |
| Mouse / left click / right click | Look / fire / aim |
| Shift / Space / C or Ctrl | Sprint / jump / crouch |
| R / G | Reload / grenade |
| Hold E | Complete nearby objective or revive squadmate |
| E at landing after all objectives | Extract |
| B | Squad hold / follow |
| Tab | Field map; select a waypoint |
| Esc or P / M | Pause / mute |

The map tracks destinations without teleporting. Recovering the harbour manifest reveals patrol positions; disabling the relay reduces detection range; cutting battery fire control slows enemy fire coordination. Objectives do not require every enemy to be killed. Holding positions allows solo approaches, but this is not a full stealth simulation.

Health regenerates out of combat. Cover blocks enemy sight and bullets. Grenades bounce using Rapier physics. Downed comrades can be revived. The pause menu offers sensitivity and quality controls.

## Implementation

- TypeScript, Vite, imperative Three.js and Rapier character controllers.
- A 460-metre terrain mesh and matching physics surface, six connected roads, three objective sites, twelve opponents and two allies.
- Procedural geometry/materials, instanced scenery, merged actors, directional shadows, ocean, rain and postprocessing. No imported Call of Duty assets.
- Two capital ships, animated escort ships and a landed dropship as scenery.
- Synthesized audio; DOM HUD, map and menus; focus-loss pause.
- Optional Google Fonts with system fallbacks.
- Read-only diagnostics: `window.blackline.snapshot()`. Development-only `window.blacklineQA` arranges automated test scenarios and is excluded from production.

## Verify

```sh
npm test
npm run build
node qa/gameplay-test.mjs
node qa/region-test.mjs
node qa/capture.mjs
node qa/performance.mjs
```

Browser scripts require a running dev server and Chromium. Set `CHROME_PATH` when necessary. Set `TEST_REGION_SLOPES=1` for the extended physical relay-road walk. Tests use actual keyboard/mouse interaction and development hooks to arrange scenarios; they are not a complete unaided playthrough. Evidence is in `qa/REGION-REVIEW.md` and `qa/region-results.json`.

Production output is `dist/`; hosting metadata belongs to this isolated project.

## Scope limits

One small connected region, one rifle and basic AI. No multiplayer, persistent campaign saves, flyable ships, space travel, large-scale battle simulation, authored skeletal animations, destructible buildings, photogrammetry, production sound or mobile touch controls. Squad navigation uses local obstacle avoidance rather than a full navigation mesh. Performance has only been sampled locally, not certified across devices or long sessions. The terrain and scenery remain visibly procedural.
