# Phase 16 — Productivity Timers

Status: engineering complete on `phase-16-productivity-timers`; physical Windows validation and merge are intentionally pending.

## Existing architecture

THUKUNA is an Electron + TypeScript desktop pet. The trusted main process owns native lifecycle, tray, settings, window movement, and Phase 15 System Awareness. A sandboxed renderer owns visuals and behavior. `preload.ts` exposes a narrow validated `window.thukunaWindow` API across `contextIsolation`; raw Electron and Node APIs never reach the renderer.

Relevant existing components are `main.ts`, `registerPetWindowIpc()`, `SettingsStore`, `createThukunaTray()`, `SystemAwarenessService`, `SystemAwarenessController`, `ThukunaController`, `DialogueController`, and the scrollable development diagnostics panel. Existing animation, behavior, dialogue, and rare-event clocks are specialized controllers rather than a reusable durable wall-clock scheduler, so Phase 16 must not reuse them as timer truth.

## Implemented ownership

`ProductivityTimerService` in the main process is the one authoritative timer owner. Tray actions and renderer commands call that service. The renderer observes snapshots and requests commands, but never decrements or authoritatively completes a timer.

Exactly one productivity timer may exist at a time. Starting while `running` or `paused` is rejected. A completed timer may be replaced only after its pending completion has been acknowledged or cancelled.

## State and timing model

The shared state model is `idle | running | paused | completed`, with timer kinds `countdown | focus | short-break | long-break`. Snapshots contain duration, remaining time, start/deadline/pause timestamps, kind, a bounded optional label, stable timer/completion identity, scheduler state, pending-completion state, and update timestamp.

Running timers use `deadlineAt = Date.now() + durationMs`. Remaining time is always derived as `max(0, deadlineAt - Date.now())`; a one-second interval only publishes useful observer updates and detects expiry. It never decrements stored seconds. Pausing freezes `remainingMs` and removes the deadline. Resuming creates a new deadline from the frozen remainder. Completion clamps to zero and occurs once for the stable timer identity.

The documented wall-clock limitation is intentional: a large manual system-clock change can shift a countdown. Deadline-based wall time is nevertheless correct for normal lock, sleep, resume, background throttling, and restart recovery without NTP or a persistent monotonic-clock system.

## Presets and validation

User tray presets are Countdown 5 minutes, Countdown 10 minutes, Focus 25 minutes, Short Break 5 minutes, and Long Break 15 minutes. Normal durations must be whole milliseconds from 1 to 180 minutes and labels are optional, trimmed, and bounded. Custom-duration UI is deferred because the 180×250 interface has no safe compact input pattern yet.

Development diagnostics add clearly labelled 5-second and 10-second buttons. They route through the same preload, IPC, and service path. Short development durations are accepted only when Electron is not packaged; they are neither production tray presets nor a separate fake clock.

## IPC and preload model

Shared channels cover snapshot get, start, pause, resume, cancel, completion acknowledgement, and changed snapshots. Main IPC validates the sender window and every start request. Preload validates outbound requests and inbound snapshots/results, exposes only typed timer operations, and owns subscription cleanup. No raw `ipcRenderer` or general Electron API is exposed.

## Persistence model

`ProductivityTimerStore` uses a small dedicated JSON file in the existing Electron user-data directory and the same queued atomic-write pattern as settings. It stores lifecycle state only:

- running: identity, duration, kind, label, start time, and deadline;
- paused: identity, duration, kind, label, start/pause time, and frozen remaining time;
- completed: completion identity and whether the visible completion remains pending.

Start, pause, resume, cancel, completion, and acknowledgement may write. One-second observer ticks never write. Cancel clears the file. Startup restores running timers from their deadline, restores paused timers without restarting them, and immediately completes an expired persisted timer with one pending completion.

## Tray and compact UI

The existing tray remains the primary user interface. It gains one compact Timer submenu containing the five normal presets, a current state/remaining label, and Pause, Resume, and Cancel with state-correct enablement. Tray rebuilding receives a snapshot and must never own, restart, or complete a timer.

The existing scrollable diagnostics panel gains a `PRODUCTIVITY TIMER` section with state, kind, duration, remaining, deadline, scheduler, and pending completion. No BrowserWindow or pet-stage dimensions change.

## Completion and renderer behavior

Completion transitions main state once, stops the scheduler, persists completion, refreshes tray, and publishes a snapshot. `ProductivityTimerController` receives authoritative snapshots and surfaces a stable pending completion only when Phase 15 reports an active session and `ThukunaController` says a brief reaction is safe.

The reaction reuses existing Laugh or Wake behavior plus a short timer dialogue. It must not interrupt lock, suspend, dragging, Domain, locomotion safety, or another critical transition. If unsafe, it remains pending and retries when renderer state becomes safe. Once accepted, the renderer acknowledges the completion identity; main clears the pending flag so hide/show, tray refresh, renderer reload, or later snapshots cannot repeat it.

## Phase 15 semantics

- Locked: wall-clock countdown continues; visible reaction is suppressed.
- Suspended: the deadline remains truth while scheduler execution naturally stops with the OS.
- Resume: main immediately refreshes from the deadline; overdue timers complete without catch-up ticks.
- Idle: timer correctness and speed are unchanged.
- Battery and Low Power: observer presentation may remain conservative, but the deadline is never slowed or paused.

## Lifecycle and cleanup

Initialization and disposal are idempotent. Running/restored timers own exactly one 1000 ms scheduler. Paused, completed, idle, cancelled, and disposed timers own none. IPC handlers, renderer subscriptions, timer scheduler, and tray resources use explicit cleanup. Hide/Show does not dispose the main timer.

## Test strategy

Focused tests cover service lifecycle, deadline drift resistance, pause/resume, exactly-once completion, lock/suspend deferral, persistence/restart recovery, typed IPC validation, preload security, renderer subscription and acknowledgement, tray state/action mapping, diagnostics formatting, safe THUKUNA reaction priority, one-scheduler ownership, lifecycle-only disk writes, and all Phase 15/visual/security regressions.

Physical Windows validation remains required for tray behavior, actual lock/unlock, actual sleep/resume, restart recovery, hidden-window behavior, and visible completion reaction.

## Performance budget

Phase 16 permits one 1000 ms interval only while a timer is running. There are no renderer frame queries, per-view intervals, tick-based disk writes, multiple timers, catch-up loops, or high-frequency IPC. A snapshot is published at most once per useful one-second update or lifecycle transition.

## Explicit non-goals

No full Pomodoro cycle automation, custom-duration form, task list, project management, calendar, toast notification, smart notification, command palette, Git/Docker/server monitoring, plugin, LLM, voice, global input hook, clipboard, screenshot, camera, microphone, telemetry, updater, production sprite, new animation family, Linux work, Phase 17 feature, or merge to `main` is part of Phase 16.

## Actual implementation inventory

### New files

- `src/shared/productivityTimer.ts` — shared states, kinds, snapshots, command results, five production presets, two development presets, validation, copying, and remaining-time formatting.
- `src/main/productivityTimer/ProductivityTimerService.ts` — authoritative deadline, scheduler, lifecycle, completion identity, restore, and persistence coordination.
- `src/main/productivityTimer/ProductivityTimerStore.ts` — versioned dedicated JSON state with queued atomic replacement.
- `src/renderer/engine/ProductivityTimerController.ts` — one validated observer subscription, stale-snapshot protection, system-session deferral, safe-FSM retry, and completion acknowledgement.
- `src/renderer/dev/ProductivityTimerDiagnostics.ts` — compact diagnostics formatter.
- `tests/productivityTimerService.test.ts`, `tests/productivityTimerStore.test.ts`, `tests/productivityTimerController.test.ts`, and `tests/productivityTimerIntegration.test.ts` — focused Phase 16 coverage.
- `docs/PHASE_16_BEGINNER_GUIDE.md` — runtime teaching guide, architecture diagram, file map, debugging guide, interview questions, and manual checklist.

### Modified integration files

- `src/main/main.ts` creates and restores the service, refreshes it on Phase 15 resume, publishes snapshots, injects IPC methods, connects tray actions, and disposes the scheduler.
- `src/main/ipc.ts`, `src/main/preload.ts`, `src/shared/ipcChannels.ts`, and `src/renderer/global.d.ts` provide the narrow validated bridge.
- `src/main/tray.ts` and `src/main/trayMenuModel.ts` add the compact Productivity Timer submenu and state-dependent controls.
- `src/renderer/pet.ts`, `src/renderer/engine/ThukunaController.ts`, and `src/renderer/dialogue/thukunaDialogue.ts` connect pending completion to existing Laugh/Wake and dialogue behavior without violating hard priorities.
- `src/renderer/dev/DevCommandPanel.ts` and `src/renderer/pet.css` add the diagnostics block and development-only 5/10-second buttons without changing window or stage dimensions.
- Existing tray and controller tests were extended for timer state and reaction priorities.

## Exact timer contract

- States: `idle`, `running`, `paused`, `completed`.
- Kinds: `countdown`, `focus`, `short-break`, `long-break`.
- Production presets: 5 minutes, 10 minutes, Focus 25 minutes, Short Break 5 minutes, Long Break 15 minutes.
- Development-only presets: 5 seconds and 10 seconds, accepted by main only when `!app.isPackaged`.
- Normal range: 1–180 minutes; labels are trimmed, non-empty when present, and at most 48 characters.
- Active limit: one. A second start is rejected with `ACTIVE_TIMER_EXISTS`.
- Scheduler: exactly one 1000 ms interval while running, zero while idle, paused, completed, cancelled, or disposed.
- Truth: `remainingMs = max(0, deadlineAt - Date.now())`.
- Timer and completion IDs: non-empty and bounded to 128 characters.

## Exact IPC contract

The channels are:

- `thukuna:productivity-timer-get`
- `thukuna:productivity-timer-start`
- `thukuna:productivity-timer-pause`
- `thukuna:productivity-timer-resume`
- `thukuna:productivity-timer-cancel`
- `thukuna:productivity-timer-acknowledge`
- `thukuna:productivity-timer-changed`

`registerPetWindowIpc()` verifies that every request came from the one pet `BrowserWindow`. Main validates kind, duration, label, and completion identity. Preload validates commands before sending and validates snapshots/results before returning them. It exposes named methods only; raw `ipcRenderer`, Electron, filesystem, and Node APIs remain unavailable in the renderer.

## Persistence and recovery as built

The dedicated file is `<Electron userData>/thukuna-productivity-timer.json`, separate from settings. Running state persists the absolute deadline. Paused state persists frozen remaining time. Completed state persists `completedAt` and the pending-completion bit. Writes occur on start, pause, resume, completion, and completion acknowledgement; cancel removes the file. Repeated idle cancel is a no-op and per-second observer ticks never write.

At startup, a future running deadline starts one scheduler with a recomputed remainder. Paused state stays paused. An expired deadline immediately performs one completed transition, clamps to zero, persists a pending completion, and creates no catch-up loop. A significant manual wall-clock change can shift the result; Phase 16 intentionally does not add NTP or persistent monotonic time.

## Completion and Phase 15 integration as built

Main completes the timer regardless of renderer visibility. While Phase 15 reports `locked` or `suspended`, timer snapshots may update internally but visible completion is withheld. On the next `active` snapshot, main calls `refresh()` from the deadline and republishes current timer truth. The renderer keeps completion pending until `ThukunaController.reactToTimerCompletion()` accepts a safe state. It rejects hard pause, hidden runtime, interaction override, Domain/rare events, and locomotion/other critical states. Sleeping uses the existing Wake path; idle/staring/laughing uses Laugh. Dialogue is exactly `Timer done!` or `Focus session complete!`. A stable completion ID is then acknowledged so later snapshots, hide/show, and renderer reload do not replay an acknowledged completion.

Idle, battery, and Low Power do not alter deadlines. Hide/Show does not own or dispose the main timer. Tray refresh is a pure projection of a snapshot and cannot restart, reset, or complete a timer.

## Automated verification result

- `npm run build`: PASS.
- `npm test`: PASS — 265 tests, 0 failed.
- Baseline retained: all 229 pre-Phase-16 tests pass.
- New coverage: 36 tests spanning service state, late scheduler drift, pause/resume, cancellation, one scheduler, completion identity, restart recovery, lifecycle-only writes, malformed persistence, lock/suspend deferral, unsafe-FSM retry, tray state, diagnostics, IPC/preload validation, Electron security, development controls, and Laugh/Wake/Domain priorities.
- Production invariants remain covered: 180×250 window, 180×180 stage, scale 1, Domain 3400 ms, 116 sprites, 15 families, 20 Domain frames, and Phase 15 awareness behavior.

## Manual Windows validation checklist

Run from this feature branch in normal user PowerShell with `npm run dev`. Open the tray by right-clicking THUKUNA’s icon.

1. Start a 5-minute timer; confirm RUNNING and decreasing tray status.
2. Pause, wait 20 seconds, and confirm the value stays fixed; resume and confirm it continues from that value.
3. Cancel and confirm `No active timer`.
4. Click THUKUNA so the pet window has focus, press `D`, and use Timer 5s in the development diagnostics panel; confirm one Laugh/Wake and one concise line.
5. Start 5 minutes, lock for about 30 seconds, unlock, and confirm about 30 seconds elapsed.
6. Start 5 minutes, sleep for about 60 seconds, resume, and confirm about 60 seconds elapsed with no burst.
7. Let a short development timer expire during sleep; confirm one completion after resume.
8. Hide THUKUNA while a timer runs, wait, show it, and confirm the deadline remained correct.
9. Quit and restart before a deadline; confirm running recovery.
10. Quit and restart after a deadline; confirm one pending completion.
11. Repeat a timer on AC and battery; correctness must be identical.
12. Recheck Crawl, Jump, Climb, Perch, Domain, tray visibility, and Reset Position.

Do not add `--no-sandbox` or `--disable-gpu-sandbox` for this validation. Until this checklist passes, the correct verdict is **B. ENGINEERING COMPLETE — MANUAL WINDOWS VALIDATION REQUIRED** and the branch must not be merged.
