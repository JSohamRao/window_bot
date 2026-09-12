# Phase 11.5 — production sprite integration

Status: **COMPLETE — USER RUNTIME VISUAL CHECK RECOMMENDED**

## Integrated artwork

- Copied all 116 approved 1254×1254 RGBA PNGs into
  `assets/thukuna/animations/` without removing the seven legacy fallback
  files.
- Replaced the legacy seven-image runtime mapping with the approved Idle,
  Crawl, Sprint, Jump, Hop, Fall, Climb, Perch, Sleep, Watch, Laugh, Angry,
  Rage, Fall Over, and Domain families.
- Every approved frame is referenced by the TypeScript animation library and
  copied into `dist/assets/thukuna/animations/` during the existing build.

## Timing and anchors

- All production frames use scale `1`; animation never compensates by growing
  or shrinking the common canvas.
- Grounded frames use small alpha-bound-derived contact offsets.
- Air frames use `AIR`; edge climbing uses `CLIMB_LEFT` and mirrors through the
  existing direction layer; perching uses `PERCH`; Domain and Fall Over use
  `CENTER`.
- Dedicated Fall landing art is selected when a real fall reaches its landing
  phase.
- Sleep now plays its approved waking poses during the final 510 ms before the
  existing state transition.
- Domain totals exactly 3400 ms: charge/aura 900 ms, expansion 700 ms, peak
  800 ms, collapse 400 ms, and recovery/idle return 600 ms.

## Size-stability work

The old CSS Rage scaling, Fall Over rotation, Domain phase scaling, Domain peak
shake, and synthetic Domain ring were removed because the approved sprites now
encode those visuals. This prevents a second transform from enlarging or
rotating artwork on top of the fixed-scale frame layer.

Hidden runtime mode now explicitly pauses a pending multi-frame animation RAF
in addition to the existing behavior suspension. No BrowserWindow dimension,
pet-stage dimension, movement trajectory, gravity, cursor rule, IPC channel,
platform adapter, or FSM priority was changed.

## Verification

- Complete art validation: 116 / 116, pass.
- Exact duplicate scan: none.
- Previously reviewed intentional near-pairs only: Idle/Blink and Watch.
- TypeScript and renderer bundle build: pass.
- Built production sprite count: 116.
- Automated suite: 158 / 158 pass.
- Added coverage for total integrated asset count and existence, fixed scale,
  Domain timeline, special anchors, dedicated Fall landing frames, and absence
  of duplicate sprite-plus-CSS growth effects.

The Codex-hosted native smoke launch could not reach the renderer because its
Electron GPU subprocess exited with Windows status `0xC0000135`, including with
software-rendering flags. This happened before THUKUNA app code loaded and does
not invalidate the successful build/tests, but a normal interactive
`npm run dev` visual pass is still recommended on the user's desktop.
