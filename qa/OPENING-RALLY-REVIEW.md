# Opening and first town playtest

Tested September 7, 2026 in headless Microsoft Edge, 1440 × 900, Performance quality. This verifies simulated browser interactions, not a physical controller or a complete unassisted playthrough.

## Findings

- **Fixed: rally was an invisible trigger.** The revised rally has a cyan post, two waist-high cover crates, a supply case, and both squadmates visibly waiting there after cell recovery. The hold prompt remains reachable after adding the crate colliders. The corrected lifecycle passed again.
- **Improved: nearby headings and pins.** The duplicate world waypoint now disappears within 12 meters, and the location title fades out beside a resident. The QA waits for the actual CSS opacity rather than an arbitrary delay before photographing the town. Transient signal and ship notices still occupy the upper center, but resident interactions and the combat area remain readable.
- **First town navigation is legible.** Road signs, building names, distinct NPC nameplates, and close-range conversation prompts make Mara and Lia accessible. The architecture and models remain visibly stylized, with repeated box buildings and simple character geometry; these screenshots do not establish AAA visual parity.

## Verified behavior

Seven browser checks passed with no JavaScript page errors: new story/skip arrival; physical cell hold; rally hold spawning exactly three scouts; a ballistic weapon-raycast kill with remaining enemies still gating completion; one-time defense reward and ship tracking; installation/boarding; Mara briefing and Lia acceptance/follow-up dialogue; final save continuation without replay or duplicate reward.

The test uses QA teleportation to position the player. Cell/rally holds and ship boarding use keyboard inputs; conversations use visible UI buttons. One scout is killed through the real weapon raycast function. Remaining enemies are cleared through the existing QA helper. The test does not claim three manual combat kills or evaluate an uninterrupted 20-minute walk.

Evidence: `opening-rally-results.json`, `opening-rally-regroup.png`, `opening-rally-defense.png`, `opening-first-town.png`, and `opening-town-conversation.png`. Reproduce with `node qa/opening-rally-test.mjs` while the development server runs on port 5180.
