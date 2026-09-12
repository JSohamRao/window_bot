# Batch 07 — Climb review

Status: **READY FOR USER VISUAL APPROVAL**

## Approved sequence

Ten ordered poses: enter invisible edge, secure grip, first pull, alternate grip,
leg push, alternate pull, gathered grip, upward advance, endpoint hold, and exit.

- All ten frames are genuine reference-guided generations from the canonical
  base.
- Attached poses use the viewer-left invisible contact edge consistently and
  keep THUKUNA's body to its right.
- Grip and leg phases alternate to create readable upward locomotion rather than
  a collection of unrelated reaching poses.
- No wall, edge line, ledge, scenery, trajectory, dust, or physics was baked
  into any frame.
- The sequence is suitable for horizontal mirroring for the opposite edge.

## Validation

- Required count: 10 / 10.
- Valid square 1254×1254 RGBA PNGs with non-empty alpha: pass.
- Exact duplicates within Climb: none.
- Suspicious near duplicates within Climb: none.
- Character identity: pass for proportions, hair, eyes, markings, grin, teeth,
  scarf, limbs, claws, linework, shading, and palette.
- Sequence continuity: pass from approach through alternating grips, pulls,
  endpoint hold, and release.
- `climb_10` visibly releases from the contact side without becoming a fall,
  jump, or tumble.

Eight accepted generations returned opaque checkerboard previews. Their sources
were retained in `rejected/climb/`, and the approved candidates used
edge-connected alpha-only cleanup with RGB artwork and 1254×1254 geometry
preserved. Two frames arrived as native RGBA and only sub-threshold alpha was
normalized.

No production asset was replaced and no runtime integration was performed.
The application build passes, and the complete automated suite passes 152 / 152.
