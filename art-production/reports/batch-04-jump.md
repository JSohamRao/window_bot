# Batch 04 — Jump review

Status: **READY FOR USER VISUAL APPROVAL**

## Approved sequence

Ten ordered poses: anticipation, deep crouch, takeoff, early ascent, late ascent,
compact apex, early descent, strong descent, landing impact, and recovery.

- Nine frames are genuine reference-guided generations from the canonical base.
- `jump_10` is the unchanged canonical base, providing an exact recovery target.
- The artwork represents pose only; no trajectory, ground, dust, or physics was
  baked into any frame.

## Validation

- Required count: 10 / 10.
- Valid square 1254×1254 RGBA PNGs with non-empty alpha: pass.
- Exact duplicates within Jump: none.
- Suspicious near duplicates within Jump: none.
- Character identity: pass for proportions, hair, eyes, markings, grin, teeth,
  scarf, limbs, claws, linework, shading, and palette.
- Sequence continuity: pass from compression through airborne phases and impact.
- `jump_09` uses intentional squash-and-spread impact exaggeration; `jump_10`
  returns to canonical framing.

One otherwise acceptable crouch generation returned an opaque neutral preview.
Its source was moved to `rejected/jump/`, and the accepted candidate used
edge-connected alpha-only cleanup with RGB artwork and geometry preserved.

No production asset was replaced and no runtime integration was performed.
