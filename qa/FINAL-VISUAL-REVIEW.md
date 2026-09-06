# Final visual review — Ash Coast

Reviewed the actual local build at port 5180 on 2026-09-06 after the final terrain/material pass. One browser at a time; all browser processes from this review are closed. No page errors were observed. This was a visual pass, not a combat or performance benchmark.

## Findings

- **P3 — Compact map labels are too small for comfortable reading.** At 800×720 the diagram labels shrink considerably; mission cards provide the readable names and actions. The map has no horizontal overflow. Its inner content scrolls vertically by about 61 px; card lower borders are slightly clipped in the initial view, but all three track action labels are visible. See `final-map-800.png`.
- **Visual quality remains a prototype.** Ground is visibly repetitive and sparse, rocks/ships/armor use coarse primitive silhouettes, and environmental composition lacks dense authored detail. The new material shading makes surfaces more readable, but the result does not support AAA or Call of Duty quality claims.

## Passed visual checks

- **Relay road correction verified in the targeted frame.** After the geometry fix, the same position `(-108, -62)` and view (`yaw .1`, pitch `-.02`) shows a continuous road surface. The land-colored holes and protruding tilted marking from the original P2 finding are absent. `final-relay-1600.png` has been replaced with this corrected frame. This single targeted capture does not establish every road segment is free of intersections.

- Squad armor is dark and materially separated. Cyan light is confined to the visor and identification panels; the earlier whole-body emissive appearance is absent in the inspected squad close-up.
- At 1600×900 the landing presents one continuous landscape, with the harbour ahead, elevated relay infrastructure to the left, the battery area to the right, roads between them, and spacecraft overhead. This communicates the connected-region layout. Walking continuity was covered by the earlier functional tests, not re-proven by these stills.
- Objective, compass, health/ammunition, squad order, and subtitle text are readable and occupy predictable edges. The weapon and opening subtitle do take substantial lower-screen space, but the central aiming area remains clear.
- At 1280×720 the field map has a clear diagram/card split, coastline and roads, current position/bearing, objective distances, effects, and visible tracking controls. At 800×720 it rearranges into a map above three cards with inner scrolling. Escape closed the map during capture.

## Evidence and limits

- `final-landing-1600.png` — live landing, north-facing, 1600×900; also copied to `gameplay.png`.
- `final-squad-1600.png` — live squad close-up, 1600×900.
- `final-relay-1600.png` — live northbound relay approach, 1600×900. Diagnostic teleport positioned this view; squad did not teleport with the player. This captures the approach, not the full interior compound.
- `final-map-1280.png` and `final-map-800.png` — actual paused map, 1280×720 and 800×720.
- `menu.png` — refreshed from the final build at 1600×900.

The older `region-*.png` files document earlier functional coverage before the final material polish. They should not be presented as the latest visual appearance. No reference browsing or external comparison was repeated for this pass.

