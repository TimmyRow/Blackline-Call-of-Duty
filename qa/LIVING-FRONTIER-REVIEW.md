# Living frontier review

BLACKLINE now has playable versions of the twelve proposed upgrade areas. This is a browser prototype, not a claim of AAA parity or a finished commercial campaign.

## Implemented and reviewed

- Furnished workshops, barracks and control rooms; mining and pirate settlement variants; roads, signs and the established rainy industrial palette retained.
- Natural landmarks, a tidal river, caves and wrecks; bounded roaming patrols, a convoy, distress signals and two-way recon skirmishes. Optional discoveries and contracts can be approached in any order.
- Reduced companion damage and engagement range, defensive cover and buddy revives. Q focuses a target and B holds the squad for solo approaches.
- FPS recoil/reload refits, weapon bolt/casings and spatial gunfire; cockpit instruments, landing gear, damage feedback, ship upgrades and pirate interceptors.
- Furnished station/carrier spaces, pilotable carrier launch, boat-deck squad disembarkation, coastal pirate patrol and boarding/cargo objectives.
- Journal, seven optional contracts, five upgrade families, a rare cannon blueprint, and validated browser-local expedition saves. Saving during flight restores the last safe foot location and landed ship; saving aboard the launch restores its stopped deck.
- Forty-minute day/night cycle, blended clear/rain/storm weather, changing fog/sky/wetness, practical lighting and pooled smoke.
- Automatic render-resolution reduction under sustained load, batched vehicle geometry, distance-limited details/AI, bounded active encounters and streamed terrain.

## Visual comparison

Two independent screenshot-review rounds used actual BLACKLINE captures and official reference images from [Call of Duty: Black Ops 7, Toshin](https://www.callofduty.com/guides/blackops7/multiplayer-maps/toshin) and [No Man’s Sky: Worlds Part II](https://www.nomanssky.com/worlds-part-ii-update/). This was a labeled reference review, not a blind preference test.

Round one identified terrain through interior floors, crude river occlusion, geometric cone trees and weak storm distinction. The follow-up changed the actual terrain/collision foundations, discarded overlapping coarse river terrain, added irregular foliage clusters and strengthened storm fog/cloud/light treatment. Round two confirmed those corrections in interior, river and storm captures.

The independent reviewer still judged BLACKLINE substantially below those commercial references: simple procedural geometry, repeated surface detail, limited character animation and less environmental storytelling remain visible. No equality claim is warranted. A final independent image-only check after the four-light optimization found no blocking new regression: some right-hand street frontage lost warm illumination, while road reflections, signs, interiors and storms remained readable. Reference images are excluded from source publication.

## Validation

The isolated companion-support checks maintain player health while measuring AI contribution; they do not test survival while standing exposed. An earlier run correctly killed the exposed operator, so its frozen death-screen clock was a harness issue rather than a save defect. The final frontier suite passed all 6 scenarios (weather/pause, journal/refits, one-time wreck rewards, limited squad support, raid/contract/save continuation, and moving-boat exit/deck save restoration). The ground regression suite passed all 7 scenarios; the flight suite passed all 5 scenarios, including real boost travel, elevated landings and an interceptor kill. Browser suites reported no page errors. Unit suite: 39 passing tests, including real Rapier vehicle collision/deck behavior, climate continuity, save validation, one-time rewards, upgrade limits and terrain triangles beneath floors. Production TypeScript/Vite build passes.

## Performance sample

Headless Chromium, 1440 × 900, 240 measured frames per scenario on this desktop. Auto warmed up for 12 seconds. Player health was maintained during combat sampling to avoid measuring a death menu. Other hardware and long sessions may differ.

| Scenario | Quality | Mean FPS | 95th-percentile frame | Worst frame |
| --- | --- | ---: | ---: | ---: |
| ground combat | high | 45.9 | 29.6 ms | 37.5 ms |
| ground adaptive | auto | 45.7 | 30.0 ms | 33.4 ms |
| ground performance | low | 48.4 | 28.8 ms | 85.3 ms |
| boost streaming | high | 73.1 | 37.1 ms | 128.7 ms |
| storm adaptive | auto | 50.2 | 28.1 ms | 33.5 ms |
| boat travel | auto | 49.4 | 31.7 ms | 43.9 ms |

Reducing the fixed practical-light pool from eight to four nearest lights and sharing wet-road noise calculations raised the High ground sample from 33.6 to 45.9 FPS. Auto now reduces resolution after three sustained seconds below 55 FPS, stopping at 70% scale. These samples are not a controlled device-wide benchmark, and boost streaming still showed an occasional 129 ms hitch. Terrain remained bounded at 49 active chunks.

## Remaining scope

No multiplayer, spherical/interplanetary simulation, destructible buildings, cinematic campaign, cloud saves or production character animation. Carrier, boarding vessel and elevated station remain fixed structures. Procedural terrain is extensive but finite floating-point precision and hardware memory still apply. Short desktop samples do not establish performance on every device or over multi-hour sessions.
