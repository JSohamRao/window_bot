# Batch 06 — Fall / Land review

Status: **READY FOR USER VISUAL APPROVAL**

## Approved sequence

Six ordered poses: initial fall, stronger fall, goofy panic, pre-impact brace,
compressed landing impact, and recovery.

- Five frames are genuine reference-guided generations from the canonical base.
- `fall_06` is the unchanged canonical base, providing an exact recovery target.
- Every falling pose remains upright and gravity-driven; there is no tipping,
  tumbling, lying down, or other overlap with the future Fall Over animation.
- The artwork represents pose only; no trajectory, ground, dust, debris, or
  physics was baked into any frame.

## Validation

- Required count: 6 / 6.
- Valid square 1254×1254 RGBA PNGs with non-empty alpha: pass.
- Exact duplicates within Fall: none.
- Suspicious near duplicates within Fall: none.
- Character identity: pass for proportions, hair, eyes, markings, grin, teeth,
  scarf, limbs, claws, linework, shading, and palette.
- Sequence continuity: pass from loss of support through accelerating descent,
  panic, brace, impact, and recovery.
- `fall_05` uses strong upright compression; `fall_06` returns to canonical
  framing.

Four accepted generations returned opaque checkerboard previews. Their sources
were retained in `rejected/fall/`, and the approved candidates used
edge-connected alpha-only cleanup with RGB artwork and 1254×1254 geometry
preserved. `fall_04` arrived as native RGBA and only sub-threshold alpha was
normalized.

No production asset was replaced and no runtime integration was performed.
The application build passes, and the complete automated suite passes 152 / 152.
