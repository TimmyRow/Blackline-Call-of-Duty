# Industrial restoration review — 2026-09-06

Restored the first build's industrial direction while retaining the streamed planet, squad combat, ocean carriers and pilotable dropship. The reference is `original-style.png`, extracted unchanged from `82e767b:qa/gameplay.png`.

## Visual evidence

Viewed actual rendered 1440×900 gameplay captures: `industrial-start.png`, `industrial-harbour.png`, `industrial-street.png`, `industrial-relay.png`, `industrial-carrier.png`. `industrial-road.png` documents the winding road and readable directional sign. The screenshot script is `industrial-visual-test.mjs`.

- Built a developed starting district and compact settlement blocks with weathered cargo, loading bays, signs, roof plant, catwalks, subdivided illuminated windows, gantries and cranes.
- Restored navy rainy atmosphere, warm/cool practical lighting, differentiated metal/concrete/paint textures and irregular wet asphalt.
- Five roads, approximately 2.7 km, follow the exact underlying collision terrain triangles. Terrain props avoid their footprint. Paint is suppressed at shared junctions.
- Independent visual critic identified overly bright sky, regular pavement reflection bands and blank side facades. All three were corrected and re-reviewed. No blocking visual issue in the final reviewed captures. The original still has stronger close-range composition and richer reflections; this is a substantial restoration of direction, not a claim of exact parity or AAA quality.

## Gameplay verification

- Production build passes; existing bundle-size advisory remains.
- 19 unit checks pass.
- 7 ground browser checks pass: both squadmates fired and dealt damage, killing all six harbour hostiles without spending player ammunition; focus/hold/supply, looting, atlas, base resupply and reset all worked.
- 5 flight browser checks pass: boarding/takeoff/boost, carrier/station/pirate-ship landing and squad disembark, interceptor cannon kill. Pads and exits remain clear with the additional architecture.
- Five visual scenarios produced no page or console errors.

## Performance and limits

1440×900 High, Chromium WebGL2, Intel UHD Graphics, 180 frames per scenario:

| Scenario | Average FPS | p95 frame | Maximum frame |
|---|---:|---:|---:|
| Ground combat | 49.3 | 33.3 ms | 45.8 ms |
| Boost streaming | 74.4 | 16.7 ms | 104 ms |

An initial flight capture exposed a 1.97-second shader compilation hitch when point lights became invisible. Keeping the eight-light shader layout constant and setting unused lights to zero intensity removed that hitch in the repeated run. The terrain cache remained bounded at 49 chunks and 17–18 loaded sites. These are short local samples, not a cross-device guarantee; the restored details cost more than the previous sparse environment.

Roads develop the authored starter districts; they do not cover every procedurally generated camp. Existing procedural-world and gameplay limitations in README still apply.
