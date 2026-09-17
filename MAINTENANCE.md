# BLACKLINE maintenance

## 2026-09-17 — feature upgrade: exploration clue trails

- Added five optional leads unlocked by recovered roadside records. The journal connects evacuation, repair, relay, shipment and coastwatch records to existing caves, wrecks and the Wayfarer buoy. Tracking a lead marks the map and compass and persists its destination. Collecting the destination removes the lead and clears its tracked pin; existing schematic/reward rules still pay once.
- Leads derive from recovered records, including older saves. Reading a record does not replace the tracked mission; the player chooses the detour. Resident side quests still require conversation. This adds no new world meshes, actors or streaming work.
- Validation: all 114 tests and the production build passed. Edge exercised a real roadside pickup, journal tracking, map/compass pin, save/load, cave pickup and resolved-lead removal with no page errors. Existing-save leads and buoy tracking passed in a 390px phone viewport. Reviewed desktop journal, map and phone screenshots in `qa/exploration-leads-*.png`. Physical controller and Apple-device behavior remain unverified.
- Next priority (maintenance): check mission progress and follower recovery after saving during an active survivor escort. Preserve the existing seven-day schedule and alternate back to a focused fix.

## 2026-09-16 — streamed scout resource cleanup

- Fixed encounter unloads that disposed scout geometry but left private rifle-optic and effect materials undisposed. Actors now expose an idempotent cleanup method; shared soldier materials and the weave texture remain available to live actors.
- Validation: all 111 tests and the production build passed. The new lifecycle regression exercised 12 actor replacements and verified private-resource disposal exactly once with no shared-resource disposal. Edge exercised eight actual encounter unload/reload cycles: two scouts and ten private effect/optic materials released per cycle; no page errors. Reviewed the rendered scene after reload cycles in `qa/scout-cleanup.png`.
- This corrects a resource-lifecycle bug; it does not establish the cause of the user's earlier Edge tab closures. Physical controller and Apple-device behavior remain unverified.
- Next priority: check mission progress and follower recovery after saving during an active survivor escort. Keep the next run focused; preserve the existing Xbox bindings and ship purchase progression.
