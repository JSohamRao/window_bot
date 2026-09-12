# THUKUNA Phase 11.4–11.5 art workspace

This directory remains the review and provenance source. Phase 11.5 copied the
116 approved PNGs into `assets/thukuna/animations/`; the Electron application
loads those production copies through the TypeScript animation manifest.

Pipeline:

`generated/` -> file validation -> visual review -> `approved/thukuna/` or `rejected/`

The immutable identity reference is `references/current_canonical_base.png`.
Every generated family must return to that reference rather than using a prior
generated frame as its identity source.

Commands (run from the project root):

- `npm run validate:art` validates the eventual complete 116-frame library.
- `npm run validate:art:batch -- idle` validates one completed batch.
- `npm run analyze:art` writes alpha-bound JSON and CSV reports.
- `npm run contact-sheet:art -- idle` creates a review sheet for one family.
- `npm run duplicate-check:art -- idle` reports exact and near duplicates.

Candidate generation is human-reviewed. A frame is copied to `approved/` only
after its identity, temporal continuity, transparency, crop, and scale pass.
Final durations, fixed scale, anchors, and contact-point offsets live in
`src/renderer/animations/thukunaAnimations.ts`.
