# THUKUNA

Version 0.1.0 of a cross-platform-ready desktop pet built with Electron and TypeScript.

## Development workspace

The developer-selected checkout containing this README and `package.json` is the authoritative THUKUNA workspace. Run development, test, packaging, and report commands from that checkout; repository scripts resolve paths relative to their own location and must not depend on a previous absolute folder path. This project is currently maintained as a non-Git folder, so retain an independent backup when making major changes.

## Windows installation

The Windows x64 release is distributed as `THUKUNA-Setup-0.1.0.exe`. Run the assisted installer, choose the installation folder if desired, and launch THUKUNA from the Start menu or desktop shortcut. THUKUNA remains available from its system-tray icon when the pet window is hidden or closed; tray **Quit** fully exits it. The optional **Launch on startup** setting points to the installed executable and only one THUKUNA instance is allowed at a time.

This first release is unsigned, so Microsoft Defender SmartScreen may show an **Unknown publisher** warning. Confirm that the installer came from the expected THUKUNA release before choosing **More info → Run anyway**. Uninstall through Windows **Installed apps**. Uninstalling preserves the small settings file in the Windows user-data directory so preferences can survive a reinstall.

For contributors, `npm run package:win` performs a clean production build and writes the x64 NSIS installer to `release/`. Production packages omit tests, source maps, development controls, art-production files, soak/profile data, and TypeScript sources.

Clean release verification:

```powershell
npm ci
npm run build
npm test
npm run package:win
npm run audit:release
```

## Run it

```powershell
npm install
npm run dev
```

Thukuna opens in a 180×250 transparent, frameless, always-on-top window. The lower 180×180 stage keeps him anchored to the desktop floor; the transparent space above it safely holds one reusable dialogue bubble. He starts idle near the bottom-right of the primary monitor, then autonomously blinks, crawls, stares, laughs, becomes angry, and sleeps at calm randomized intervals.

Movement is two-dimensional, velocity-based, delta-time driven, and throttled to at most 30 secure IPC requests per second. THUKUNA can crawl, hop, jump through a gravity-driven arc, fall, land, climb an attached screen edge, and perch. The Electron main process validates bounded `dx`/`dy` requests, locks the window at 180×250, and clamps every position to the active display's usable work area. Dragging begins after 6 pixels of pointer travel and never counts as a click. Clicks inside a three-second sequence escalate at 3, 5, and 10 clicks from annoyed to angry to Rage.

Thukuna also has a lightweight in-memory personality simulation. Irritation, energy, boredom, and chaos remain between 0 and 100, drift slowly with elapsed time, react to clicks and dragging, and bias autonomous state weights. Personality updates at 4 Hz inside the existing behavior loop, performs no disk or network activity, and resets when the app restarts.

While idle, Thukuna checks the cursor at a randomized low rate (one sample every 1.2–2 seconds). A nearby cursor may make him watch it briefly and pursue it with a grounded crawl, hop, jump, attached edge climb, or safe drop rather than flying. Watching samples at 8 Hz and chasing at 10 Hz; sleeping, dragging, Rage, other autonomous states, and paused autonomy perform no cursor sampling. The renderer receives cursor coordinates only through a narrow, validated preload API—there are no global hooks and Thukuna never moves or captures the real cursor.

Phase 8 adds deliberately rare cosmetic events: Sprint, Fall Over, Creepy Freeze, Zoom Stare, Chaos Run, and a local-only fake Domain Expansion. A lightweight elapsed-time scheduler checks no sooner than every 45–150 seconds depending on chaos, does not guarantee an event at each check, and enforces global and per-event cooldowns. Events normally begin only from idle. They use the existing movement loop or one permanent renderer event layer, and drag, Rage, click reactions, sleep, and paused autonomy remain authoritative.

Phase 9 adds a native tray and persistent settings without adding a settings window, renderer, worker, watcher, or polling loop. The Electron main process owns the tray and the validated JSON store in Electron's platform-appropriate user-data directory; the renderer receives only typed snapshots and updates through the sandboxed preload bridge. Settings use queued atomic temp-file replacement and are written only after an actual user change.

The tray can show/hide the existing pet window, pause/resume autonomy, toggle dialogue, mouse awareness, rare events, Chaos Mode, Low Power Mode, always-on-top, launch-on-startup, reset the pet to a safe floor position, or explicitly quit. Unsupported platform actions remain visible but disabled. Normal window close is treated as hide-to-tray; only tray Quit tears down the process. Hidden mode pauses personality drift and all renderer behavior work until the existing window is shown again.

Chaos Mode applies bounded modifiers to existing behavior: moderately more activity, 30% shorter rare-event intervals, a capped probability boost, slightly more cursor curiosity, and at most 10–15% movement boosts. It never bypasses cooldowns or overwrites the internal personality chaos value. Low Power Mode is mutually exclusive with Chaos Mode, disables cursor awareness and rare events, reduces personality updates from 4 Hz to 1 Hz, removes idle/sleep procedural motion, makes crawling extremely unlikely and slower, and strongly favors idle/sleep. Clicks, dragging, and intentional Rage remain available.

## Development controls

Development shortcuts are local to the THUKUNA renderer; there is no global keyboard hook. Because the frameless window is initially shown without stealing focus, **click THUKUNA once before using shortcuts**. Press `D` to show the diagnostic overlay and its compact clickable command panel; panel buttons use the same controller and command IDs as keyboard shortcuts, so they work even when keyboard focus is awkward. Every recognized command appears as `ACCEPTED` or `REJECTED` with a precise reason. The single authoritative registry is `src/renderer/dev/devCommandRegistry.ts`, and automated tests keep this table synchronized with it.

| Action | Shortcut | Preconditions | Expected result | Common rejection reasons |
|---|---|---|---|---|
| Diagnostics | `D` | Pet window focused | Overlay toggles | — |
| Idle | `Shift+1` | Not dragging | IDLE | `DRAG_ACTIVE` |
| Crawl | `Shift+2` | Ground movement capability; not dragging | CRAWLING start/loop/stop | `MOVEMENT_CAPABILITY_DISABLED`, `DRAG_ACTIVE` |
| Sprint | `Ctrl+Shift+1` | Window movement capability; not dragging | SPRINT | capability or lifecycle rejection |
| Jump | `Ctrl+Shift+J` | Grounded; Jump capability | JUMPING | `NOT_GROUNDED`, capability |
| Jump Left | `Ctrl+Shift+Left` | Grounded; Jump capability | JUMPING left | `NOT_GROUNDED`, capability |
| Jump Right | `Ctrl+Shift+Right` | Grounded; Jump capability | JUMPING right | `NOT_GROUNDED`, capability |
| Hop | `Ctrl+Shift+H` | Grounded; Hop capability | HOPPING | `NOT_GROUNDED`, capability |
| Fall | `Ctrl+Shift+F` | Elevated; gravity movement allowed | FALLING | `NOT_ELEVATED`, capability |
| Climb Up | `Ctrl+Shift+Up` | Near screen edge; Climb capability | CLIMBING up | `NOT_NEAR_EDGE`, capability |
| Climb Down | `Ctrl+Shift+Down` | Near screen edge; Climb capability | CLIMBING down | `NOT_NEAR_EDGE`, capability |
| Perch | `Ctrl+Shift+P` | Near screen edge; Perch capability | PERCHED | `NOT_NEAR_EDGE`, capability |
| Drop | `Ctrl+Shift+D` | Currently perched; gravity allowed | FALLING | `NOT_PERCHED`, capability |
| Watch Cursor | `Shift+M` | Cursor capability; not dragging | WATCHING_CURSOR | capability or lifecycle rejection |
| Chase Cursor | `Shift+C` | Cursor chase capability; not dragging | CHASE_MOUSE | capability or lifecycle rejection |
| Sleep | `Shift+6` | Not dragging | SLEEPING | `DRAG_ACTIVE` |
| Wake | `Shift+7` | Currently sleeping | Wake/recovery then IDLE | `NOT_SLEEPING` |
| Laugh | `Shift+4` | Not dragging | LAUGHING | `DRAG_ACTIVE` |
| Angry | `Shift+5` | Not dragging | ANGRY enter/loop/exit | `DRAG_ACTIVE` |
| Rage | `Shift+R` | Not dragging | Canonical RAGE | `DRAG_ACTIVE` |
| Fall Over | `Ctrl+Shift+2` | Renderer active; not dragging | FALL_OVER | lifecycle or drag rejection |
| Creepy Freeze | `Ctrl+Shift+3` | Renderer active; not dragging | CREEPY_FREEZE | lifecycle or drag rejection |
| Zoom Stare | `Ctrl+Shift+4` | Renderer active; not dragging | ZOOM_STARE | lifecycle or drag rejection |
| Chaos Run | `Ctrl+Shift+5` | Window movement capability; not dragging | CHAOS_RUN | capability or lifecycle rejection |
| Domain Expansion | `Ctrl+Shift+6` | Renderer active; all 20 Domain assets ready; not dragging | Canonical 3400 ms Domain | asset, lifecycle, or drag rejection |
| Reset Position | `Ctrl+Shift+0` | Reset capability; not dragging | Safe floor position | `RESET_UNAVAILABLE`, `DRAG_ACTIVE` |
| Force Landing | `Ctrl+Shift+L` | Gravity movement allowed | LANDING | capability rejection |

Supplementary registry-backed controls remain available:

| Action | Shortcut | Action | Shortcut |
|---|---|---|---|
| Toggle Autonomy | `A` | Toggle Animation | `Space` |
| Preview Idle | `1` | Preview Blink | `2` |
| Preview Crawl Sprites | `3` | Preview Laugh | `4` |
| Preview Angry | `5` | Preview Sleep | `6` |
| Face Left | `Left` | Face Right | `Right` |
| Show Dialogue | `Shift+B` | Hide Dialogue | `Shift+X` |
| Increase Irritation | `Ctrl+Alt+I` | Decrease Energy | `Ctrl+Alt+E` |
| Increase Boredom | `Ctrl+Alt+B` | Increase Chaos | `Ctrl+Alt+C` |
| Reset Personality | `Ctrl+Alt+0` |  |  |

Plain `3` is deliberately labelled **Preview Crawl Sprites** and never moves the window; use `Shift+2` for the full Crawl behavior. Development behavior commands intentionally bypass product policy only: autonomy pause, the rare-event and mouse-awareness settings, Low Power suppression, scheduler randomness, and cooldowns. They still use the canonical controller/state/event paths and never bypass dragging, lifecycle/visibility requirements, hard platform capabilities, native Wayland restrictions, required edge/ground/perch geometry, Domain asset validation, or window bounds. Normal autonomous product behavior is unchanged. One-shot commands ignore key repeat.

The diagnostic overlay reports the input source, last key/command/result/rejection reason, development-override flag, typed execution trace, requested and actual state/animation, frame/scale/anchor, actual window and stage size, movement mode and velocity, platform capabilities, power mode, left/right edge status, cursor dx/dy/same-display state, cursor planner result, query counts, and Domain elapsed time/stage/global frame/event transform/activation/cleanup counts. It adds no timer, RAF, process, polling loop, or cursor sampling.

Animation definitions accept per-frame offsets, fixed scale, named anchors, and duration overrides. These values live in the TypeScript manifest and are applied only to the dedicated frame layer. Transition and behavior sequencing shares the existing renderer RAF.

## Phase 11.5 sprite integration

The visually approved 116-frame THUKUNA library is deployed under `assets/thukuna/animations/` and mapped by the existing TypeScript animation manifest. Every production frame keeps a fixed scale of `1`; small offsets align ground, air, climb, perch, and center contact anchors without resizing the artwork. Dedicated sprite sequences now drive idle/blink, crawl, sprint, jump, hop, fall/landing, climb, perch, sleep/wake, cursor watch, laugh, angry, Rage, Fall Over, and the full 3.4-second Domain Expansion timeline.

| Production family | Frames |
|---|---:|
| Idle / Blink | 4 |
| Crawl | 8 |
| Sprint | 6 |
| Jump | 10 |
| Hop | 10 |
| Fall / Land | 6 |
| Climb | 10 |
| Perch | 6 |
| Sleep / Wake | 8 |
| Watch Cursor | 4 |
| Laugh | 3 |
| Angry | 6 |
| Rage | 9 |
| Fall Over | 6 |
| Domain Expansion | 20 |
| **Total** | **116** |

The runtime asset tree is `assets/thukuna/animations/<family>/<frame>.png`. Frame source, duration, offset, scale, anchor, loop, and motion metadata are defined in `src/renderer/animations/thukunaAnimations.ts`; audit measurements for the approved source art remain under `art-production/reports/` and are not copied into the production build.

Asset loading is **eager**: `AssetManager` preloads and decodes the production sprite library during renderer startup, including rare and climb/perch frames. Low Power mode reduces runtime work and blocks costly behaviors, but it does not currently make startup decoding lazy. A lazy/on-first-use redesign is intentionally deferred until trustworthy startup or memory measurements justify changing the architecture.

Rage, Fall Over, and Domain no longer add CSS scale/rotation effects on top of their sprite artwork. This prevents transform accumulation and click/drag size growth while retaining the existing FSM, locomotion, window geometry, IPC, platform adapters, and one-renderer architecture.

## Phase 11 platform support

THUKUNA now selects one main-process platform adapter once during startup. The renderer receives a read-only capability snapshot through the validated preload bridge; it never receives Node, filesystem, process, or raw Electron access.

| Environment | Locomotion capability |
|---|---|
| Windows 10/11 | Full 2D movement, cursor chase, edge climbing, perching, reset, tray and autostart |
| Linux X11 | Full platform architecture where Electron exposes the expected APIs |
| Linux XWayland | Full platform architecture where Electron exposes the expected APIs |
| Native Wayland | Limited mode: local animations, FSM, personality, dialogue, clicks, Rage, Domain, local rare events, settings, tray/autostart where available |
| Unknown Linux display session | Same conservative limited mode as native Wayland |

Native Wayland limited mode disables autonomous BrowserWindow roaming, gravity-driven window movement, jumps, climbing, exact perching, absolute cursor tracking/chase, moving rare events, and Reset Position. It does not repeatedly probe unsupported APIs. Stored settings are preserved so the same profile works again under X11 or XWayland.

Linux display detection uses `XDG_SESSION_TYPE`, `WAYLAND_DISPLAY`, `DISPLAY`, and explicit Electron/Ozone hints conservatively. Linux autostart uses an atomically replaced XDG desktop entry only when the setting changes. Paths use Electron and Node path providers; launcher foundations use executable/argument arrays with `shell: false`.

Press `D` to see platform, display server, absolute movement, cursor, climbing, perching, autostart, and tray capabilities alongside the existing diagnostics.

## Verify it

```powershell
npm test
npm run build
```
