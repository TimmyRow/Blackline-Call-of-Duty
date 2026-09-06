# Verification and visual review — original harbour prototype

This report describes the earlier enclosed harbour build. Current connected-region verification is in `REGION-REVIEW.md`; the current visual assessment is in `FINAL-VISUAL-REVIEW.md`. The performance figures below are historical and do not describe the expanded region.

## Gameplay

Four automated rule tests passed. Ten browser scenarios passed with zero browser errors. The browser pass used real input for movement, collision, firing/headshots, aiming, reloading, jump/crouch, grenades, pause/resume, redeployment, hold/release interaction and extraction. Development hooks arranged health, location, ammunition and mission state where needed; this was not a complete unaided playthrough.

## Independent visual comparison

Reference: [official Call of Duty: Black Ops 7 Toshin guide](https://www.callofduty.com/guides/blackops7/multiplayer-maps/toshin), specifically [Koban Corner screenshot](https://www.callofduty.com/content/dam/atvi/callofduty/cod-touchui/guides/games/blackops7/toshin/COD-BO7-MAPS-CORE-TOSHIN-007.webp).

The reference is an official multiplayer environment screenshot without a weapon or HUD. The comparison assesses environmental still-image appearance only. It does not establish combat, animation or weapon parity. The reviewer knew the project and recognized the reference; it was not a blind test.

Round 1 verdict: the Call of Duty reference was substantially stronger. Main deficiencies were near-black materials, an empty smooth road, a dominant bright arrow and repetitive box architecture.

Round 2 verdict: material visibility, container color and depth improved substantially. The AAA target remained unmet. The reviewer requested two bounded final changes: reduce the broad glossy road patches and add one believable loading-area prop cluster.

The final changes address those specific criticisms; they do not establish AAA parity. Remaining gaps include simplified geometry and silhouettes, procedural surface treatment, repetitive architecture, basic character animation and limited content scale.

A second, fresh reviewer received only a side-by-side image labeled A/B, without source labels or conversation history. A was BLACKLINE's final environment-only capture; B was the official reference. That reviewer independently ranked B clearly higher and found the two unequal in production quality, citing richer architecture, material variety, dressing and depth in B. This source-label-hidden comparison is not a controlled blind experiment: settings and lighting differ, and recognizable content can reveal a source. The local reference copy and combined image are excluded from source publication; their provenance is linked above.

## Evidence

Final short frame-timing check: Chromium/ANGLE on an NVIDIA GeForce RTX 4070 Laptop GPU, 1440×900, 100 frames per preset, active forward movement and automatic fire. High averaged 59.9 FPS (95th-percentile frame 16.8 ms); Performance averaged 83.8 FPS (95th-percentile 17.3 ms). High used about 225 aggregate draw calls. These are short local measurements, not cross-device or long-session guarantees. Cached static environment shadows and merged enemy materials reduced a prior high-quality menu measurement from ~15 to ~117 FPS. Moving enemies use lightweight contact shadows.

- `menu.png`: game-native deployment screen.
- `gameplay.png` and `port.png`: actual WebGL gameplay scene captures.
- `aim.png`: aiming pose and centered optic.
- `gameplay-test.mjs`: repeatable browser scenarios.
- `performance.mjs`: GPU identification and frame-timing measurement.

Browser WebMCP is feature-detected for mission readback and pause. No supported native WebMCP validation context was available, so those integrations are not certified.
