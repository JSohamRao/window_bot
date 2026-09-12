# Batch 03 — Sprint review

Status: **READY FOR USER VISUAL APPROVAL**

## Approved candidates

Six dedicated Sprint frames: hard contact A, compression, push/extension, low
airborne pass, opposite hard contact, and recovery/pass back to frame 1.

All six are separate built-in image-generation edits using the canonical THUKUNA
as the identity reference. Crawl frames were used only as limb-organization pose
guides; Sprint adds stronger forward lean, larger reach, wider extension, and a
brief low airborne phase.

## Transparency handling

- `sprint_04` and `sprint_06` arrived as native-alpha RGBA PNGs.
- `sprint_01`, `sprint_02`, `sprint_03`, and `sprint_05` arrived with opaque
  neutral preview backdrops. Their originals remain in `rejected/sprint/`.
- Those four accepted candidates use audited edge-connected neutral background
  extraction. Only alpha was added; RGB artwork and 1254×1254 geometry were not
  resized, repositioned, redrawn, or recolored.

## Validation

- Required count: 6 / 6.
- Valid PNG, square canvas, alpha, and non-empty bounds: pass.
- Exact duplicates: none.
- Suspicious near duplicates within Sprint: none.
- Character consistency: pass.
- Sequence continuity: pass; frame 5 intentionally carries a stronger diagonal
  lean to sell the opposite high-speed contact.
- Distinct from Crawl: pass.

No production assets or runtime behavior were modified. Phase 11.5 remains
unstarted.
