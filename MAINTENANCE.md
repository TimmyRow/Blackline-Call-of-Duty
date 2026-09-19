# BLACKLINE maintenance

## 2026-09-19 — feature upgrade: town operation debriefs

- Return to Lia, Tomas or Iris after their field operations for specific news about the people and routes helped. Each of the five operations offers one optional cache of 60 rounds and one grenade, stored in the shared squad locker for collection at a friendly base. Completed mission entries mention returning to the resident.
- Claims persist through the common save validator, including older saves with completed operations. Full lockers retain unclaimed rewards. Debriefs require the correct, available resident and a nearby conversation; they do not replace the active objective or repeat mission salvage rewards. No new world actors or per-frame work added.
- Validation: all 119 tests and the production build passed. Edge exercised Tomas's conversation, a cache claim, withdrawing usable ammunition/grenades, reloading without a duplicate, and a second claim in a 390px phone viewport. No page errors or horizontal overflow. Reviewed desktop and phone captures in `qa/operation-debriefs-*.png`. Physical controller and Apple-device behavior remain unverified.
- Next priority (maintenance): inspect dialogue and journal input focus after disabled actions, including simulated controller navigation. Preserve the existing bindings and seven-day schedule.

## 2026-09-18 — maintenance fix: preserve rescued survivors on reload

- Reproduced an escort-save regression: reloading `No one left behind` moved both freed survivors approximately 10.8m back toward their original capture positions. The mission stage persisted but the actor positions did not.
- Save the two survivors' physics positions during the escort stage and restore them when the rescue area activates. The common save validator preserves them for autosaves, manual slots and recovery checkpoints. Older saves still initialize survivors at their original positions; malformed or out-of-area positions are discarded. Saving immediately after loading preserves pending positions, and extraction requires initialized, visible survivors.
- Validation: all 116 tests and the production build passed. Edge reproduced the failure before the fix; afterward both survivors resumed within 0.61m, immediate load/save/load preserved them, extraction completed, and completion/reward stayed stable on another reload. No page errors. Reviewed `qa/rescue-save-restored.png`; results in `qa/rescue-save-results.json`. Physical controllers and Apple devices were not tested.
- Next priority (feature upgrade): give town residents a useful response to completed field operations, building on the existing conversation and mission systems. Keep the existing schedule and alternate upgrades with maintenance.

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
