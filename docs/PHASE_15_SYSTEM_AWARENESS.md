# Phase 15 — System Awareness

Status: **A. PHASE 15 FULLY COMPLETE.** Engineering verification and physical Windows manual validation passed on `phase-15-system-awareness` before merge to `main`.

## Architecture discovered

THUKUNA is an Electron + TypeScript application with three security boundaries:

- `src/main/main.ts` owns the Electron lifecycle, the pet `BrowserWindow`, tray, settings, and main-process services.
- `src/main/preload.ts` is the only guarded bridge into the sandboxed renderer. The window keeps `sandbox: true`, `contextIsolation: true`, and `nodeIntegration: false` in `src/main/petWindow.ts`.
- `src/renderer/pet.ts` composes the renderer controllers. `ThukunaController` owns behavior context and the existing `StateMachine`; `PowerPolicyController` converts persisted Normal/Chaos/Low Power settings into runtime behavior values.

Relevant existing components are:

- `PlatformService` and `PlatformAdapter` for platform-specific window/cursor/autostart operations.
- `BasePlatformAdapter` for Electron `screen` queries and safe work-area clamping.
- `SettingsStore` and `shared/settings.ts` for persisted user preferences.
- `ThukunaController`, `MovementController`, `LocomotionController`, `CursorAwarenessController`, `RareEventController`, and `AnimationController` for runtime behavior.
- the existing diagnostics overlay and development-command runtime in `pet.ts` and `src/renderer/dev`.

Before Phase 15 there was no use of `powerMonitor`, no idle-state service, and no duplicate System Awareness abstraction. Electron `screen` was used only by the main-side platform adapter. The existing render, movement, locomotion, and animation loops already capped frame deltas; Phase 15 added explicit resume rebasing and a system hard-safety gate.

## Implemented ownership and flow

`SystemAwarenessService` is the one owner of Electron system listeners and the one idle sampler. It receives an injected `SystemAwarenessProvider` and `SystemAwarenessScheduler`, so transition logic is tested without locking or suspending Windows. `main.ts` creates `ElectronSystemAwarenessProvider` after `app.whenReady()`, starts the service once, broadcasts changed snapshots to the pet window, re-clamps geometry on resume/display events, and disposes the service during `before-quit`.

```text
Windows / Electron powerMonitor + screen
                  |
                  v
main/SystemAwarenessService (one owner, cached normalized snapshot)
                  |
        typed request + change IPC
                  |
                  v
secure preload thukunaWindow API
                  |
                  v
renderer/SystemAwarenessController (context + bounded history)
                  |
                  v
existing ThukunaController / PowerPolicyController / FSM
```

Shared readonly unions and `isSystemAwarenessSnapshot()` live in `src/shared/systemAwareness.ts`. IPC names `thukuna:system-awareness-get` and `thukuna:system-awareness-changed` are centralized in `src/shared/ipcChannels.ts`. The preload surface exposes only `getSystemAwareness()` and `onSystemAwarenessChanged(listener)`; raw Electron objects and raw `ipcRenderer` do not cross the bridge.

## Signals and normalization

The implemented `SystemAwarenessSnapshot` represents:

- session: `active | locked | suspended`
- activity: `active | idle | unknown`
- power source: `ac | battery | unknown`
- non-negative whole idle seconds
- capabilities, timestamp, last semantic transition, sampler state, and listener count for privacy-safe diagnostics

Six `powerMonitor` events drive lock/unlock, suspend/resume, and AC/battery. Three `screen` events drive display/work-area invalidation. Exactly one low-frequency interval samples `powerMonitor.getSystemIdleTime()`. `SYSTEM_IDLE_THRESHOLD_SECONDS` is 120 and `SYSTEM_IDLE_SAMPLE_INTERVAL_MS` is 15,000. On supported Windows the diagnostic listener count is nine. Repeated semantic events and identical idle measurements are not broadcast; changed idle seconds may refresh diagnostics without creating a fake transition entry.

Display events do not become a new multi-monitor behavior feature. They only request a main-side re-clamp using the existing platform movement/clamping path. Resume performs the same geometry refresh.

## Runtime behavior policy

Hard system safety has priority over every product or developer override:

1. suspended
2. locked
3. safe geometry recovery
4. normal interaction/developer/behavior priorities

While locked or suspended, `pet.ts` and `ThukunaController.applySystemAwareness()` stop interaction sessions, cursor work, locomotion/movement, rare-event scheduling, behavior/animation RAF progression, and inappropriate dev forcing. They retain a safe `IDLE` state and do not rewrite settings or personality. `ThukunaDevCommandRuntime` reports `SYSTEM_LOCKED` or `SYSTEM_SUSPENDED`; Diagnostics alone remains safe to open. Unlock/resume refreshes the main snapshot, rebases animation/behavior clocks, syncs/clamps geometry, and restarts only work allowed by visibility and the user's settings. A session locked before suspend remains locked after resume until `unlock-screen` arrives.

Idle and battery are soft modifiers applied in memory by `PowerPolicyController.updateSystemAwareness()`. Outside explicit Low Power, idle multiplies movement by 0.6, Idle duration by 1.75, personality interval by 2, and rare-event interval by 1.7; battery multiplies those by 0.8, 1.25, 1.5, and 1.35 respectively. Rest weights increase while energetic battery weights decrease. `CursorAwarenessController.setIntervalMultiplier()` applies 2.5 for idle and 1.5 for battery (3.75 combined). Explicit Low Power remains stronger and receives no extra system multiplier. The persisted Normal/Chaos/Low Power choice is never mutated by transient system context.

## Resume and timing safety

The smallest safe mechanism is explicit pause/rebase:

- hard pause cancels the behavior RAF and pauses `AnimationController`, disables cursor queries, cancels `MovementController`/`LocomotionController`, and suspends `RareEventController`;
- `ThukunaController.rebaseTiming()` clears its RAF timestamp and calls `AnimationController.rebaseClock()`, so the first resumed frame establishes a new baseline with zero elapsed time;
- existing 250 ms delta clamps remain defense in depth;
- rare-event scheduling is restarted from a fresh interval instead of catching up missed checks;
- the main process refreshes transient idle state and re-clamps the pet window.

This prevents time spent asleep from becoming movement, gravity, state-duration, animation, or rare-event catch-up.

## Privacy and security boundaries

Phase 15 reads only coarse system state: lock, suspend/resume, idle duration/classification, AC/battery, and display geometry changes. It does not inspect applications, window titles, processes, keystrokes, browser history, clipboard, microphone, camera, screenshots, network traffic, files, location, documents, or shell history. It adds no global hooks, WMI loop, telemetry, upload, or persistent awareness log.

Test injection exists only as constructor dependencies in ordinary TypeScript objects. No production IPC endpoint can forge system state. Existing Electron sandbox settings remain unchanged.

## Polling, lifecycle, and cleanup

All signals except idle time are event-driven. The idle sampler is one 15-second interval owned by `SystemAwarenessService`; it is stopped while locked/suspended and restarted once only when the session becomes active. `start()` and `dispose()` are idempotent. Every installed listener is tracked by an unsubscribe function and removed by `dispose()`. The new awareness IPC handler is removed during main shutdown. Renderer bridge and awareness subscriptions are disposed on `beforeunload`.

A bounded in-memory transition history (maximum 20) is renderer diagnostic state only. It is neither persisted nor transmitted.

## Test strategy

Automated tests use a fake provider and fake interval scheduler to cover initial state, all session/power/idle transitions, pre-suspend lock preservation, unknown/failure handling, duplicate suppression, one-sampler ownership, idempotent lifecycle, cleanup, refresh, and geometry invalidation. Pure runtime-policy tests cover hard vs soft priority and prove settings are not mutated. Renderer-controller tests cover subscription cleanup, old-snapshot rejection, composition, deduplication, and the 20-entry history bound. Integration tests cover hard safety against dev override and an explicit simulated two-hour clock gap. Static bridge checks verify narrow validated IPC and unchanged Electron security flags.

The full existing suite began at 199 tests. Phase 15 adds 30 focused tests for a total of 229, plus `npm run build`, `git diff --check`, and invariant checks. Five of those tests cover the final diagnostics-visibility correction: current values, distinct behavior/user labels, live transition output, bounded transition/history display, scrollability, and preserved developer-command wiring.

## Physical Windows validation — passed

The normal-Windows checklist was completed successfully on real Windows hardware. Validation covered diagnostics visibility; `ACTIVE -> IDLE` after 120+ seconds; `IDLE -> ACTIVE` after user input; `LOCKED -> ACTIVE` recovery; `SUSPEND -> RESUME` recovery; `AC -> BATTERY -> AC`; display/work-area change; Crawl; Jump; Climb; Perch/Drop; Domain; tray Hide/Show; and Reset Position.

Resume produced no teleport, large physics delta, animation catch-up burst, or queued rare-event burst. Battery and idle context did not change the persisted power-policy mode. Display changes retained safe geometry. Together with the passing automated suite, these results establish the final verdict: **A. PHASE 15 FULLY COMPLETE.**

## Non-goals

No Linux implementation or validation, Phase 16 productivity timers, Phase 17 developer awareness, LLM, voice, clipboard/screenshot access, process/app monitoring, battery percentage, new dependencies, sprite edits, Domain timing changes, geometry redesign, telemetry, updater, or merge to `main` is part of Phase 15.

## Actual files added

- `src/shared/systemAwareness.ts`
- `src/main/systemAwareness/SystemAwarenessService.ts`
- `src/main/systemAwareness/ElectronSystemAwarenessProvider.ts`
- `src/renderer/engine/SystemAwarenessController.ts`
- `tests/systemAwarenessService.test.ts`
- `tests/systemAwarenessController.test.ts`
- `tests/systemAwarenessPolicy.test.ts`
- `tests/systemAwarenessIpc.test.ts`
- `docs/THUKUNA_BEGINNER_GUIDE_PHASES_1_TO_15.md`

Integration modifies `main.ts`, `ipc.ts`, `preload.ts`, `global.d.ts`, `pet.ts`, the behavior/policy/animation/cursor/rare-event controllers, developer-command rejection types/runtime, and targeted regression tests. No dependency, production sprite, window/stage dimension, production frame scale, or Domain duration changed.
