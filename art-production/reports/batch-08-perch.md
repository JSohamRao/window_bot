# Batch 08 — Perch review

Status: **READY FOR USER VISUAL APPROVAL**

## Approved sequence

Six ordered poses: approach invisible edge, lower onto edge, seated contact,
relaxed settle, perched idle, and exit/recovery.

- All six frames are genuine reference-guided generations from the canonical
  base.
- Frames 2–5 share a consistent invisible horizontal seat line.
- Frames 3–5 are unmistakably seated, with the tiny rear supported and both
  feet dangling below the invisible ledge rather than touching a ground plane.
- `perch_05` is a dedicated seated idle rather than the canonical ground idle.
- `perch_06` lifts the hips and gathers the legs to exit without snapping poses.
- No ledge, furniture, wall, scenery, ground, shadow, or prop was baked into any
  frame.

## Validation

- Required count: 6 / 6.
- Valid square 1254×1254 RGBA PNGs with non-empty alpha: pass.
- Exact duplicates within Perch: none.
- Suspicious near duplicates within Perch: none.
- Character identity: pass for proportions, hair, eyes, markings, grin, teeth,
  scarf, limbs, claws, linework, shading, and palette.
- Sequence continuity: pass from approach through lowering, seated settle,
  dedicated perch idle, and release.

Five accepted generations returned opaque checkerboard previews. Their sources
were retained in `rejected/perch/`, and the approved candidates used
edge-connected alpha-only cleanup with RGB artwork and 1254×1254 geometry
preserved. The cleanup tolerance was tightened after contact-sheet inspection
found faint neutral backdrop speckles; the refreshed sheet is clean. `perch_01`
arrived as native RGBA and only sub-threshold alpha was normalized.

No production asset was replaced and no runtime integration was performed.
The application build passes, and the complete automated suite passes 152 / 152.
