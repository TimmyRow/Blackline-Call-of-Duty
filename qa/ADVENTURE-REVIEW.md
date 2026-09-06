# Orison adventure verification

This report covers the expanded planet adventure. Earlier harbour/region reports describe superseded builds.

## Functional checks

19 node tests pass: open-ended discovery/capture/resupply rules, distant deterministic generation, five real Rapier flight tests, and core weapon rules.

Five integrated flight scenarios pass with no browser errors. Actual keyboard input boarded Kestrel, took off, boosted about 740 m, and refused midair exit. Tests arranged approaches above the carrier, pirate ship and station, then used real descent and F to land/disembark; both squadmates remained supported on those decks. Carrier resupply restored player health, ammunition and ship hull. Real cannon input destroyed a moving pirate interceptor and awarded 80 salvage. These tests do not claim an unaided continuous journey from spawn to station.

Seven integrated ground scenarios pass with no browser errors. In an actual 13-second squad battle, Vale and Rook defeated six pirates without the player firing. Vale fired 24 shots, dealt 342 damage and scored 4 kills; Rook fired 9 shots, dealt 258 damage and scored 2 kills. Tests also exercised hold/focus/supply commands, cargo capture, atlas pan/zoom/tracking without teleporting, captured-camp resupply and fresh expedition resets.

Standalone squad physics checks covered line-of-sight blocking, detouring around a building, transport, elevated deck support/edge avoidance, and revival. Standalone world checks verified actual carrier and station collision heights and bounded 49-chunk streaming caches. These are targeted checks, not exhaustive pathfinding or long-session certification.

## Review and corrections

Independent agents identified and prompted fixes for duplicated pirate-ship spawns, enemy state surviving a fresh expedition, interceptor cannon hits through solid cover, oversized cropped cockpit lettering, and overlapping/clipped atlas labels. World review improved patterned sky/water, steep starter terrain transitions and procedural vegetation.

The graphics remain visibly a procedural prototype: repeated modular buildings, simple ships, stylized trees/rocks, basic soldier animation and limited surface detail. Station buildings share the colony construction kit. The world is substantially larger and supports more activities, but this is not AAA or No Man's Sky visual parity.

## Evidence

- adventure-flight-results.json / adventure-flight-test.mjs
- adventure-ground-results.json / adventure-ground-test.mjs
- adventure-start.png / adventure-squad-combat.png
- adventure-cockpit.png / adventure-carrier.png / adventure-corsair.png / adventure-station.png
- adventure-atlas.png / adventure-atlas-800.png
- adventure-performance.json / adventure-performance.mjs

The world-* images are earlier isolated environment captures before final atmospheric adjustments. The current atlas/cockpit images were refreshed after their visual corrections. Scene setup uses development helpers where necessary; production excludes these helpers.

## Limits

The planet is an unbounded deterministic horizontal landscape with streamed local physics, not a globe. High-altitude flight and the station share its coordinate system. Ocean ships/station are fixed boarding locations; boats are not pilotable. Progress persists only during the expedition, not across reloads. Squad navigation uses local obstacle avoidance rather than a full navmesh. Extremely distant coordinates, prolonged sessions and multiple hardware classes remain unverified.


## Performance sample

High preset, headless Chromium/ANGLE on Intel UHD Graphics, 1440×900, 180 frames per scenario: ground combat averaged 99.6 FPS (p95 20.9 ms); boost streaming averaged 109.0 FPS (p95 12.6 ms). The boost sample had a 112.5 ms worst frame while streaming, so this does not establish stutter-free flight. Terrain remained bounded at 49 chunks and loaded sites fell from 18 to 16 across the sampled travel. Flight distance reached about 1.1 km. These are short local samples with no cross-device or long-session guarantee. Raw timings and configuration are in adventure-performance.json.
