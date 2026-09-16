# BLACKLINE maintenance

## 2026-09-16 — streamed scout resource cleanup

- Fixed encounter unloads that disposed scout geometry but left private rifle-optic and effect materials undisposed. Actors now expose an idempotent cleanup method; shared soldier materials and the weave texture remain available to live actors.
- Validation: all 111 tests and the production build passed. The new lifecycle regression exercised 12 actor replacements and verified private-resource disposal exactly once with no shared-resource disposal. Edge exercised eight actual encounter unload/reload cycles: two scouts and ten private effect/optic materials released per cycle; no page errors. Reviewed the rendered scene after reload cycles in `qa/scout-cleanup.png`.
- This corrects a resource-lifecycle bug; it does not establish the cause of the user's earlier Edge tab closures. Physical controller and Apple-device behavior remain unverified.
- Next priority: check mission progress and follower recovery after saving during an active survivor escort. Keep the next run focused; preserve the existing Xbox bindings and ship purchase progression.
