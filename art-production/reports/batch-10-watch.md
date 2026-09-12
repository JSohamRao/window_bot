# Batch 10 — Watch Cursor review

Status: **READY FOR USER VISUAL APPROVAL**

## Approved sequence

Four ordered poses: canonical neutral, viewer-right eye shift, small viewer-right
head turn, and intense viewer-right stare.

- `watch_01` is the unchanged canonical base.
- Three frames are genuine reference-guided generations from the canonical base.
- `watch_02` deliberately changes almost nothing except aligned pupil position.
- `watch_03` preserves that gaze target and adds only a small head turn.
- `watch_04` strengthens the gaze through brows, eyelids, and a tiny forward
  emphasis while keeping body movement minimal.
- Directional frames are suitable for horizontal mirroring toward viewer-left.
- No cursor, pointer, gaze line, UI, scenery, floor, shadow, aura, or prop was
  baked into any frame.

## Validation

- Required count: 4 / 4.
- Valid square 1254×1254 RGBA PNGs with non-empty alpha: pass.
- Exact duplicates within Watch Cursor: none.
- One intentional near-duplicate within Watch Cursor: `watch_01` / `watch_02`
  at dHash distance 4, manually confirmed as the required pupil-only movement.
- Character identity: pass for proportions, hair, canonical eye anatomy,
  markings, grin, teeth, tongue, scarf, limbs, claws, linework, shading, and
  palette.
- Sequence continuity: pass from neutral through eye tracking, head tracking,
  and intense focus.
- `watch_01` / `watch_02` is an expected near-duplicate pair because the
  animation requirement intentionally limits movement to the pupils.

Two accepted generations returned opaque checkerboard previews. Their sources
were retained in `rejected/watch/`, and the approved candidates used
edge-connected alpha-only cleanup with RGB artwork and 1254×1254 geometry
preserved. `watch_02` arrived as native RGBA and only sub-threshold alpha was
normalized.

No production asset was replaced and no runtime integration was performed.
The application build passes, and the complete automated suite passes 152 / 152.
