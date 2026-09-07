# BLACKLINE — Orison & Vesper

A Three.js first-person expedition across two procedurally streamed planet regions. Travel on foot, pilot the Kestrel dropship or captain the Wayfarer launch. Raid pirate settlements, investigate frontier signals, recover relics and land at an elevated station. Vale and Rook provide restrained support while you lead the fighting.

This is a playable procedural prototype, below AAA production quality. Its new geography continues beyond the starting area, but it is not a spherical planet, a complete universe simulator, or a No Man's Sky equivalent. Local flight uses continuous altitude; Meridian station is at 1,800 metres. Journal transit connects the Orison and Vesper coordinate sectors.

## Frontier expansion

The [18-item upgrade record](UPGRADES.md) describes the playable additions and remaining limits. **V** scans nearby signals, **X** swaps ballistic/energy weapons, **K** requests a medic, and **I** opens contracts, refits and planet travel. Touch players use More and Journal. To travel, fly above 250 m ground clearance with speed below 80 m/s and at least 30 hull / 30 energy. Vesper includes a friendly port where you can land, disembark and refit.

Track Corsair to follow the new engine-disable, boarding, prisoner rescue and cargo sequence. Selected objectives share map/compass pins, including saved distant destinations. Pirates have five roles and call reinforcements; securing local bases reduces nearby garrisons.

Validation includes `node qa/expansion-test.mjs`, `node qa/expansion-mobile-test.mjs`, `node qa/stability-test.mjs`, and the navigation/world browser scripts in `tests/`. These use Edge, Chromium mobile emulation and WebKit; physical Apple-device certification is not available in this workspace.

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
| C | Crouch | Descend |
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

Kestrel has a permanent live compass beacon, a pinned atlas entry and an H tracking shortcut. New expeditions protect the crash survivors, meet Mara, complete Cold Harbour and Northwatch on foot, then follow the causeway to Port Astra City. Kestrel costs 300 salvage at Hangar 03. Hold E / Xbox X / touch Interact beside the sales terminal to buy; the main quest and compass mark it. Existing pilots keep their ships. Walk beside it and press F, then Space to lift off. Base cruise speed is 140 m/s, or 420 m/s with boost; refits increase performance. Use C to descend and release thrust to slow before landing. The ship checks its swept hull against physical buildings and terrain, and refuses airborne or open-ocean disembarkation. Land on marked carrier and station pads to explore on foot.

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

The large carrier, Corsair boarding vessel and station remain stationary; the launch is pilotable and the coastal patrol moves. There is journal-based transit between two planet regions, but no spherical orbital simulation, multiplayer, cloud saves, authored cinematic campaigns, complex navigation meshes, destructible buildings or production character animation. Local saves resume from a safe position rather than preserving every live simulation detail. Float precision and memory limits still apply at extreme travel distances; long-session and cross-device performance are not certified. Halo-style military sci-fi and No Man's Sky exploration guide the current direction; BLACKLINE does not match their production quality.

### Clear flight view

Kestrel uses an unobstructed pilot view with hull, energy, speed and altitude in the existing HUD. Move the mouse up/down/left/right to look; looking does not require holding fire, including browsers without pointer lock. WASD supplies thrust, Space/C changes altitude, Shift boosts, and left click fires. On touch devices, swipe to look; only Descend, Rise and Fire remain in the flight action row. Infantry buttons return on exit.

Verified with `node qa/flight-view-test.mjs`: captured and uncaptured mouse directions, cannon input, iPhone/iPad landscape touch layouts and swipe input. Screenshots and results are in `qa/flight-clear-*.png` and `qa/flight-view-results.json`. Mobile checks use browser emulation, not physical Apple hardware. Six flight physics tests and the production build also pass.

### Flight stability and planned upgrades

The current build caps desktop framebuffer allocation at 3.69 megapixels (mobile keeps its 0.95 megapixel budget), releases bloom buffers in Performance mode, and pauses/rebuilds graphics after context loss without reloading the page. Unloaded scouts retain only bounded gameplay records; active enemy assignment is capped at 48.

`node qa/stability-test.mjs` passed in installed Windows Edge: takeoff/boost, 18 settlement transitions, repeated quality changes, a 4K resize and two injected graphics interruptions. Repeated streaming held at 224 geometries and 36 textures in the sampled destination; collected JavaScript heap stayed around 19–21 MB. This is a bounded automated test, not a claim that every crash is eliminated. The reported spontaneous Edge tab exit was not reproduced. All 46 unit tests, seven mobile Chromium checks, the WebKit smoke check and the production build pass.

See [the next-upgrade list](UPGRADES.md), led by matching tracked-objective pins on the map and compass. That earlier planning list is now implemented as the frontier expansion described in UPGRADES.md.

Expansion validation: 64 unit tests, seven desktop expedition checks, four new mobile expedition checks, seven existing mobile checks plus WebKit, and five Edge stability scenarios pass. Three subagents implemented/reviewed combat, navigation and world destinations; actual screenshots exposed and corrected blocked observation glazing, deleted compass markers and dry-world horizon holes.


## Xbox controller comfort

Connect an Xbox One/standard-mapping controller and press A. Left stick moves; right stick controls the camera; RT shoots. Menu (three lines, ☰) toggles the map; View (the small button immediately left of it) pauses/resumes. X interacts (hold for progress actions); B cancels/back or stops movement and brakes vehicles; A starts/confirms/jumps and rises in flight.

Other actions remain available: LT aim, RB reload, Y weapon swap, LB grenade, click left stick to toggle sprint/boost, click right stick to board/exit. D-pad up scans, down toggles crouch / holds descent, left opens journal/squad and right tracks the ship. Access missions/equipment using journal tabs or the pause menu. After B stops movement, centre the stick before moving again.

Controls & Settings saves look speed, aiming speed, flight speed, separate stick deadzones and inversion. Use D-pad/left stick to navigate, left/right to adjust, A to select, and B to return. LB/RB cycles every journal tab, including the current conversation. On the map, right stick pans and LB/RB zooms. Right stick scrolls long menus. Release held controls after changing menus or reconnecting. The game pauses on disconnect. Hardware behavior still needs a physical controller playtest.

New expeditions now include a visible survivor rally and three-raider defense before meeting Mara. Ship ownership comes later through the city purchase. Existing saves keep their current progression. Wrecks and distress signals have separate interaction steps and residents respond to completed work.

Flight descent and infantry crouch use **C**. Ctrl is not a game control: Ctrl+W (or Ctrl+Shift+W while boosting) closes an Edge tab/window. Xbox D-pad down and the touch Descend button descend. B cancels or brakes.


### Complete controller flow

The controller pass adds latched sprint/crouch, active-pad selection when a dormant virtual controller is connected, clean handover from touch/keyboard, stable menu focus, and controller prompts for the atlas, journal, boats and grenades. Gameplay and menus require no mouse/keyboard once the page is focused. Browser audio policy can still require an initial click for sound.

Reference: [Minecraft controls](https://www.minecraft.net/en-us/article/minecraft-controls), particularly left-stick movement/click-to-sprint, right-stick look and A/B movement buttons. BLACKLINE retains its FPS trigger, reload and weapon bindings.

`node qa/controller-complete-test.mjs` exercises fresh start, settings, walk/strafe, jump, sprint/crouch, combat, NPC quests, refits, squad orders, map, launch, hangar purchase and flight using simulated Xbox input. Scenario positions and later quest progression are injected; gameplay actions use the controller adapter. `qa/controller-ui-test.mjs` checks map/tab focus and screenshots; phone/tablet controller settings are checked separately. Physical Xbox hardware remains untested.
