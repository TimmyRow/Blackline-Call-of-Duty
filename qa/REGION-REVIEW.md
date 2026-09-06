# Ash Coast regional campaign QA

Validated September 6, 2026 in headless Chromium at 1600 × 900 against the local development server. No runtime or browser-console errors were observed. All four browser scenarios pass; details are in `region-results.json`.

- Continuous traversal: real Shift + W movement from South Landing `(0,110)` to approximately `(0,13)` covered 96.91 metres across the former arena boundary at `z=20.5`. The campaign stayed active without a portal, load transition, or automatic mission completion. Position samples are saved in `region-walk-samples.json`.
- Terrain traversal: walked every relay-road segment from `(0,75)` through `(-35,55)`, `(-68,17)`, and `(-98,-32)` to `(-110,-100)`. All 64 samples stayed grounded, reaching the 11-metre relay plateau.
- Missions and extraction: real held E interactions completed relay, battery, then harbour. Releasing E decayed partial progress. Each completion applied its exact regional effect. The player remained mobile after all three missions and could only extract by interacting back at South Landing.
- Squad and map: two allies followed the player by 4.68 and 4.70 metres, stayed fixed while the player moved independently with HOLD active, then resumed following by over 10.8 metres. Each real map mission button updated tracking; Escape returned to gameplay.

The traversal setup clears guards through the development QA helper. It does not complete objectives. Teleport is used only to set up individual objective/extraction checks and the initial relay-road location; movement across the former boundary and all relay-road segments uses real keyboard movement.

Screenshots inspected: `region-start.png`, `region-boundary-crossing.png`, `region-field-map.png`, `region-relay.png`, `region-depot.png`, `region-harbour.png`, `region-relay-road.png`, and `region-extracted.png`. The landing establishes the connected region and spacecraft overhead, mission areas remain visually distinct, and the map/HUD remain legible at the tested viewport. These screenshots are functional QA evidence and are not a performance benchmark.

The map closes when a bearing is selected. The initial test assumed it stayed open; the test was corrected to reopen the map for each selection, then passed. No runtime modification was needed.

Run the complete regional browser suite with `TEST_REGION_SLOPES=1` and `node qa/region-test.mjs`. Set `CHROME_PATH` or `GAME_URL` to override browser executable or development URL. `REGION_TEST_MATCH` reruns a named scenario and merges its result into the local report.

## Combat regression pass

The final connected-region build passed 12 node tests and all 11 combat/input browser scenarios with zero page or console errors. Results are saved in `combat-results.json`. Coverage includes movement/sprint, collision with actual harbour cover, ammunition conservation, jump/crouch, aiming, grenade consumption, a lethal 110-damage headshot, pause/resume, redeployment, and reviving a downed squadmate. The headshot test permits a short automatic burst because browser input-release latency can fire a subsequent round; it independently checks the target lost exactly 110 health.

## Expanded-region performance

Final short sample: headless Chromium/ANGLE on Intel UHD Graphics, 1440×900, 100 frames per preset, actual forward movement and automatic fire at the harbour. High averaged 41.3 FPS (median 21.1 ms, p95 41.6 ms); Performance averaged 49.8 FPS (median 16.4 ms, p95 45.6 ms). Raw output: `region-performance-fixed.log`. These short local samples do not establish cross-device or long-session performance, and the preset runs follow slightly different combat positions/timings.

The first run averaged only 6.3/5.6 FPS because enemy/squad visibility repeatedly scanned the full rendered terrain. Visibility now uses Rapier's spatial ray query against fixed physical cover, including terrain. The final build adds explicit visibility assertions for low cover, a clear ray above cover, and ground interception. Rendered mesh intersections remain in player firing for precise hit locations. The earlier RTX 4070 numbers in `REVIEW.md` belong to the old smaller arena and are not comparable to this region or GPU.
