# THUKUNA Beginner Guide — Phases 1 to 15

## Read this first

THUKUNA is a small animated character that lives in a transparent, always-on-top Windows desktop window. A “desktop pet” is not a wallpaper and not a normal application window: it has to draw a character with transparent surroundings, respond to clicks and drags, move safely around the usable desktop, animate smoothly, and remain polite when Windows locks, sleeps, changes displays, or switches power source.

The project uses Electron, TypeScript, HTML, and CSS. Electron combines Chromium (the browser engine that renders HTML/CSS) with Node.js-powered application infrastructure. THUKUNA deliberately divides that power into three areas:

- the **main process** is the trusted staff area. It creates native windows, owns system APIs, stores settings, and listens to Windows through Electron;
- the **preload** is a guarded service desk. It exposes a small list of validated operations to the UI;
- the **renderer** is the visitor area. It draws THUKUNA and runs behavior code, but has no raw Node.js or Electron access.

That separation is visible in `src/main`, `src/main/preload.ts`, and `src/renderer`. Shared message types live in `src/shared`. Approved PNG frames live under `assets/thukuna/animations`. Automated tests live in `tests`; build scripts live in `scripts`.

One historical fact matters: development through Phase 12 happened before Git history was initialized. The Phase 1–12 commits are honest reconstructed milestone markers based on surviving code, documentation, tests, and artifacts—not exact old source snapshots. Commit `0b1925286e0dff8c5c6bff532ac2fc27cd864d0d` is the first canonical source baseline and tag `v0.1.0-windows` identifies it. Phases 13–14 were deferred. Phase 15 is normal, genuine Git development on `phase-15-system-awareness`.

## The architecture in one picture

```text
┌───────────────────────────────────────────────────────────┐
│ Windows + Electron                                       │
│ cursor position, session, suspend, power, display areas  │
└──────────────┬────────────────────────────────────────────┘
               │ Electron APIs
               ▼
┌───────────────────────────────────────────────────────────┐
│ Main process                                              │
│ main.ts → PlatformService / SettingsStore / tray          │
│         → SystemAwarenessService                          │
│         → BrowserWindow movement and work-area clamping   │
└──────────────┬────────────────────────────────────────────┘
               │ narrow typed IPC
               ▼
┌───────────────────────────────────────────────────────────┐
│ preload.ts                                                │
│ validated `window.thukunaWindow` contextBridge API        │
└──────────────┬────────────────────────────────────────────┘
               │ ordinary safe JavaScript values
               ▼
┌───────────────────────────────────────────────────────────┐
│ Renderer                                                  │
│ pet.ts composition root                                   │
│ SystemAwarenessController → context/policy                │
│ Interaction / personality / rare events                   │
│ ThukunaController → existing StateMachine                 │
│ Movement + locomotion + animation                         │
└──────────────┬────────────────────────────────────────────┘
               │ HTML/CSS transforms + PNG frame
               ▼
┌───────────────────────────────────────────────────────────┐
│ 180×180 visible pet stage inside a 180×250 window         │
└───────────────────────────────────────────────────────────┘
```

## Phase 1 — Desktop foundation

Phase 1 established the unusual native window a desktop pet needs. `src/main/main.ts` waits for `app.whenReady()`, builds the platform service and settings, and calls `showThukuna()`. `createPetWindow()` in `src/main/petWindow.ts` constructs a `BrowserWindow` with a fixed 180×250 content size. It is frameless, transparent, not resizable, omitted from the taskbar, and normally always on top. `ready-to-show` uses `showInactive()`, so opening the pet does not steal keyboard focus from the user’s work.

The visible pet area is the 180×180 `#pet-stage` in `src/renderer/index.html`; the extra 70 vertical pixels provide dialogue space. `src/shared/windowGeometry.ts` is the canonical owner of these dimensions. The window and stage are separate because a speech bubble needs room without changing the actual character scale.

Security was part of the foundation, not a later patch. `petWindow.ts` sets `sandbox: true`, `contextIsolation: true`, and `nodeIntegration: false`. `index.html` adds a Content Security Policy that only permits local scripts, styles, and images (plus image data URLs). The renderer therefore cannot call `require`, inspect files, or invoke arbitrary Electron APIs.

Startup flow:

```text
npm start
  → TypeScript compilation and esbuild bundles
  → Electron loads dist/main/main.js
  → app.whenReady()
  → PlatformService + SettingsStore
  → createPetWindow()
  → preload.js creates guarded bridge
  → index.html + pet.js initialize renderer
  → assets preload
  → ThukunaController.start()
```

## Phase 2 — Dragging and desktop safety

Dragging begins as a normal `pointerdown` on `#pet-stage` in `src/renderer/pet.ts`. `InteractionController.pointerDown()` starts a possible pointer session. Movement must exceed the 6-pixel threshold from `INTERACTION_CONFIG.dragThresholdPx` before it becomes a drag; otherwise release can count as a click.

Once dragging is confirmed, the renderer calls `window.thukunaWindow.startDrag()`. The preload sends the typed `thukuna:drag-start` IPC message. `registerPetWindowIpc()` in `src/main/ipc.ts` verifies that the sender really is the pet window and validates finite screen coordinates. It records the pointer’s offset inside the fixed window. Later `thukuna:drag-move` messages ask `PlatformService.moveWindowTo()` to move the native window. The renderer batches pointer movement to one request per animation frame, avoiding a flood of IPC messages.

`BasePlatformAdapter.moveWindowTo()` asks Electron `screen` for the appropriate display, calls `clampWindowPosition()` from `src/main/windowBounds.ts`, and always restores exactly `PET_WINDOW_WIDTH` × `PET_WINDOW_HEIGHT`. `workArea` means the usable monitor rectangle excluding taskbars and similar reserved desktop UI. Clamping guarantees the pet remains recoverable at all four corners.

The earlier “pet grows every time I drag/click” bug illustrates transform ownership. A transform must not repeatedly include an already transformed result, and window dimensions must never be derived from sprite pixels. The current design fixes both: native movement always sets canonical dimensions, each visual effect owns one dedicated nested layer, and every production frame’s scale is exactly 1.

Drag flow:

```text
pointerdown → InteractionController starts candidate
pointermove > 6 px → renderer captures pointer
startDrag(screen point) → preload → ipc.ts validates sender/payload
moveDrag(screen point) → PlatformService → BasePlatformAdapter
clamp to workArea → BrowserWindow.setContentBounds(180×250)
pointerup → endDrag → interaction reaction → safe position sync
```

## Phase 3 — Sprite and animation engine

A sprite is one transparent PNG pose. Several poses shown in order create animation. `src/renderer/animations/thukunaAnimations.ts` maps semantic animation names such as `idle`, `crawl_loop`, and `domain_peak` to frame metadata. `AssetManager` preloads all referenced images, reports failures, and supplies a known idle fallback.

`AnimationController` owns the current animation, frame index, elapsed frame time, direction, playback queue, and one `requestAnimationFrame` loop. A frame can declare source path, duration, anchor, offsets, and scale. `normalizeSpriteFrame()` sanitizes metadata. Production integration tests enforce scale 1, so frame changes never make THUKUNA inflate.

Animation timing is delta-time based. If a frame lasts 120 ms, it advances after 120 ms of accumulated elapsed time, not after a fixed number of display refreshes. This makes animation speed approximately independent of a 60 Hz versus 144 Hz monitor. The animation clock caps a frame delta and, in Phase 15, can explicitly `rebaseClock()` after resume.

Direction flipping belongs to `direction-layer`; procedural motion belongs to `motion-layer`; click/rage visuals belong to `interaction-layer`; rare-event visuals belong to `event-layer`; locomotion tilt/pose belongs to `locomotion-visual-layer`; per-frame alignment belongs to `frame-layer`. Transform order matters because CSS transforms compose like nested coordinate systems. Keeping each responsibility on its own element prevents one effect from overwriting or multiplying another.

## Phase 4 — Autonomous finite-state machine

A finite-state machine (FSM) permits one defined behavior state at a time and provides explicit transitions. “Idle” and “Crawling” are states; “Idle → Crawling” is a transition. `StateMachine<StateName, Context>` in `src/renderer/engine/StateMachine.ts` calls the old state’s `exit`, the new state’s `enter`, and then the current state’s `update` on later ticks.

`ThukunaController` composes the real states from `src/renderer/states`: `IdleState`, `CrawlingState`, `SleepingState`, `StaringState`, `LaughingState`, `AngryState`, and later movement/event states. The FSM is valuable because the pet cannot safely be crawling, sleeping, dragged, and running Domain simultaneously.

`IdleState.enter()` plays idle animation, stops motion, chooses a 3–9 second duration, and enables low-rate cursor awareness when allowed. At the duration boundary it requests weighted behavior choices from `ThukunaController`. `calculateBehaviorWeights()` combines base weights with personality and recent-state suppression. A `RandomSource` is injected, so tests can make random choices deterministic.

An ordinary action is:

```text
IdleState reaches duration
  → getBehaviorWeights()
  → personality + recent behavior + power/system policy
  → weightedChoice selects CRAWLING
  → StateMachine.transition("CRAWLING")
  → CrawlingState.enter() chooses direction/speed and animation
  → MovementController sends bounded movement deltas
  → duration/boundary reached
  → crawl stop sequence
  → transition to IDLE
```

## Phase 5 — User interaction

`InteractionController` distinguishes clicks from drags, counts click combinations, controls dialogue, and asks the behavior port for reactions. The 6-pixel drag threshold prevents tiny hand movement from turning a click into a window drag. Clicks within a 3-second combo window reach annoyed at 3, angry at 5, and Rage at 10. Rage then has a 10-second cooldown.

Direct user input outranks ordinary autonomy. When a reaction begins, `ThukunaController.beginInteractionReaction()` cancels locomotion, stops movement, disables cursor tracking, and enters the reaction state or animation. `interactionOverride` allows the temporary reaction to progress even if the user has manually paused autonomy. That separation is important: “do not choose new autonomous actions” is different from “freeze every active reaction.”

Click flow:

```text
pointerdown + pointerup within 6 px
  → InteractionController registers click/combo
  → PersonalityController receives semantic effect
  → weighted visual/dialogue/strong reaction
  → ThukunaController temporary override
  → animation/dialogue appears
  → elapsed duration completes
  → cleanup and safe IDLE
```

Drag flow uses the native IPC path described in Phase 2. On release, `InteractionController` computes duration and total distance. A drag is “long” after 2 seconds or 500 pixels. Long and ordinary drops have different reaction weights and personality effects, then `ThukunaController.endDrag()` returns through Idle and synchronizes its movement model with the actual native position.

## Phase 6 — Personality

`PersonalityController` maintains four bounded session-only values from 0 to 100:

- **irritation** rises with repeated clicks and long dragging and can bias angry behavior;
- **energy** starts at 75, falls during movement, and recovers during sleep;
- **boredom** rises during inactivity and falls during varied activity;
- **chaos** slightly affects unusual behavior and rare-event frequency.

These values are not machine learning and are not a psychological profile. They are four numbers used in formulas. `PERSONALITY_DEFAULTS` starts them at 15/75/20/30; `PERSONALITY_CONFIG` defines small per-minute changes and semantic interaction effects. Values are not written to disk and are never sent anywhere.

Keep three concepts separate: **state** is what THUKUNA is doing now, **personality** is short-lived numeric context, and **policy** determines what work is currently allowed or favored. Phase 15 adds more policy context without corrupting personality or persisted settings.

## Phase 7 — Cursor awareness

The renderer cannot read global cursor coordinates directly. `CursorAwarenessController` therefore calls the narrow preload method `getCursorPosition()`. Main-side `BasePlatformAdapter.getCursorPosition()` reads Electron’s `screen.getCursorScreenPoint()`, compares the cursor display with the pet display, and returns only `{x, y, sameDisplay, supported}`.

There is no global mouse hook and no click/keystroke capture. The controller asks for coordinates only while a behavior needs them. Its modes are `OFF`, `IDLE`, `WATCH`, and `CHASE`: idle awareness samples about every 1.2–2 seconds, watching every 125 ms, and chasing every 100 ms. Phase 15 can multiply those intervals by as much as 3.75 under idle+battery context. A failed query disables tracking rather than creating a runaway retry loop.

The cursor flow is:

```text
Windows cursor → Electron screen API in main
  → validated invoke result in preload
  → CursorAwarenessController sample
  → distance, direction, same-display, dead-zone logic
  → WatchingCursorState or ChaseMouseState decision
  → existing animation/movement systems
```

Same-display checking avoids chasing across unrelated monitor coordinates. Distance and hysteresis avoid constant left/right flipping. `MovementPlanner` chooses a feasible plan; platform capability policy can permit watching while refusing movement on a platform that cannot safely position windows.

## Phase 8 — Rare events

`RareEventController` schedules six uncommon cosmetic behaviors: Sprint, Fall Over, Creepy Freeze, Zoom Stare, Chaos Run, and Domain Expansion. It uses elapsed time inside the existing renderer loop—not one independent timer per event. Checks normally occur after 45–150 seconds depending on chaos, and a check still has only a bounded occurrence chance. Global and per-event cooldowns stop repetition; Domain has a 420-second cooldown and base weight 3.

The scheduler is suspended during sleep, drag, Rage, hard system pause, disabled rare events, or other unsafe conditions. `forceStart()` is available to the internal developer runtime but Phase 15 prevents that development path from bypassing system lock or suspend.

An event owns entry, animation/movement, timed phases, exit, and cleanup. `EventVisualController.reset()` returns its dedicated layer to identity. Sprint and Chaos Run reuse `MovementController`; local events such as Domain can operate without native window movement. Interruptions call normal state exit cleanup rather than leaving transforms or timers behind.

## Phase 9 — Tray, settings, and user-selected power modes

`createThukunaTray()` builds the native tray menu. It can show/hide THUKUNA, toggle features, reset position, control Start with Windows, and quit. The tray is the lifecycle owner: closing the window normally hides it instead of terminating the application.

`SettingsStore` persists validated JSON in Electron’s user-data directory. It queues writes and writes a `.tmp` file before renaming it over the destination—an atomic replacement pattern that reduces corruption risk. It does not write when values are unchanged. `shared/settings.ts` defines defaults, accepted boolean keys, validation, and the rule that explicit Chaos and Low Power are mutually exclusive.

`PowerPolicyController` converts settings into Normal, Chaos, or Low Power runtime numbers. Normal preserves standard behavior. Chaos modestly increases active behavior. Explicit Low Power disables mouse awareness and rare events, favors rest, and reduces work. Phase 15 does **not** save Low Power merely because a laptop is on battery; user preference and transient system context remain separate.

## Phase 10 — Full two-dimensional movement

`MovementController` is the native-window velocity layer. It stores x/y velocity, fractional accumulation, work-area bounds, movement mode, and whether a request is in flight. It turns velocity × delta time into bounded `moveBy` IPC calls at at most 30 updates per second. IPC restricts each requested axis delta to 100 pixels, while main-side clamping remains the final safety boundary.

`LocomotionController` sequences semantic actions: Jump, Hop, Fall, Land, Climb, Perch, and Drop. Gravity is 920 px/s². A jump has preparation, airborne physics, and landing; climb requires proximity to a screen edge; perch stops movement; drop re-enters falling. `MovementMemory` records recent actions and cooldown timestamps so THUKUNA does not repeatedly jump or climb. `MovementPlanner` translates chase geometry into grounded, vertical, edge, drop, or watch plans.

Two-dimensional movement is not CSS motion alone. The actual `BrowserWindow` moves across desktop coordinates, while `locomotion-visual-layer` supplies temporary pose/rotation presentation. This separation prevents visual displacement from disagreeing with the real native window position.

The complete transform nesting in `index.html` is:

```text
pet-canvas
  → direction-layer
    → drag-layer
      → motion-layer
        → interaction-layer
          → event-layer
            → locomotion-visual-layer
              → frame-layer
                → img#thukuna
```

### Domain’s exact timeline

`DomainExpansionState` is a 3,400 ms local rare event. At 0 ms it freezes normal movement. Around 450 ms it requests the “DOMAIN EXPANSION.” dialogue; at 700 ms the aura phase is visible; at 900 ms expansion begins; at 1,600 ms it reaches peak; at 2,400 ms it collapses; at 2,800 ms it recovers; at 3,400 ms it cleans up and returns to Idle. The five animation groups are 900 + 700 + 800 + 400 + 600 ms and use exactly 20 dedicated Domain frames.

## Phase 11 — Platform abstraction

An adapter is a translator behind a common interface. Think of `PlatformAdapter` as a power-socket shape: the rest of the application plugs into the same socket while `WindowsPlatformAdapter` or `LinuxPlatformAdapter` translates to a platform. `BasePlatformAdapter` shares safe Electron screen/window code. `PlatformService` exposes the selected adapter, platform paths, shell launching, notifications, and capabilities to `main.ts`.

Capabilities such as absolute positioning, cursor coordinates, edge climbing, perching, autostart, tray, and notifications are explicit data. `resolveMovementCapabilityPolicy()` combines those hard capabilities with user mode. That stops unsupported behavior before it enters repeated failure loops.

X11 is the older Linux display protocol; Wayland is the newer security-focused protocol; XWayland runs X applications within a Wayland session. This vocabulary exists in detection and capability architecture, but Linux was not physically validated or released. That work remains V2. Phase 15 adds only a conservative unsupported awareness provider shape outside Windows; it does not claim Linux awareness support.

## Phase 11.4 — Sprite asset production

Artwork is engineering in a frame-based application because inconsistent canvas bounds, transparency, contact points, naming, or scale cause visible jumps. Phase 11.4 produced 116 approved sprites in 15 families:

| Family | Frames |
|---|---:|
| Idle/Blink | 4 |
| Crawl | 8 |
| Sprint | 6 |
| Jump | 10 |
| Hop | 10 |
| Fall/Land | 6 |
| Climb | 10 |
| Perch | 6 |
| Sleep/Wake | 8 |
| Watch Cursor | 4 |
| Laugh | 3 |
| Angry | 6 |
| Rage | 9 |
| Fall Over | 6 |
| Domain | 20 |

Production scripts under `art-production` validate frame counts, alpha bounds, duplicates, naming, and contact sheets. A production asset is a reviewed file in the canonical animation folders. Rejected or working assets are not silently substituted. Every integrated production frame retains scale 1.

## Phase 11.5 — Visual integration and stabilization

Phase 11.5 connected all 116 sprites to semantic states and stabilized sequences such as crawl start/loop/stop, climb exit, perch/drop, angry entry/loop/exit, Rage, and Domain. The developer command registry in `src/renderer/dev/devCommandRegistry.ts` provides one canonical definition per keyboard/panel command. `DevCommandController` handles dispatch and telemetry, `ThukunaDevCommandRuntime` validates preconditions and calls real controller paths, and `DevCommandPanel` provides clickable controls during development builds.

An important bug appeared when forced timed states stopped progressing while autonomy was paused. The cause was treating “autonomy paused” as “do not advance the state machine.” The correction separated choosing autonomous behavior from progressing an already forced state: `developmentOverrideActive` allows the forced state’s normal update/cleanup path to run without pretending persisted autonomy was enabled. Domain developer force also uses canonical cleanup and `RareEventController.forceStart()` rather than an animation-only preview.

Diagnostics show command recognition, rejection, actual state/animation, movement, cursor counts, rare events, geometry, and transforms. A 30-minute soak exercised repeated commands and observed stability over time. A soak can expose growth, leaks, duplicate listeners, or accumulated transforms; it cannot prove every OS-specific event or every possible race.

## Phase 12 — Windows release and packaging

`electron-builder` packages compiled output and approved runtime assets. ASAR is Electron’s application archive containing application code/resources; it is not `node_modules`, source art, or the installer. NSIS builds the Windows setup executable, creates shortcuts, supports per-user installation, and can launch THUKUNA after install.

`configureSingleInstance()` ensures a second launch focuses/shows the existing pet instead of creating another runtime. Runtime asset path helpers find the packaged tray/icon assets. Windows startup points to the installed executable, not a development `npm` command. Production bundling defines `__THUKUNA_PRODUCTION_BUILD__`, and developer controls are disabled in production.

Local runtime diagnostics rotate bounded files; they are not telemetry. The release audit checks packaging exclusions and canonical assets. The Phase 12 Windows x64 release is the `v0.1.0-windows` baseline.

The Codex-host environment previously failed to launch even minimal Electron apps. That is a host limitation, not evidence that THUKUNA requires weaker security. The project correctly refused `--no-sandbox`, `--disable-gpu-sandbox`, or changes to context isolation/node integration. Normal Windows validation remains the trusted GUI path.

## Phases 13 and 14 — intentionally deferred

Phase 13 (Linux core port/validation) and Phase 14 (Linux packaging/distribution) were moved to V2. Having adapter interfaces and conservative Linux capability code means the architecture anticipates a port; it does not mean Ubuntu, Debian, Arch, X11, XWayland, Wayland, AppImage, or `.deb` were validated or released.

## Phase 15 — System Awareness

System Awareness means understanding a few coarse operating-system conditions so the pet behaves safely. It is not content surveillance. THUKUNA observes session lock, suspend/resume, system idle duration/classification, AC/battery source, and display/work-area changes relevant to clamping. It does not observe application names, window titles, process lists, keystrokes, browser history, clipboard, microphone, camera, screenshots, network traffic, documents, file contents, location, or shell history.

### Shared model

`src/shared/systemAwareness.ts` defines readonly union types and `SystemAwarenessSnapshot`. Session is `active | locked | suspended`; activity is `active | idle | unknown`; power is `ac | battery | unknown`. The snapshot carries non-negative `idleSeconds`, `updatedAt`, capability flags, a last transition, whether the sampler is active, and listener count. `isSystemAwarenessSnapshot()` validates IPC values. `SYSTEM_IDLE_THRESHOLD_SECONDS` is 120, `SYSTEM_IDLE_SAMPLE_INTERVAL_MS` is 15,000, and transition history is capped by `SYSTEM_AWARENESS_HISTORY_LIMIT` at 20.

### Main-process service

`SystemAwarenessService` in `src/main/systemAwareness/SystemAwarenessService.ts` is the single owner. It registers six `powerMonitor` events (`lock-screen`, `unlock-screen`, `suspend`, `resume`, `on-battery`, `on-ac`) and three `screen` events (`display-added`, `display-removed`, `display-metrics-changed`). On supported Windows that is nine OS listeners and one idle interval—not one timer per feature.

`ElectronSystemAwarenessProvider` adapts real Electron objects to the service’s small injected `SystemAwarenessProvider` interface. Tests substitute fakes, so they can simulate lock or a two-hour sleep without controlling the developer’s computer. Non-Windows construction reports conservative unsupported capabilities and unknown values; no Linux behavior was implemented or claimed.

`start()` is idempotent, caches initial idle/power state, and creates only one interval. `dispose()` is also idempotent, clears the interval, and calls every stored unsubscribe function. Duplicate semantic events are suppressed. Idle seconds can refresh every 15 seconds, but unchanged measurements produce no event and do not manufacture transition-history entries.

Lock stops the idle interval and emits a locked snapshot. Suspend records whether the session was active or already locked, stops sampling, and emits suspended. Resume refreshes transient power/idle data, restarts one sampler only when the session is active, and preserves a pre-suspend lock until the real unlock event. Resume and display events ask `main.ts` to move the current bounds through the existing clamp path; they do not add a new monitor feature.

### Secure IPC and preload

`shared/ipcChannels.ts` adds only `thukuna:system-awareness-get` and `thukuna:system-awareness-changed`. `ipc.ts` verifies the requesting renderer belongs to the pet window before returning a snapshot. `preload.ts` validates both requested snapshots and change-event payloads, then exposes only:

```ts
getSystemAwareness(): Promise<SystemAwarenessSnapshot>
onSystemAwarenessChanged(listener): () => void
```

The renderer receives plain data and an unsubscribe function—not `powerMonitor`, `screen`, `ipcRenderer`, Node APIs, or a state-forgery endpoint.

### Renderer context and policy

`SystemAwarenessController` subscribes before requesting the initial snapshot so it cannot miss a transition between those operations. It rejects malformed or older snapshots, stores the current context, derives a small `SystemRuntimeContext`, and retains at most 20 deduplicated transitions for diagnostics. It is context, not a second behavior FSM.

`pet.ts` passes each accepted snapshot to `ThukunaController.applySystemAwareness()`. Hard safety wins over all product and developer choices:

```text
SUSPENDED > LOCKED > geometry recovery > user interaction
          > safe developer command > current reaction/event
          > idle/battery modifiers > normal autonomy
```

On lock/suspend, the renderer cancels an active pointer/drag session, dialogue, behavior and animation RAF work, cursor queries, motion, locomotion, interaction override, and rare-event scheduling. The FSM returns through canonical cleanup to safe Idle. `forceState`, `forceRareEvent`, cursor force, locomotion force, wake, drag, and reactions all check `systemRuntimePaused`. `ThukunaDevCommandRuntime` returns `SYSTEM_LOCKED` or `SYSTEM_SUSPENDED`; even the developer bypass cannot override hard safety. Diagnostics remains available because observing why a command is blocked is safe.

Idle and battery are soft. `PowerPolicyController.updateSystemAwareness()` temporarily reduces autonomous movement, lengthens Idle decisions and rare-event intervals, increases rest weights, and slows personality evaluation. `CursorAwarenessController.setIntervalMultiplier()` slows nonessential cursor queries: idle multiplies cadence by 2.5, battery by 1.5, and both by 3.75. Existing explicit Low Power remains stronger and still disables cursor/rare events. None of these methods calls `SettingsStore.update()`.

Example:

```text
persisted setting: CHAOS
system context: IDLE + BATTERY
effective runtime: CHAOS with conservative temporary multipliers

later AC + ACTIVE
effective runtime: ordinary CHAOS
persisted setting: still CHAOS
```

### Resume clock safety

Suppose the last behavior frame was at 10,000 ms and the machine sleeps for two hours. A naive next delta is about 7,200,000 ms. Feeding it to gravity or a timed state could teleport the window, expire many states, or trigger a burst.

Phase 15 hard pause cancels animation and behavior frame requests. `ThukunaController.rebaseTiming()` resets `previousTimestamp` and diagnostic elapsed time and calls `AnimationController.rebaseClock()`. On safe resume, Idle is restarted, rare events receive a newly scheduled full interval, native geometry is synchronized, and fresh RAF callbacks are scheduled. Their first callback establishes a new baseline and advances zero milliseconds. Existing 250 ms delta caps in animation/behavior/movement/locomotion remain defense in depth.

The result is no movement catch-up, animation storm, gravity explosion, instant state chain, or queued rare-event burst.

### Event-driven versus polling

An event is the operating system saying, “power source changed now.” THUKUNA can sleep until `on-battery` or `on-ac` arrives. Lock, suspend, and display changes work the same way.

Idle duration is different: Electron exposes the current number through `getSystemIdleTime()`, so the application must occasionally ask. One 15-second timer is a deliberate compromise: transition can be recognized within roughly 15 seconds of the 120-second boundary, while creating only four routine checks per minute. Sixty system queries per second would create 3,600 checks per minute without improving this behavior meaningfully. Sampling stops while locked or suspended.

### Diagnostics

The existing diagnostics overlay now includes Session, User activity, idle seconds, Power, awareness RUNNING/PAUSED, effective runtime policy, last transition, sampler state, OS listener count, and bounded history length. These values explain control decisions without revealing personal content.

## Important file-by-file map

| Path | Purpose | Called by | Calls/owns | Phase concept | Interview point |
|---|---|---|---|---|---|
| `src/main/main.ts` | Main composition and lifecycle | Electron entry | window, tray, settings, IPC, awareness | 1, 9, 15 | One trusted owner coordinates native resources. |
| `src/main/petWindow.ts` | Creates the secure fixed pet window | `main.ts` | `BrowserWindow`, preload path | 1, 12 | Window flags and web preferences are security/UX decisions. |
| `src/main/ipc.ts` | Validates renderer requests | `main.ts` registration | platform movement/cursor/settings/awareness | 2, 7, 9, 15 | IPC authorization includes sender and payload validation. |
| `src/main/preload.ts` | Narrow renderer bridge | BrowserWindow preload | `contextBridge`, validated IPC | 1, 15 | Preload is a capability boundary, not a convenience dump. |
| `src/main/windowBounds.ts` | Pure geometry clamping | platform adapter/tests | no native state | 2, 10 | Pure functions make safety math easy to test. |
| `src/main/platform/PlatformAdapter.ts` | Platform contract | `PlatformService` | window/cursor/autostart operations | 11 | Interfaces isolate platform variance. |
| `src/main/platform/BasePlatformAdapter.ts` | Shared Electron screen/window behavior | platform adapters | safe positioning and cursor data | 2, 7, 11 | Hard native safety remains main-side. |
| `src/main/platform/WindowsPlatformAdapter.ts` | Windows platform choices | service factory | Windows startup shell behavior | 11, 12 | Platform-specific details stay localized. |
| `src/main/platform/PlatformService.ts` | Main-facing platform facade | `main.ts`, IPC, tray | adapter, paths, shell, notifications | 11 | A facade keeps callers independent of adapter choice. |
| `src/main/settingsStore.ts` | Validated queued atomic persistence | `main.ts` | JSON I/O queue | 9 | Persist only user intent, not transient context. |
| `src/main/systemAwareness/SystemAwarenessService.ts` | Single normalized OS-state owner | `main.ts` | nine subscriptions, one sampler, cached snapshot | 15 | Central ownership prevents duplicate listeners/timers. |
| `src/main/systemAwareness/ElectronSystemAwarenessProvider.ts` | Real Electron adapter for awareness | `main.ts` | `powerMonitor` and `screen` | 15 | Dependency inversion enables OS-free tests. |
| `src/shared/ipcChannels.ts` | Canonical message names and geometry shapes | main/preload/renderer | two awareness channels plus existing channels | 2, 7, 9, 15 | Shared contracts stop string drift. |
| `src/shared/settings.ts` | Setting keys/defaults/sanitization | main, preload, renderer | pure settings rules | 9 | Validation occurs at boundaries. |
| `src/shared/systemAwareness.ts` | Awareness unions, constants, validator | main/preload/renderer/tests | no Electron dependency | 15 | Shared plain-data model preserves type safety. |
| `src/shared/windowGeometry.ts` | 180×250 and 180×180 invariants | main, renderer, tests | constants only | 1, 2 | One source of truth prevents size drift. |
| `src/renderer/pet.ts` | Renderer composition root and DOM events | `pet.js` entry | all renderer controllers | 1–15 | Composition wiring should be separate from domain logic. |
| `src/renderer/animations/thukunaAnimations.ts` | Semantic animation library and frame metadata | renderer/states/tests | approved sprite paths | 3, 11.4–11.5 | Behavior selects names; animation owns frames. |
| `src/renderer/engine/AssetManager.ts` | Preloads and falls back safely | `pet.ts` | image loading report | 3 | Assets are validated dependencies. |
| `src/renderer/engine/AnimationController.ts` | Frame playback and presentation metadata | states/renderer | one animation RAF | 3, 15 | Delta time plus rebase yields smooth, resume-safe animation. |
| `src/renderer/engine/StateMachine.ts` | Generic state lifecycle | `ThukunaController` | enter/update/exit and elapsed time | 4 | Explicit state transitions control complexity. |
| `src/renderer/engine/ThukunaController.ts` | Behavior orchestrator/context | `pet.ts`, dev runtime | FSM, motion, cursor, personality, rare events | 4–10, 15 | It consumes awareness context; it does not own OS listeners. |
| `src/renderer/engine/InteractionController.ts` | Click/drag interpretation | `pet.ts` | combo and reaction decisions | 5 | Raw events become semantic actions. |
| `src/renderer/engine/PersonalityController.ts` | Bounded session-only behavior variables | `ThukunaController` | irritation/energy/boredom/chaos | 6 | Deterministic heuristics are not AI. |
| `src/renderer/engine/CursorAwarenessController.ts` | Purpose-limited cursor sampling | states/controller | modes, distance, cadence | 7, 15 | Poll only while needed; fail closed. |
| `src/renderer/engine/RareEventController.ts` | Elapsed-time rare scheduling/cooldowns | `ThukunaController` | one logical schedule, no extra timer | 8, 15 | Central scheduling avoids timer chaos. |
| `src/renderer/engine/PowerPolicyController.ts` | User mode plus temporary soft modifiers | `ThukunaController` | effective numeric policy | 9, 15 | Persisted preference and runtime policy are different layers. |
| `src/renderer/engine/MovementController.ts` | Velocity to bounded native deltas | states/locomotion | throttled movement IPC | 4, 10 | Model physical position separately from CSS. |
| `src/renderer/engine/LocomotionController.ts` | Jump/fall/climb/perch sequencing | states/controller | 2D physics phases | 10 | Locomotion semantics are not animation frames. |
| `src/renderer/engine/MovementPlanner.ts` | Chooses feasible chase movement | controller | pure plan | 10 | Decision logic remains testable and capability-aware. |
| `src/renderer/engine/SystemAwarenessController.ts` | Renderer snapshot/context owner | `pet.ts` | subscription, policy, 20-entry history | 15 | Context influences the FSM without duplicating it. |
| `src/renderer/dev/ThukunaDevCommandRuntime.ts` | Safe deterministic debug forcing | dev controller | canonical behavior APIs | 11.5, 15 | Debug bypasses product policy, never hard safety. |
| `scripts/build-bundles.mjs` | Bundles renderer/preload | npm build | esbuild | 12 | Build output differs from TypeScript source. |
| `scripts/run-tests.mjs` | Compiles and runs all `*.test.ts` | `npm test` | esbuild + Node test runner | all | The suite tests pure and integrated boundaries. |

## Launch to shutdown, exactly

`npm start` runs `npm run build` and then `electron .`. TypeScript compiles main/shared modules; the renderer and preload are bundled; HTML, CSS, animation folders, and icons are copied to `dist`. Electron reads `package.json` and loads `dist/main/main.js`.

At module load, `configureSingleInstance(app, showThukuna)` obtains the single-instance lock. A second process quits and tells the first to show its existing window. The primary waits for `app.whenReady()` because `BrowserWindow`, `screen`, and `powerMonitor` require an initialized Electron application.

After readiness, `main.ts` creates `PlatformService`, then `SystemAwarenessService` and its real provider. The service reads initial power/idle values, installs supported event listeners, and starts its one sampler. Runtime diagnostics and `SettingsStore` initialize. `registerPetWindowIpc()` registers guarded request handlers. `showThukuna()` calls `createPetWindow()`, which loads the preload and renderer document.

The preload installs `window.thukunaWindow`. `pet.ts` requests settings and platform capabilities, preloads all animation paths, constructs animation/event/dialogue/interaction/behavior controllers, subscribes to settings/visibility/awareness events, requests the initial awareness snapshot, applies policy, installs development controls when allowed, and starts the behavior controller.

During operation, the tray may hide the window without destroying the application. Hide cancels renderer work and sends visibility state; show safely restarts it. Explicit Quit destroys the tray, closes the pet, and calls `app.quit()`. `beforeunload` destroys renderer controllers and unsubscribes bridge listeners. Main `before-quit` removes the Phase 15 IPC handler and disposes System Awareness; the latter clears its interval and nine Electron listeners. This symmetrical creation/cleanup prevents listener growth across a normal lifecycle.

## How one frame appears

1. A behavior state calls `context.animation.play("crawl_loop")` or another semantic name.
2. `AnimationController` looks up that name in the library built by `resolveAnimationFrames()`.
3. `AssetManager` has already resolved each path to its loaded asset or idle fallback.
4. The animation clock selects `currentFrameIndex` from elapsed duration.
5. `renderCurrentFrame()` sets the image source and applies frame offset, scale 1, and anchor to `frame-layer`.
6. `direction-layer` mirrors left/right without changing native coordinates.
7. `motion-layer`, `interaction-layer`, `event-layer`, and `locomotion-visual-layer` independently add their currently owned effect.
8. Chromium composes the nested transforms and draws `img#thukuna` on the transparent 180×180 stage.

No behavior state manually sizes the native window, and no frame inherits a previous frame’s computed scale. This is why clicking/dragging does not accumulate size.

## How one autonomous Crawl happens

`IdleState` is entered and picks a duration using `BEHAVIOR_CONFIG`. Each behavior RAF passes a capped delta into `StateMachine.update()`. When Idle’s elapsed duration is reached, it calls `context.getBehaviorWeights()`. `ThukunaController` obtains personality-adjusted choices, lets `PowerPolicyController.applyBehaviorWeights()` add user/system policy, zeroes choices that violate platform capability, and uses `weightedChoice()`.

If Crawl wins, the state machine exits Idle (which disables its cursor mode) and enters `CrawlingState`. Crawl checks `MovementMemory`, chooses direction and 40–90 px/s speed, starts the crawl sequence, and asks `MovementController` to move. The controller accumulates fractional distance and sends integer deltas at no more than 30 IPC updates per second. Main validates the delta and clamps the native window. At duration or boundary, Crawl stops native motion, plays its dedicated stop frames, records the movement, and transitions to Idle.

Under system Idle, the next decision takes longer and Idle/Sleep weights are higher. On battery, energetic weights and speed are reduced. Under lock/suspend, this path cannot start at all.

## How click and drag differ end-to-end

For a click, browser pointer events stay within 6 pixels. Release makes `InteractionController` increment its combo, update `PersonalityController`, optionally show `DialogueController`, and call `beginInteractionReaction()`. The existing state/animation system shows the visual and later performs canonical cleanup.

For a drag, movement exceeds 6 pixels. `pet.ts` captures the pointer, begins a `DRAGGED` behavior state, and sends screen coordinates through preload IPC. Main records the pointer-to-window offset and moves/clamps the `BrowserWindow`. Release sends `drag-end`, computes drag metrics, chooses a drop reaction, returns through Idle, and synchronizes the movement model to native coordinates. If Windows locks mid-drag, Phase 15 sends `endDrag`, cancels pointer capture/session, removes the drag class, and then applies hard pause.

## How Domain happens

Production Domain can begin only when `RareEventController.update()` reaches a scheduled check, the occurrence roll succeeds, Domain wins the weighted choice, its cooldown is clear, current state is Idle, rare events are enabled, platform policy permits local events, no interaction override exists, and system hard safety is inactive. `forceRareEvent("DOMAIN_EXPANSION")` marks the active event and `StateMachine.transition()` enters `DomainExpansionState`.

Entry stops movement/cursor work, activates the event visual, plays charge frames, and requests its staged dialogue. Updates use FSM elapsed time to select charge, aura/expand, peak, collapse, and recover stages. The animation manifest supplies exactly 20 frames while the nested transform layers remain fixed. At exactly 3,400 ms, state exit resets the event layer, `onRareEventFinished()` records cooldown/personality effects, and the FSM returns to Idle.

Developer-forced Domain uses the same state, frames, timeline, cleanup, and cooldown ownership. The difference is only entry policy: `ThukunaDevCommandRuntime` may bypass user autonomy, rare-event setting, and explicit Low Power during development so the feature can be inspected. It first performs canonical cleanup and calls `RareEventController.forceStart()`. Phase 15’s `SYSTEM_LOCKED`/`SYSTEM_SUSPENDED` check happens before that bypass, so developer force cannot defeat OS safety.

## How Windows lock travels through the app

```text
Win+L
  → Electron powerMonitor emits "lock-screen"
  → ElectronSystemAwarenessProvider callback
  → SystemAwarenessService stops its idle sampler
  → snapshot session active → locked
  → main.ts sends thukuna:system-awareness-changed
  → preload validates SystemAwarenessSnapshot
  → SystemAwarenessController derives SYSTEM_LOCKED
  → pet.ts cancels drag/dialogue
  → ThukunaController stops RAF/cursor/motion/rare events
  → canonical safe Idle is retained

unlock-screen
  → main refreshes idle/power and starts one sampler
  → renderer rebases clocks and restarts safe Idle
  → native position is synchronized
  → autonomy resumes only if visible and user setting permits it
```

No “locked” preference is saved. Repeated lock events are ignored when they do not change state.

## How suspend/resume travels through the app

On `suspend`, the service remembers whether the session was active or locked, stops sampling, and publishes `suspended`. The renderer cancels ongoing transient behavior and frame loops. Because those loops no longer run, no hidden delta accumulates inside movement or animation.

On `resume`, the main service re-reads power and idle values. If the session was locked before sleep, it returns to locked and waits for the actual unlock event. Otherwise it starts exactly one sampler and publishes active. Main re-clamps the current native bounds through `PlatformService.moveWindowTo()`. Renderer `rebaseTiming()` and `rebaseClock()` discard old timestamps, restarts safe Idle, schedules a fresh rare-event interval, synchronizes position, and schedules fresh RAF callbacks.

Numerically: a pre-sleep timestamp of 10,000 and post-sleep timestamp of 7,210,000 would naively imply a 7,200,000 ms delta. After rebase, the first callback records 7,210,000 as its new baseline and applies 0 ms. The next callback near 7,210,016 applies about 16 ms. Tests simulate this multi-hour gap and assert no position jump or elapsed-state leap.

## Active versus idle

Electron reports how many seconds have passed since system input. The service samples it every 15 seconds and compares it with the clearly named 120-second threshold. A value of 119 remains active; 120 becomes idle. After input, a later sample sees a small value and returns active. Recognition is intentionally not instantaneous because this is a coarse energy/context feature, not input handling.

Polling is necessary because no reliable cross-version Electron event announces the exact idle threshold crossing. Central low-rate sampling is safe; many renderer timers or per-frame queries would be wasteful and harder to clean up. While idle, THUKUNA does not force Sleep each tick or rewrite personality. It merely evaluates less often, favors rest, slows cursor work, and spaces rare events farther apart.

## Security in plain and technical language

Analogy: the renderer is a visitor, preload is a guarded service desk, and main is a secure staff area. A visitor can ask the desk for an approved service, but cannot walk into the staff room or take the master keys.

Technically, `nodeIntegration: false` removes Node globals from the page. `contextIsolation: true` keeps preload’s JavaScript world separate from page scripts. `sandbox: true` restricts renderer privileges. `contextBridge.exposeInMainWorld()` publishes an intentionally tiny API. IPC handlers validate the sender window and payload types. The awareness bridge returns readonly plain data and a cleanup callback.

Exposing raw `ipcRenderer` would let any renderer bug invent channel names and invoke capabilities never intended for the page. The narrow bridge instead makes the security surface reviewable: two awareness operations, neither of which mutates OS state or forges context.

## Privacy boundary

Phase 15 answers only “is the session safe?”, “has the system been idle long enough for a softer policy?”, “is power AC or battery?”, and “did display geometry require re-clamping?” It never asks what application is active, what its title says, what keys were typed, which processes run, what the clipboard contains, or what appears on screen.

This boundary matters because a playful pet needs safe lifecycle context, not personal content. Less collection means less code, fewer permissions, less attack surface, no sensitive database, and nothing to upload. Transition history is 20 coarse in-memory entries and disappears when the renderer closes.

## Performance model

THUKUNA already uses `requestAnimationFrame` for work that must match visual frames and a throttled 30 Hz native movement channel only while moving. Rare events and personality use elapsed accumulators inside that loop rather than independent background timers. Phase 15 adds exactly one main-process timer at 15 seconds and nine passive Electron listeners on Windows.

An event listener consumes little CPU while no event occurs. One idle query every 15 seconds means four system queries per minute. A 60 Hz loop would mean 3,600 per minute—900 times as many—and would still be unnecessary for a 120-second decision. Lock/suspend stop the sampler and renderer loops that are not needed. Snapshots are cached, malformed data is rejected, duplicate states are suppressed, and history is bounded. These choices target stable CPU, memory, and wakeups rather than clever but noisy monitoring.

## Testing strategy and actual examples

A **unit test** checks a small object in isolation. `systemAwarenessService.test.ts` gives the service a `FakeProvider` and `FakeScheduler`, then verifies threshold, events, one timer, nine listeners, duplicates, errors, and cleanup.

An **integration test** checks several real parts together. `thukunaController.test.ts` applies a suspended snapshot to the real behavior/animation composition, verifies Domain dev force is rejected, resumes after a simulated two-hour timestamp gap, and confirms the first elapsed step is zero.

A **regression test** protects something that previously worked. Phase 15 reruns all Phase 1–12 tests, including 180×250 window geometry, scale 1, 116 sprites, 20 Domain frames, 3,400 ms Domain timing, movement, settings, tray, and developer commands.

A **fake/mock** replaces an external dependency with controllable behavior. The injected `SystemAwarenessProvider` means tests emit `lock-screen` without locking the workstation. The scheduler fake counts interval creation without waiting 15 seconds.

A **manual test** uses real Windows features. Only a real lock, physical suspend, charger change, and monitor/work-area change prove the operating system delivers those events in the user’s environment.

A **soak test** runs for an extended period to look for growth or instability. The earlier 30-minute Phase 11.5 soak supported transform/listener/runtime stability. It did not prove Phase 15’s physical Windows events because they did not exist then; Phase 15 uses focused automated lifecycle tests plus the manual checklist below.

## Manual Windows validation checklist

Run this from a normal user PowerShell, not the known problematic Codex-host Electron environment:

1. Run `npm start`. Expected: THUKUNA appears and behaves normally.
2. Open development diagnostics. Expected: `Session: ACTIVE`, awareness `RUNNING`, one active idle sampler, and nine listeners on Windows.
3. Do not interact with Windows for at least 120 seconds plus up to one 15-second sampling interval. Expected: User becomes `IDLE`, behavior stays stable, and no high-energy action storm occurs.
4. Move the mouse or interact. Expected: User returns `ACTIVE` on a later sample and ordinary policy returns safely.
5. Press Win+L, wait, then unlock. Expected: a LOCKED transition is in history; Session returns ACTIVE; no teleport, animation leap, or queued action burst occurs.
6. Put Windows to Sleep and resume. Expected: SUSPENDED and recovery appear; no giant delta, physics explosion, duplicate timer, or duplicate listener occurs. If Windows resumes locked, it must remain LOCKED until unlock.
7. On a laptop, unplug power and reconnect it. Expected: BATTERY then AC. The selected Normal/Chaos/Low Power tray setting must not change.
8. Attach/detach a monitor or change resolution/taskbar work area if convenient. Expected: THUKUNA remains within a valid work area.
9. Exercise Crawl, Jump, Climb, Perch, and Domain. Expected: no behavior, sprite, scale, or Domain-timing regression.
10. Hide then Show through the tray. Expected: runtime resumes once with no duplicate work.
11. Choose Reset Position. Expected: it returns to the primary display floor normally.

After the checks, leave THUKUNA running passively for several minutes with diagnostics visible occasionally. Listener count must stay fixed, sampler count must remain one when active/zero when locked or suspended, and memory/CPU should show no upward pattern attributable to repeated transitions.

## Beginner debugging guide

### Idle never activates

Open diagnostics and check `Idle`, `User`, and `Idle Sampler`. If the sampler says STOPPED while Session is ACTIVE, inspect `SystemAwarenessService.startIdleSampler()` and whether Windows capabilities were reported. If idle seconds stay zero, inspect `ElectronSystemAwarenessProvider.getSystemIdleTime()` and run `npm test --` (the project runner will still run the complete suite) to confirm the fake-provider threshold tests. Remember the state may appear up to 15 seconds after the 120-second threshold.

### Lock never appears

Check Session and Last Transition after unlocking. The renderer cannot display while the Windows lock screen is covering the desktop, so the evidence is expected after unlock. Inspect registration of `lock-screen`/`unlock-screen` in `SystemAwarenessService` and the provider’s `powerMonitor` subscription. Listener Count should be 9 on supported Windows. Do not add a global hook or weaken Windows security to “detect” the lock.

### Battery always says UNKNOWN

Confirm this is the Windows build and the hardware/VM exposes power source. Inspect the provider’s `powerMonitor.isOnBatteryPower()` and `on-battery`/`on-ac` events. The service deliberately catches provider failure and reports UNKNOWN. Battery percentage is not implemented. Run `systemAwarenessService.test.ts` and `systemAwarenessPolicy.test.ts` to separate provider delivery from policy correctness.

### THUKUNA jumps after resume

Check that history contains `suspended` and recovery. Inspect `ThukunaController.applySystemAwareness()`, `rebaseTiming()`, `AnimationController.rebaseClock()`, and the main geometry invalidation callback. Confirm the first post-resume behavior tick advances 0 ms and the next normal tick is small. Run the “multi-hour gap” integration test. Do not solve this by loosening work-area clamping or changing the canonical window size.

### Duplicate awareness messages or growing listeners

Diagnostics should report 9 listeners and one sampler on active Windows. Repeated `start()` must not increase either. Inspect `SystemAwarenessService.started`, `idleSampler`, `unsubscribers`, and `dispose()`. Renderer `SystemAwarenessController.start()` also has a generation/idempotence guard and owns one unsubscribe. The history cap of 20 prevents old transitions from growing memory.

### CPU suddenly becomes high

First distinguish animation/movement activity from OS awareness. Awareness has no per-frame OS query; inspect sampler state and make sure only one 15,000 ms interval exists. Cursor WATCH/CHASE deliberately queries more often while active, so check cursor mode/query counters. Also check whether diagnostics are open and a developer command is forcing motion. Search for accidental new `setInterval`, `powerMonitor`, or `screen` calls outside the single service/provider.

### A developer command is rejected

Read `COMMAND RESULT`, `REJECTION`, and `TRACE`. `SYSTEM_LOCKED` and `SYSTEM_SUSPENDED` are intentional hard safety. Other exact causes include movement/cursor capability, drag active, not grounded/elevated/near edge, disabled assets, or current state. The canonical logic is `ThukunaDevCommandRuntime.getHardPreconditionRejection()` followed by the relevant `ThukunaController.force*()` method. Diagnostics itself remains usable during system pause.

## Interview preparation

### Why Electron?

**Beginner answer:** Electron lets THUKUNA use HTML/CSS for the character UI while still creating a real transparent Windows desktop window.

**Interview-quality answer:** Electron supplies Chromium rendering plus main-process native APIs. THUKUNA benefits from mature CSS compositing, TypeScript tooling, `BrowserWindow`, tray, screen geometry, power events, and packaging. The cost is a larger runtime, so the architecture minimizes background work and strictly separates renderer privilege.

**Follow-up:** What tradeoff would make you consider a native framework? Memory footprint, startup time, or deeper platform-specific behavior could justify WinUI, WPF, or another native stack.

### What is preload?

**Beginner answer:** It is a guarded bridge between the untrusted page and the powerful main process.

**Interview-quality answer:** A preload runs with access needed to call Electron IPC but, under context isolation, exposes only a curated capability surface through `contextBridge`. THUKUNA validates data and returns unsubscribe functions rather than leaking Electron objects.

**Follow-up:** Why not import Electron in `pet.ts`? The sandboxed renderer should remain a browser-like environment with no broad native capability.

### Why context isolation?

**Beginner answer:** It prevents page scripts from directly changing or stealing preload’s privileged objects.

**Interview-quality answer:** It runs preload and renderer JavaScript in distinct contexts. Combined with sandboxing, disabled Node integration, CSP, narrow IPC, sender checks, and payload validation, it reduces the impact of renderer injection or bugs.

**Follow-up:** Is context isolation sufficient alone? No; privilege minimization, CSP, validation, and safe navigation/content rules are also required.

### What is IPC?

**Beginner answer:** Inter-process communication is how the renderer asks the main process to do a native operation.

**Interview-quality answer:** Electron isolates main and renderer into processes. THUKUNA defines centralized channel strings and typed serializable payloads, validates the sender and values, and uses request/response for snapshots or movement plus one-directional events for changes.

**Follow-up:** Why validate TypeScript data at runtime? TypeScript types disappear after compilation, and IPC inputs are runtime values that may be malformed.

### Why use an FSM?

**Beginner answer:** It keeps THUKUNA in one understandable behavior at a time.

**Interview-quality answer:** Explicit state entry/update/exit centralizes lifecycle cleanup and makes priorities testable. It prevents conflicting behaviors and gives timed states deterministic progression without scattering flags across the renderer.

**Follow-up:** Why not make System Awareness another FSM? It is orthogonal context that constrains behavior; duplicating control would create conflicting sources of truth.

### Why separate locomotion from animation?

**Beginner answer:** Locomotion decides physical movement; animation decides which picture is shown.

**Interview-quality answer:** `LocomotionController` sequences physics/action phases while `MovementController` owns native velocity and `AnimationController` owns visual frames. The separation permits testing trajectories independently, swapping art without changing physics, and cleaning transforms without corrupting native coordinates.

**Follow-up:** Where does clamping belong? In main-side platform/window code, because renderer visuals cannot be the final native safety authority.

### Why use a platform abstraction?

**Beginner answer:** The rest of THUKUNA can request “move safely” without knowing each operating system’s details.

**Interview-quality answer:** `PlatformAdapter` and capabilities isolate native variance, while `PlatformService` is a facade. Behavior policy can reject unsupported actions before failure loops. The abstraction supports future ports without falsely claiming they are validated.

**Follow-up:** Does an interface prove Linux support? No; it proves an architectural seam, not physical validation or packaging.

### What is event-driven programming?

**Beginner answer:** Code waits for the operating system to announce a change instead of constantly checking.

**Interview-quality answer:** Phase 15 subscribes once to power/session/display events and updates a cached model only on callbacks. This minimizes wakeups and makes ownership/cleanup explicit. Idle time alone uses one coarse poll because Electron exposes it as a query rather than a threshold event.

**Follow-up:** What is the main lifecycle risk? Duplicate subscriptions or forgotten disposal during repeated initialization/reload.

### Why not globally hook mouse or keyboard?

**Beginner answer:** THUKUNA does not need to capture everything the user does.

**Interview-quality answer:** Global hooks create privacy, permission, security, and performance costs. The pet uses ordinary pointer events inside its own stage and purpose-limited cursor coordinate sampling through Electron; Phase 15 needs only aggregate idle seconds.

**Follow-up:** Can idle state reveal typed content? No; it is only a duration since system input, not the input itself.

### How is idle detected?

**Beginner answer:** One timer asks Electron for idle seconds every 15 seconds and compares it with 120 seconds.

**Interview-quality answer:** The main-owned service injects a provider/scheduler, normalizes invalid results to unknown, changes activity at the named threshold, suppresses identical measurements, stops sampling during hard pause, and publishes typed cached snapshots.

**Follow-up:** What is the detection latency? Approximately zero to one sampling interval after crossing the threshold.

### How are sleep/resume timing bugs prevented?

**Beginner answer:** Old timestamps are discarded, so sleep time is not treated like one giant animation frame.

**Interview-quality answer:** Suspend cancels active RAF work and nonessential systems. Resume rebases behavior and animation clocks, restarts safe Idle and a fresh rare-event interval, resynchronizes/clamps geometry, and retains 250 ms delta caps as defense in depth. A test injects a multi-hour timestamp gap.

**Follow-up:** Why is a delta cap alone weaker? Even a capped delta could incorrectly advance one step immediately and does not reset scheduler semantics or stale native position.

### Why not save Low Power automatically on battery?

**Beginner answer:** Battery is temporary; the tray selection is the user’s lasting choice.

**Interview-quality answer:** Persisted preference and transient context have different lifetimes and ownership. `PowerPolicyController` composes temporary multipliers in memory while `SettingsStore` changes only through explicit settings updates. Returning to AC therefore restores the original mode exactly.

**Follow-up:** Which has priority? Explicit Low Power remains stronger than the battery modifier.

### How are listener leaks prevented?

**Beginner answer:** The same object that starts listeners stores cleanup functions and disposes them once.

**Interview-quality answer:** `SystemAwarenessService` guards idempotent start, stores each provider unsubscribe, owns the sole interval token, clears in reverse order, resets diagnostics counts, and tolerates repeated dispose. The renderer controller similarly owns one bridge unsubscribe and a generation token for asynchronous startup.

**Follow-up:** How is this tested? Fake provider/scheduler counters assert 9→0 listeners, 1→0 intervals, and no growth after repeated start/dispose.

### How did THUKUNA remain lightweight?

**Beginner answer:** It uses OS events, one slow idle timer, cached snapshots, bounded history, and stops work when unsafe.

**Interview-quality answer:** There are no per-frame OS queries, WMI loops, process enumeration, worker per feature, or duplicate scheduler timers. Existing RAF work is scoped to visual behavior; native movement is throttled; rare scheduling uses the existing delta loop; Phase 15 adds four idle queries per minute when active.

**Follow-up:** What metric would you observe manually? Stable listener/timer counts, CPU wakeups, memory trend, and post-resume behavior.

### What did the soak test prove, and not prove?

**Beginner answer:** It showed the pet stayed stable for a long run, but not that every Windows event works everywhere.

**Interview-quality answer:** The 30-minute Phase 11.5 soak increased confidence in repeated behavior cleanup and absence of obvious accumulation. It was not a formal proof, did not exhaust state interleavings, and predates Phase 15 physical lock/suspend/power/display validation.

**Follow-up:** What complements a soak? Deterministic unit/integration tests plus targeted manual OS validation.

## Glossary

- **Electron:** desktop framework combining Chromium rendering with native application APIs through a main process.
- **Chromium:** browser engine that lays out THUKUNA’s HTML/CSS and composites its transparent visual layers.
- **Node.js:** JavaScript runtime used by trusted main/build code for filesystem and application tasks.
- **TypeScript:** JavaScript plus compile-time types; runtime boundary validation is still necessary.
- **BrowserWindow:** Electron’s native window containing a Chromium web page.
- **Main process:** trusted Electron process that owns windows, tray, filesystem settings, IPC handlers, and OS awareness.
- **Renderer:** Chromium process that owns DOM, CSS, behavior composition, and visible sprite output.
- **Preload:** controlled script that connects renderer requests to approved IPC operations.
- **IPC:** inter-process communication between renderer/preload and main.
- **contextBridge:** Electron API used to expose a small safe preload surface to an isolated renderer.
- **Sandbox:** restriction that removes broad operating-system privileges from renderer code.
- **Context isolation:** separation between preload’s JavaScript context and page scripts.
- **FSM:** finite-state machine with explicit states and transitions.
- **State:** one current behavior with enter, update, exit, and optional duration.
- **Transition:** controlled movement from one state to another, including cleanup.
- **Controller:** object that owns coherent renderer logic and its state, such as animation or movement.
- **Service:** application-level owner/facade, such as `PlatformService` or `SystemAwarenessService`.
- **Adapter:** translator that implements a common interface for a specific platform/provider.
- **Abstraction:** stable contract hiding details that callers should not depend on.
- **Sprite:** transparent image representing one character pose.
- **Frame:** one sprite plus duration/alignment metadata in an animation.
- **Animation loop:** repeated RAF callbacks that advance frames according to elapsed time.
- **Delta time:** elapsed milliseconds since the prior tick; used for refresh-rate-independent updates.
- **Velocity:** movement amount per second on x/y axes.
- **Gravity:** downward acceleration; THUKUNA uses 920 px/s² for airborne locomotion.
- **Coordinate:** numeric position, either within an element or in desktop screen space.
- **Transform:** CSS operation such as translate, scale, rotate, or mirror.
- **Anchor:** semantic alignment point used to keep different frames visually grounded/attached.
- **Event:** notification that something happened, such as `suspend` or pointer release.
- **Listener:** callback registered to receive an event; it must have cleanup ownership.
- **Timer:** scheduled callback after or at intervals; Phase 15 owns one interval.
- **Polling:** periodically asking for current state.
- **Event-driven:** waiting for a producer to announce change, avoiding repeated queries.
- **Idle:** system input has been absent for at least the configured threshold; it says nothing about content.
- **Suspend:** operating system sleep transition during which runtime work should stop.
- **Resume:** wake transition that requires state refresh and clock rebasing.
- **Runtime state:** in-memory condition used only while the application runs.
- **Persisted setting:** validated user choice written to disk and restored after restart.
- **Dependency injection:** giving an object its provider/scheduler instead of hard-coding globals, enabling tests.
- **Mock/fake:** controlled test replacement for an external dependency.
- **Unit test:** focused test of a small module.
- **Integration test:** test of several real modules working together.
- **Soak test:** extended run intended to reveal accumulation or long-term instability.
- **ASAR:** Electron archive containing packaged application code/resources.
- **NSIS:** Windows installer system used by electron-builder.
- **Git:** version-control system recording commits and branches.
- **Commit:** immutable snapshot/description of a coherent change.
- **Branch:** movable line of development; Phase 15 stays on its feature branch until validation.

## THUKUNA in 5 minutes

THUKUNA is a TypeScript Electron desktop pet. A secure main process creates a fixed transparent 180×250 Windows `BrowserWindow`; a 180×180 renderer stage displays one of 116 approved scale-1 sprites. The preload is the only bridge. It exposes narrow validated operations for drag/movement, cursor position, settings, platform capabilities, reset, visibility, and Phase 15 awareness.

`pet.ts` composes the renderer. `ThukunaController` owns behavior context and one generic `StateMachine`. Individual states choose semantic animations and movement. `AnimationController` advances PNG frames; `MovementController` moves the real native window; `LocomotionController` sequences jump/fall/climb/perch physics; `InteractionController` turns raw pointer events into clicks, combos, Rage, and drags; `PersonalityController` maintains bounded session-only irritation/energy/boredom/chaos; `RareEventController` safely schedules six uncommon events including the exact 3,400 ms Domain.

`PlatformService` and adapters keep native differences out of behavior code. Main-side work-area clamping is always the final position authority. `SettingsStore` atomically persists explicit user choices. Normal, Chaos, and Low Power are settings; they are not OS power-source readings.

Phase 15 adds one main `SystemAwarenessService`, nine passive Windows listeners, and one 15-second idle sampler with a 120-second threshold. It publishes cached validated snapshots through two IPC channels. `SystemAwarenessController` converts snapshots to context and keeps at most 20 diagnostic transitions. Idle/battery temporarily reduce work without changing settings. Lock/suspend are hard safety: they cancel interaction, cursor, movement, rare events, and frame work, and even developer force cannot bypass them.

Resume discards old behavior/animation timestamps, schedules fresh work, refreshes transient system context, and re-clamps/synchronizes geometry. Thus two hours of sleep becomes a zero-delta first frame, not a two-hour physics update. Existing delta caps remain a second defense.

The security story is simple: renderer is sandboxed and isolated; no Node integration; preload exposes only reviewed capabilities; IPC validates values and sender; no raw Electron reaches the page. The privacy story is equally strict: system state only, never user content, active apps, keystrokes, processes, clipboard, microphone, or screenshots.

Automated tests use injected fakes for OS events and timers, then rerun all regression tests. Physical lock, sleep, charger, and display events still need the normal-Windows checklist. Until those checks pass, the correct status is **engineering complete—manual Windows validation required**, and the feature branch must not be merged into `main`.
