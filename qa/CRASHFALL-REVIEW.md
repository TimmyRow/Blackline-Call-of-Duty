# Crashfall discovery pass

## Changes

New expeditions begin with a 15-second, skippable cockpit descent and crash. Recover a physical emergency cell, walk to Kestrel, hold E to restore it, then board and take off. The saved recovery stage prevents replaying the opening on Continue; existing saves receive working ship guidance without being erased.

Kestrel has an always-available H tracking shortcut, live compass marker, distance readout, world beacon and pinned atlas entry. Compass ticks now scroll with yaw and show N/NE/E/SE/S/SW/W/NW plus degrees, including correct north wraparound.

Weather starts on a clear morning. The 150-second schedule is mostly dry with occasional showers and storms; clear-weather road wetness now falls to zero. The 40-minute day cycle remains.

Distinct freight, relay, mining, market and salvage layouts replace the repeated four-building template. Five terrain-following roadside scenes add smaller landmarks between districts. Batched geometry, shared layout/terrain foundations and bounded streaming remain in place.

## Verification

42 unit tests pass. Browser QA walks the full recovery route using real keyboard controls, holds interactions, boards and takes off. It checks four compass headings, H tracking, the pinned ship card and save/continue without replaying the opening. See crashfall-results.json and crashfall-*.png. The final repeated five-scenario run also passed with no browser or shader errors.

Image review found a disconnected dish pedestal and unsupported pipe brackets; these were connected to supports and a second independent image check confirmed both corrections. The crash clearing now excludes foliage, and cockpit telemetry replaces blank panels. The new layouts have distinct silhouettes but still share procedural materials and some yard infrastructure.

## Performance

1440 × 900 desktop Chromium, 240 frames per sample. Auto ground and High boost; player health maintained so death menus do not contaminate timing. Samples precede the final cosmetic supports/telemetry refinement.

- ground adaptive: 64.7 mean FPS; 95th-percentile frame 29.2 ms; worst 41.5 ms.
- boost streaming: 71.6 mean FPS; 95th-percentile frame 37.5 ms; worst 152.0 ms.

Active terrain remained bounded at 49 chunks. These short samples do not certify every device; boost streaming still has occasional hitches. This pass improves discovery and navigation within the existing procedural prototype, not a claim of commercial AAA parity.
