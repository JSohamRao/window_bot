# Batch 01 — Idle / Blink review

Status: **READY FOR USER VISUAL APPROVAL**

## Approved candidates

1. `idle_01.png` — byte-identical copy of the canonical production base.
2. `idle_02.png` — genuine reference-guided generation; subtle idle/breathing variation.
3. `blink_01.png` — genuine reference-guided closed-eye generation.
4. `blink_02.png` — genuine reference-guided reopening-eye generation.

The two blink generations returned opaque RGB files with a baked transparency
preview. Those originals were rejected. Their artwork was recovered without
drawing, resizing, repositioning, or changing color pixels by transferring the
canonical frame's aligned alpha channel to clean RGBA candidates. The rejected
source files remain in `rejected/idle/` for audit.

## Automated checks

- Required count: 4 / 4.
- PNG decode: pass.
- Square canvas: pass (all 1254 × 1254).
- Alpha channel: pass.
- Non-empty visible alpha bounds: pass.
- Exact duplicate detection: none.
- Near-duplicate review: expected warnings for subtle blink frames; all frames
  contain meaningful eye-state progression and count separately.
- Alpha bounds: stable; all tops and bottoms match, and horizontal drift is at
  most 8 pixels in the subtle breathing frame.

## Manual visual review

- Character identity: pass for hair, proportions, eyes, markings, grin, teeth,
  scarf, limbs, claws, outline, shading, and palette.
- Sequence continuity: pass (`idle_01 → idle_02 → blink_01 → blink_02`).
- Scale and framing: pass.
- Cropping/scenery/text/watermark: pass.

No production asset was replaced and no runtime integration was performed.
