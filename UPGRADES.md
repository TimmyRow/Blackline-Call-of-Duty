# BLACKLINE — next upgrades

Design reference: Halo-style military sci-fi, with No Man's Sky-inspired exploration. Keep the pilot view clear and support keyboard/mouse plus iPhone/iPad touch controls.

## Next

1. **Tracked-objective pins on the map and compass.** Give the selected mission, ship, camp or station the same distinctive pin on both. Show its name and distance, update its bearing while turning, indicate above/below, and use an edge arrow when it is behind you. Keep the selection after saving; hide the ship's own locator while aboard. Prioritize recovery quests without covering the view.
2. **Flight destinations and landing guidance.** Identify friendly decks, hostile vessels and safe landing zones from the air, with a compact approach cue.
3. **More distinct encounters.** Add recognizable camp silhouettes, roadside events and optional discoveries so exploration has variety and purpose.
4. **Halo-inspired combat readability.** Improve alien landmarks, sci-fi weapon feedback and faction silhouettes while preserving BLACKLINE's identity.
5. **Long-session stability checks.** Extend Edge flight and streaming soak tests, with checks on physical iPhones/iPads as devices become available.

## Stability work in this update

- Bound desktop render resolution on large/high-DPI displays.
- Release unused bloom framebuffers in Performance mode.
- Recover a lost graphics context in place with the expedition paused, instead of forcing a page reload.
- Keep unloaded patrol memories as small gameplay records and enforce the existing 48-enemy pool limit before assigning soldiers.

These fixes address identified resource and recovery problems. The reported Edge tab exit has not yet been reproduced exactly.
