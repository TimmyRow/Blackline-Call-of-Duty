# BLACKLINE — Orison: The Open Frontier

A Three.js first-person expedition across a procedurally streamed planet landscape. Travel on foot or pilot the Kestrel dropship, raid pirate settlements, recover relics, board ocean vessels, and land at an elevated station. Vale and Rook fight, focus targets, provide ammunition and travel aboard your ship.

This is a playable procedural prototype, below AAA production quality. Its new geography continues beyond the starting area, but it is not a spherical planet, a complete universe simulator, or a No Man's Sky equivalent. Space travel uses continuous altitude in the same world; the station is at 1,800 metres.

## Play locally

```sh
npm install
npm run dev -- --port 5180
```

Desktop WebGL 2, keyboard and mouse required. Click **Begin Expedition**. Use a normal browser tab for mouse capture; when capture is unavailable, hold left mouse to look and fire.

| Controls | On foot | In Kestrel |
| --- | --- | --- |
| WASD | Move | Forward/reverse/strafe thrust |
| Mouse | Look | Heading / cannon aim |
| Left mouse | Rifle | Rechargeable pulse cannons |
| Right mouse | Aim | Zoom |
| Shift | Sprint | Boost |
| Space | Jump | Ascend / take off |
| C / Ctrl | Crouch | Descend |
| F | Board from beside Kestrel | Exit after landing safely |
| E (hold) | Loot, resupply or revive | — |
| Q | Order squad to focus a hostile | — |
| B | Squad hold / follow | — |
| J | Request ammunition from nearby squad | — |
| R / G | Reload / grenade | — |
| Tab | Planet atlas | Planet atlas |
| Esc / P / M | Pause / mute | Pause / mute |

Kestrel starts to your right. Walk beside it and press F, then Space to lift off. Cruise at 140 m/s or boost to 420 m/s; use Ctrl to descend. Release thrust to slow before landing. The ship checks its full swept hull against physical buildings and terrain, and refuses airborne or open-ocean disembarkation. Oceans can be crossed in flight; landing is supported on marked carrier and station pads.

## Adventure

- Deterministic terrain and discoveries extend beyond the starter peninsula. Only 49 terrain chunks remain active around the player; distant physics and geometry are released. There are 64 discoverable sites within 4.5 km of the start, with more generated farther away.
- Settlements have buildings, physical cover, guards and supplies. Local hostile encounters stream into a pool of up to 48 infantry; each camp has 6 guards and the pirate vessel 8.
- Clear pirates and hold E near the central supply locker to claim cargo. Ruins provide salvage. Captured pirate locations become resupply bases. Discoveries and captures remain recorded during the current expedition; there is no mandatory three-point route or extraction finale.
- CNS Wayfarer is a friendly ocean carrier where the squad can regroup and resupply. The Corsair vessel is a hostile boarding target. The orbital station offers a walkable deck reached by actual flight.
- Pirate interceptors appear during high-altitude flight. Aim Kestrel's cannons to destroy them and recover salvage.
- Vale fires assault bursts; Rook provides precision fire. Q designates a target, J supplies ammunition with a cooldown, and hold E revives a downed comrade. Squad activity and kills appear in the HUD. Both squadmates travel aboard Kestrel and disembark onto the local surface.
- The atlas samples actual terrain and coastline. Drag to pan, wheel or buttons to zoom, and choose any listed site to set a bearing. It never teleports the player.

## Verification

```sh
npm test
npm run build
node qa/adventure-flight-test.mjs
node qa/adventure-ground-test.mjs
node qa/adventure-performance.mjs
```

Browser scripts require the dev server and Chromium; set CHROME_PATH as needed. Read current evidence in `qa/ADVENTURE-REVIEW.md`. Earlier harbour/region QA reports and scripts document superseded builds and are historical.

## Technical and scope notes

TypeScript/Vite/Three.js with Rapier collision, terrain streaming, character controllers and vehicle sweeps. Assets and audio are procedural and contain no Call of Duty or No Man's Sky assets. Read-only runtime diagnostics are at `window.blackline.snapshot()`; development-only scenario helpers are excluded from production. Output is `dist/` with the existing private Sites configuration.

Ocean vessels and the station are stationary structures: you can land and board them, but cannot pilot the boats. There are no interplanetary jumps, multiplayer, durable campaign saves, authored cinematic missions, complex navigation meshes, destructible buildings or production character animation. Restarting an expedition resets its discoveries and captures. Float precision and memory limits still apply at extreme travel distances; long-session and cross-device performance are not certified.
