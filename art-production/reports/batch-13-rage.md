# Batch 13 — Rage review

Status: **READY FOR USER VISUAL APPROVAL**

## Approved sequence

Nine ordered poses: Rage entry, escalation, tension, stronger Rage, peak,
shake A, shake B, exit, and recovery.

- `rage_01` snaps into a wider, harder brace than peak Angry.
- `rage_02` compresses farther and introduces a few tight dark-crimson wisps.
- `rage_03` reaches the lowest contained-tension crouch.
- `rage_04` releases upward with raised spread claws and a broken local halo.
- `rage_05` reaches the full-body peak with the widest roar and strongest halo.
- `rage_06` and `rage_07` form opposing left/right full-body shake poses with
  the energy swept in the opposite direction.
- `rage_08` drops the shoulders and reduces the halo to fading wisps.
- `rage_09` removes the energy entirely and settles into tired irritation.
- Every pose preserves exactly two blocky front teeth and one red tongue in the
  recognizable THUKUNA mouth.
- Cursed energy stays dark crimson, broken, local to the silhouette, and
  transparent between wisps; it never becomes scenery or obscures THUKUNA.
- No text, symbols, tears, sweat, scenery, floor, shadow, props, lightning,
  solid energy rings, or full-screen effects were baked into the frames.

## Validation

- Required count: 9 / 9.
- Valid square 1254×1254 RGBA PNGs with non-empty alpha: pass.
- Exact duplicates involving Rage: none.
- Suspicious near-duplicates involving Rage: none.
- Character identity: pass for enormous-head/tiny-body proportions, hair,
  markings, eyes, mouth, teeth, tongue, scarf, limbs, claws, linework,
  shading, and canonical palette.
- Sequence continuity: pass from entry through compression, release, peak,
  opposing shake, collapse, and recovery.
- Intensity boundary: pass; Rage is pose-driven and visibly stronger than
  Angry, while its local wisps remain distinct from Domain Expansion.

Eight accepted generations returned opaque checkerboard previews. Their
sources were retained in `rejected/rage/`, and the approved candidates used
edge-connected alpha-only cleanup with RGB artwork and 1254×1254 geometry
preserved. `rage_02` arrived as native RGBA and only sub-threshold alpha was
normalized.

No production asset was replaced and no runtime integration was performed.
The application build passes, and the complete automated suite passes 152 / 152.
