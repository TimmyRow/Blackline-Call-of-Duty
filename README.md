# BLACKLINE — Orison: The Open Frontier

A Three.js first-person expedition across a procedurally streamed planet landscape. Travel on foot, pilot the Kestrel dropship or captain the Wayfarer launch. Raid pirate settlements, investigate frontier signals, recover relics and land at an elevated station. Vale and Rook provide restrained support while you lead the fighting.

This is a playable procedural prototype, below AAA production quality. Its new geography continues beyond the starting area, but it is not a spherical planet, a complete universe simulator, or a No Man's Sky equivalent. Space travel uses continuous altitude in the same world; the station is at 1,800 metres.

## Play locally

```sh
npm install
npm run dev -- --port 5180
```

WebGL 2 with hardware acceleration is required. Desktop uses keyboard and mouse; iPhone and iPad receive touch controls automatically. Start a **New Expedition** to play Crashfall: a short, skippable transport descent and crash, followed by recovering a power cell and restoring Kestrel. Existing saves continue without replaying the opening. On desktop, use a normal browser tab for mouse capture; when capture is unavailable, hold left mouse to look and fire.

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
| H | Locate your live ship beacon | Locate ship beacon |
| I | Journal, contracts, refits and saving | Journal, contracts, refits and saving |
| Esc / P / M | Pause / mute | Pause / mute |

Kestrel has a permanent live compass beacon, a pinned atlas entry and an H tracking shortcut. The first recovery quest guides new players from the crash site to its hull. Walk beside it and press F, then Space to lift off. Base cruise speed is 140 m/s, or 420 m/s with boost; refits increase performance. Use Ctrl to descend and release thrust to slow before landing. The ship checks its swept hull against physical buildings and terrain, and refuses airborne or open-ocean disembarkation. Land on marked carrier and station pads to explore on foot.

At CNS Wayfarer, approach the launch dock and press F to take the helm. W/S controls throttle, A/D steers, and Shift increases speed. Release throttle and slow before pressing F to leave the helm onto the launch deck. The squad travels aboard with you. Watch for the armed Corsair coastal patrol.

**Auto** visual quality is the default: sustained low frame rates reduce rendering resolution. Choose **Performance** in settings to reduce resolution and disable shadows and bloom, or **High** to retain those effects. Performance depends on hardware and travel conditions.

## iPhone and iPad

Open the game in Safari. Landscape provides more room, while portrait is supported. Move with the left stick and swipe the right side to look. Hold FIRE and drag that button to aim while shooting; AIM, RUN and CROUCH toggle. Firing stops a foot sprint. Hold USE for quest interactions and revives. BOARD / EXIT enters vehicles; RISE / DESCEND controls the dropship. MAP, JOURNAL and MORE provide ship tracking, squad orders, supplies, grenades and pause access without a keyboard.

Mobile Auto quality starts with shadows and bloom off, caps Retina render resolution and limits large-tablet pixel allocation. High quality remains optional. Controls clear on interrupted touches, backgrounding, menus and rotation. Saves remain local to each browser/device.

Phone/tablet layouts and multi-touch are tested in Chromium emulation, with WebGL rendering and touch-menu checks in Playwright WebKit. Physical iPhone/iPad performance, Safari chrome and thermal behavior are not certified by desktop emulation. Use an up-to-date Safari with WebGL 2 enabled.

## Adventure

- Deterministic terrain and discoveries extend beyond the starter peninsula. Only 49 terrain chunks remain active around the player; distant physics and geometry are released. There are 64 discoverable sites within 4.5 km of the start, with more generated farther away.
- The original rainy industrial direction is restored around compact warehouse districts: weathered corrugated containers, subdivided lit windows, catwalks, roof machinery, loading clutter, cranes and cyan/amber streetlights. Pathfinder Landing now starts inside a developed logistics district.
- Five winding roads (about 2.7 km) connect the authored starter districts with directional signs, lane markings, drains and utility furniture. Road geometry follows the actual terrain triangles; the wider procedural planet remains open.
- Settlements have furnished workshop and living spaces, solid interior floors, physical cover, guards and supplies. Industrial districts retain their roads and signs; farther out, ridgelines, a tidal river, a basalt shelter and wreck landmarks provide destinations beyond camps.
- A 40-minute day/night cycle starts in clear morning light. Weather changes on a 2.5-minute schedule with mostly dry conditions and occasional showers or storms. Clear weather, rain and storms change the sky, visibility, wind and wet surfaces; the HUD reports local time and conditions.
- Frontier signals include wrecks, caches, stranded friendlies and hostile encounters. Friendly scouts can exchange fire with nearby pirates. Local infantry use a bounded pool of up to 48 actors; these encounters are not a persistent planet-wide war simulation.
- Clear pirates and hold E near the central supply locker to claim cargo. Ruins and discoveries provide salvage. Captured pirate locations become resupply bases. There is no mandatory three-point route or extraction finale.
- CNS Wayfarer provides squad resupply and a pilotable launch. The Corsair is a hostile boarding target, with a separate moving coastal patrol. Meridian Anchorage has a walkable deck and interior spaces reached by actual flight.
- Kestrel has a cockpit, damage and repair, and rechargeable cannons for dogfights against pirate interceptors. Salvage funds thruster, hull and cannon upgrades, as well as player armour and weapon handling refits at friendly or secured bases.
- Vale and Rook fire less aggressively than before, with limited support range and damage so they do not clear camps for you. They seek nearby cover and can help a downed buddy. Q focuses a hostile, B switches hold/follow, J requests ammunition with a cooldown, and holding E revives a nearby downed comrade. Squad activity appears in the HUD; both companions travel aboard your vehicles.
- Press I for optional contracts, field notes, refits and manual saving. Complete contracts for salvage; a recovered pulse-lattice blueprint reduces cannon refit costs. Expedition progress also saves automatically in this browser, including discoveries, captured bases, contracts and upgrades. **Continue Expedition** restores it; **New Expedition** starts fresh. Saves do not sync between browsers or devices and can be lost if browser storage is cleared.
- The atlas samples actual terrain and coastline. Drag to pan, wheel or buttons to zoom, and choose any listed site to set a bearing. It never teleports the player.

Distinct settlement layouts now include a freight harbour, radio-dish terraces, ore conveyors and drills, covered market lanes, and salvage yards with broken ship hulls. Five small roadside scenes break up the journeys between districts.

## Verification

```sh
npm test
npm run build
node qa/adventure-flight-test.mjs
node qa/adventure-ground-test.mjs
node qa/frontier-test.mjs
node qa/crashfall-test.mjs
node qa/mobile-test.mjs
node qa/frontier-performance.mjs
```

Browser scripts require the dev server and Chromium; check each script's browser executable path for your machine. Frontier results and screenshots are in `qa/frontier-results.json`, `qa/frontier-*.png` and `qa/refinement-*.png`. Earlier art-restoration, harbour and region reports document preceding builds. The ground suite has been updated for the reduced squad role. Read `qa/LIVING-FRONTIER-REVIEW.md` for the current visual review, validation and performance evidence.

## Technical and scope notes

TypeScript/Vite/Three.js with Rapier collision, terrain streaming, character controllers and vehicle sweeps. Assets and audio are procedural and contain no Call of Duty or No Man's Sky assets. Read-only runtime diagnostics are at `window.blackline.snapshot()`; development-only scenario helpers are excluded from production. Output is `dist/` with the existing private Sites configuration.

The large carrier, Corsair boarding vessel and station remain stationary; the launch is pilotable and the coastal patrol moves. There are no interplanetary jumps, multiplayer, cloud saves, authored cinematic campaigns, complex navigation meshes, destructible buildings or production character animation. Local saves resume from a safe position rather than preserving every live simulation detail. Float precision and memory limits still apply at extreme travel distances; long-session and cross-device performance are not certified. Visual comparisons against actual Call of Duty and No Man's Sky references informed refinements, but BLACKLINE does not match their graphics or production quality.
