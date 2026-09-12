# Batch 09 — Sleep / Wake review

Status: **READY FOR USER VISUAL APPROVAL**

## Approved sequence

Eight ordered poses: tired, lowering, lie down, fully asleep, breathing asleep,
waking, supported rise, and recovered idle.

- Seven frames are genuine reference-guided generations from the canonical base.
- `sleep_08` is the unchanged canonical base, providing an exact recovery target.
- Frames 1–3 progressively lower onto one invisible ground baseline rather than
  instantly swapping from upright to lying.
- Frames 4–5 form a deliberately subtle closed-eye breathing pair.
- Frames 6–7 reverse the transition through waking in place and a supported
  rise before canonical recovery.
- No floor, pillow, bed, blanket, moon, Z symbol, text, scenery, shadow, breath
  cloud, or prop was baked into any frame.

## Validation

- Required count: 8 / 8.
- Valid square 1254×1254 RGBA PNGs with non-empty alpha: pass.
- Exact duplicates within Sleep / Wake: none.
- Suspicious near duplicates within Sleep / Wake: none.
- Character identity: pass for proportions, hair, eyes, markings, distinctive
  mouth, two teeth, tongue, scarf, limbs, claws, linework, shading, and palette.
- Sequence continuity: pass from fatigue through sleeping, breathing, waking,
  rising, and recovery.

Five accepted generations returned opaque checkerboard previews. Their sources
were retained in `rejected/sleep/`, and the approved candidates used
edge-connected alpha-only cleanup with RGB artwork and 1254×1254 geometry
preserved. Two generated frames arrived as native RGBA and only sub-threshold
alpha was normalized.

No production asset was replaced and no runtime integration was performed.
The application build passes, and the complete automated suite passes 152 / 152.
