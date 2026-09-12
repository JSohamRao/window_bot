# Batch 02 — Crawl review

Status: **READY FOR USER VISUAL APPROVAL**

## Approved candidates

- Eight ordered RGBA PNGs: contact A, compression A, push A, passing A→B,
  contact B, compression B, push B, passing B→A.
- `crawl_01` and `crawl_05` are unchanged copies of the two current production
  crawl contact poses.
- The other six poses are genuine reference-guided generations tied to the
  canonical identity and the two contact anchors.

## Rejections and cleanup

- Four generated files were rejected because they returned opaque RGB preview
  backdrops (`crawl_04` draft/extraction and two `crawl_08` drafts).
- `crawl_04` was regenerated successfully with native alpha.
- The visually accepted `crawl_08` source required edge-connected neutral
  backdrop extraction. This changed alpha only; RGB artwork and 1254×1254
  geometry were preserved. The opaque source remains under `rejected/crawl/`.
- Native-alpha generated frames had only sub-8/255 alpha speckles removed; no
  repositioning or resizing was performed.

## Validation

- Required count: 8 / 8.
- Valid PNG, square 1254×1254 canvas, alpha, and visible bounds: pass.
- Exact duplicates: none.
- Suspicious near duplicates within Crawl: none.
- Character identity: pass for hair, markings, eyes, grin, teeth, scarf, body,
  claws, linework, shading, and palette.
- Sequence continuity: pass for alternating limb progression and loop return.
- Scale/framing: stable enough for Phase 11.4; precise anchors and offsets remain
  deferred to Phase 11.5 as required.

No production asset was replaced and no runtime integration was performed.
