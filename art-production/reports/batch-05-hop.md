# Batch 05 — Hop review

Status: **READY FOR USER VISUAL APPROVAL**

## Approved sequence

Ten ordered poses: small crouch, playful anticipation, light takeoff, low
airborne, airborne tuck, brief apex, short descent, near-ground brace, soft
landing impact, and recovery.

- Nine frames are genuine reference-guided generations from the canonical base.
- `hop_10` is the unchanged canonical base, providing an exact recovery target.
- The artwork represents pose only; no trajectory, ground, dust, or physics was
  baked into any frame.
- Compression, airborne extension, height cues, and landing squash are all
  intentionally smaller than the approved Jump sequence.

## Validation

- Required count: 10 / 10.
- Valid square 1254×1254 RGBA PNGs with non-empty alpha: pass.
- Exact duplicates within Hop: none.
- Suspicious near duplicates within Hop: none.
- Character identity: pass for proportions, hair, eyes, markings, grin, teeth,
  scarf, limbs, claws, linework, shading, and palette.
- Sequence continuity: pass from shallow anticipation through compact apex and
  gentle landing.
- `hop_09` uses a subtle springy landing squash; `hop_10` returns to canonical
  framing.

The landing generation returned an opaque checkerboard preview. Its source was
retained in `rejected/hop/`, and the accepted candidate used edge-connected
alpha-only cleanup with RGB artwork and 1254×1254 geometry preserved.

No production asset was replaced and no runtime integration was performed.
The application build passes, and the complete automated suite passes 152 / 152.
