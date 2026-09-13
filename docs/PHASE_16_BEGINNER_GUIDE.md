# THUKUNA Phase 16 — Beginner Guide

## What was built

Phase 16 gives THUKUNA one lightweight local productivity timer. You can start Focus 25 minutes, Short Break 5 minutes, Long Break 15 minutes, ordinary 5 minutes, or ordinary 10 minutes from the tray. You can pause, resume, or cancel it. In development, the existing diagnostics panel also has 5-second and 10-second test buttons.

There is no cloud service, account, telemetry, calendar, task database, Windows toast, microphone, screenshot, clipboard access, or AI model involved. The timer is private local state on this computer.

## 1. What a countdown timer is in software

A countdown timer is a state machine around a future point in time. It remembers what kind of timer is running, when it should finish, and whether it is running, paused, completed, or idle. A screen that says `18:42` is only a view of that state; it is not the clock itself.

The central Phase 16 state is `ProductivityTimerSnapshot`:

- `idle`: no timer exists.
- `running`: a deadline exists and the remaining value is derived from it.
- `paused`: the remaining value is frozen and there is no active deadline.
- `completed`: remaining time is zero; a visible THUKUNA reaction may still be pending.

Timer kinds describe intent: `countdown`, `focus`, `short-break`, and `long-break`. They do not create an automatic Pomodoro workflow.

## 2. Why decrementing once per second is unreliable

A tempting implementation is `remainingSeconds--` inside `setInterval(..., 1000)`. That assumes every callback runs exactly one second later. Desktop schedulers do not promise that. A busy CPU, hidden renderer, lock screen, or sleeping laptop can delay callbacks. If one callback arrives five seconds late and the code subtracts only one second, the timer is four seconds wrong.

THUKUNA stores an absolute wall-clock deadline instead:

```text
deadlineAt = Date.now() + durationMs
remainingMs = max(0, deadlineAt - Date.now())
```

The one-second interval is only a messenger that asks, “What does the clock say now?” It is not the source of elapsed time.

Example: a 25-minute Focus timer starts at 10:00, so its deadline is 10:25. At 10:07 the calculation is `10:25 - 10:07 = 18 minutes`. It does not matter whether 420 callbacks or 415 callbacks happened.

`Date.now()` is wall-clock time in milliseconds since the Unix epoch. It naturally advances while Windows is locked and across ordinary system sleep. The tradeoff is that manually moving the system clock can move the apparent countdown. Phase 16 documents that limitation instead of adding complicated clock synchronization.

## 3. Why main owns the real timer

Electron has a trusted main process and a sandboxed renderer. The renderer draws THUKUNA and runs the behavior FSM, but it can be hidden or throttled. Main owns the application lifecycle and tray, so `ProductivityTimerService` lives there and holds the one authoritative snapshot.

The renderer never decrements time and never declares completion. It receives validated copies. This prevents two clocks from disagreeing and lets Hide/Show leave the timer alone.

## 4. Architecture diagram

```text
Tray menu                                  THUKUNA renderer
    | start/pause/resume/cancel                   |
    |                                             | named command
    +----------------------+----------------------+
                           v
                 Secure preload API
                           |
                           | validated, typed IPC
                           v
                    Electron main
                           |
                           v
              ProductivityTimerService
                 |         |         |
                 |         |         +--> one 1000 ms scheduler while RUNNING
                 |         +------------> absolute Date.now() deadline
                 +----------------------> lifecycle-only JSON persistence
                           |
                           | authoritative snapshot/change event
                           v
                 Secure preload validator
                           |
                           v
              ProductivityTimerController
                           |
                   Phase 15 safety gate
                           |
                           v
          ThukunaController Laugh/Wake + dialogue
                           |
                           v
                 completion acknowledgement
```

The tray arrow is direct because tray callbacks already run in main. The renderer command crosses preload because the sandbox must not access Electron IPC directly. IPC reaches the one service. The service reads `Date.now()`, optionally persists a lifecycle transition, and emits a snapshot. Preload rejects malformed data before the renderer sees it. The renderer controller waits for an active Phase 15 session and a safe FSM state. After one accepted reaction, it acknowledges the stable completion ID so it cannot replay later.

## 5. Start, pause, resume, cancel, and complete

Start validates the timer kind, whole-millisecond duration, and optional label. Normal duration is 1–180 minutes. Main rejects a new start if a running, paused, or unacknowledged completed timer already exists. It creates an ID, calculates the deadline, persists once, starts one scheduler, and emits RUNNING.

Pause first recomputes the current remainder from the deadline. It stores that number, clears `deadlineAt`, records `pausedAt`, stops the scheduler, persists once, and emits PAUSED.

Example: 10 minutes remain and the user pauses. Twenty minutes pass. The stored remainder is still 10 minutes because paused state has no live deadline. On Resume, the new deadline is `current Date.now() + 10 minutes` and one scheduler starts again.

Cancel stops the scheduler, returns to IDLE, removes pending completion, clears the dedicated persistence file, and emits the new state. Calling Cancel again while already idle succeeds without another disk operation.

Complete happens only if state is RUNNING and current time is at or beyond the deadline. It clamps remaining time to zero, stops the scheduler, changes state to COMPLETED, assigns the timer ID as the completion ID, marks completion pending, persists, and emits once. Later ticks and refreshes see that state is no longer RUNNING and cannot complete it again.

## 6. Lock, sleep, resume, idle, and battery

Lock is a visual safety boundary, not a timer pause. A 10-minute timer locked for 3 minutes has about 7 minutes left after unlock. Main may complete it while locked, but the renderer reaction remains pending.

Sleep also does not pause the deadline. Suppose the deadline is 15:30 and the laptop sleeps at 15:20. If it wakes at 15:28, `15:30 - 15:28` gives about 2 minutes. If it wakes at 15:35, remaining time clamps to zero and state becomes COMPLETED. It never displays negative five minutes and never runs a storm of missed ticks.

Phase 15 publishes session changes. On resume/unlock, main explicitly refreshes the timer from its deadline and sends current truth. The renderer sets the timer controller’s session state. Locked and suspended states block visible reaction; active state permits it. User idle, AC/battery, and Low Power are soft contexts and do not change the clock or duration.

## 7. Persistence and restart recovery

The file `<Electron userData>/thukuna-productivity-timer.json` stores only what is necessary. It is separate from ordinary settings.

- RUNNING stores identity, duration, kind, label, start time, and absolute deadline.
- PAUSED stores identity, duration, kind, label, start/pause time, and frozen remainder.
- COMPLETED stores identity, completion time, and whether the reaction is still pending.

The file is written through a queue to a temporary file and atomically renamed. The one-second updates do not write. That avoids needless SSD work and keeps persistence independent of display frequency.

On restart, a future running deadline is restored with its mathematically correct remainder and one scheduler. A paused timer stays paused. A past running deadline becomes one pending completed timer immediately. A completed pending timer remains available for one safe reaction after the renderer is ready.

## 8. How tray, IPC, and preload fit together

The tray’s Productivity Timer submenu is generated from the current snapshot. While RUNNING, Pause and Cancel are enabled and Resume is disabled. While PAUSED, Resume and Cancel are enabled. While IDLE, presets are enabled and lifecycle controls are disabled. The menu model only reads a snapshot; refreshing it cannot change a deadline.

Renderer calls use named preload methods such as `startProductivityTimer()`, `pauseProductivityTimer()`, and `onProductivityTimerChanged()`. Preload is the narrow security bridge. It validates outbound start requests and inbound snapshots/results. Main validates again because renderer input is never trusted. Raw `ipcRenderer`, filesystem access, and Node APIs are not exposed.

## 9. Completion reaching THUKUNA’s FSM

`ProductivityTimerController` observes authoritative snapshots. A pending completion is attempted only in an active Windows session. `ThukunaController.reactToTimerCompletion()` then enforces behavior priority.

It rejects hidden, locked, suspended, dragging/interaction override, Domain/rare event, and unsafe locomotion or critical states. The pending completion remains in main and the renderer retries when the pet emits another safe snapshot. Sleeping THUKUNA uses the existing Wake animation. Idle, Staring, or already Laughing THUKUNA uses the existing Laugh state. Dialogue shows either `Timer done!` or `Focus session complete!`.

No sprite, animation family, Domain timing, stage size, or BrowserWindow size changed.

## 10. Why it stays lightweight and private

There is one interval only while RUNNING, at 1000 ms. There is no interval while idle, paused, completed, cancelled, or disposed. There is one renderer subscription, no per-frame time query, no catch-up loop, and no per-second persistence. IPC updates occur only on useful one-second changes or lifecycle changes.

All data stays local. Phase 16 adds no network request and no sensitive monitoring. Electron remains `sandbox: true`, `contextIsolation: true`, and `nodeIntegration: false`.

## 11. File-by-file map

### `src/shared/productivityTimer.ts`

Purpose: defines the language every layer shares. Imported by main, preload, renderer, tray, and tests. It owns no runtime state and must never start a scheduler. Test its validators, presets, copy helper, and formatter. Interview point: shared discriminated unions prevent layers from inventing incompatible states.

### `src/main/productivityTimer/ProductivityTimerService.ts`

Purpose: authoritative timer state and lifecycle. `main.ts` creates one instance; IPC and tray call it. It owns the deadline, one scheduler handle, completion identity, and in-memory snapshot. It must not own UI, animations, tray widgets, or renderer behavior. Test it with a fake clock, scheduler, and persistence. Interview point: dependency injection makes time-based code deterministic.

### `src/main/productivityTimer/ProductivityTimerStore.ts`

Purpose: validate and atomically persist version-1 lifecycle records. The service calls it. It owns a serialized write queue and counters used for diagnostics/tests, not timer truth. It must not calculate remaining time or schedule work. Test missing, malformed, valid, save, and clear paths. Interview point: atomic replace avoids partially written JSON.

### `src/shared/ipcChannels.ts`

Purpose: canonical channel names. Main and preload import it. It owns constants only. Test that every installed handler has cleanup. Interview point: centralized channels reduce typo-based contracts.

### `src/main/ipc.ts`

Purpose: authorize the pet window, validate input, and dispatch to the injected timer service. `main.ts` registers it once. It owns handler lifecycle, not timer state. Test invalid kinds/durations and handler cleanup. Interview point: validate at the trust boundary even if preload already validates.

### `src/main/preload.ts` and `src/renderer/global.d.ts`

Purpose: provide the smallest renderer API and its browser-visible TypeScript contract. Electron creates preload with the pet window; renderer calls the named functions. They own validation and subscription cleanup, not the clock. Test malformed responses and confirm raw `ipcRenderer` is not an exposed property. Interview point: context isolation is useful only when the bridge is narrow.

### `src/main/trayMenuModel.ts` and `src/main/tray.ts`

Purpose: project a timer snapshot into labels and enabled states, then map clicks to service commands. Main creates the tray. They own presentation and click wiring, not timer state. Test all four lifecycle states and prove model generation does not mutate the snapshot. Interview point: pure view models make tray behavior testable without launching Electron.

### `src/renderer/engine/ProductivityTimerController.ts`

Purpose: observe validated snapshots, reject stale updates, defer unsafe completion, and acknowledge one stable ID. `pet.ts` creates it. It owns subscription state and delivery bookkeeping, not deadline truth. Test duplicate events, renderer cleanup, lock/suspend, stale updates, and unsafe-FSM retry. Interview point: it is an observer/controller, not a second timer engine.

### `src/renderer/engine/ThukunaController.ts`

Purpose in Phase 16: `reactToTimerCompletion()` decides whether an existing Wake/Laugh transition is currently legal. It already owns the FSM. The timer must not bypass its priority rules. Test Idle, Sleeping, Domain, and lock/suspend cases. Interview point: external utility events request behavior; the FSM remains final authority.

### `src/renderer/pet.ts` and `src/renderer/dialogue/thukunaDialogue.ts`

Purpose: compose Phase 15 awareness, the timer observer, THUKUNA’s safe reaction, and concise dialogue. The renderer entry point creates and disposes controllers. It must not calculate the countdown. Test the underlying controllers rather than duplicating clock logic here. Interview point: composition roots connect dependencies but should not own domain algorithms.

### `src/renderer/dev/ProductivityTimerDiagnostics.ts` and `src/renderer/dev/DevCommandPanel.ts`

Purpose: show compact state and provide development-only 5/10-second controls. The dev panel creates its elements when development controls are enabled. They own text/buttons only. Test formatting and canonical preset routing. Interview point: short tests use the production path, avoiding a fake implementation that could hide bugs.

### `src/main/main.ts`

Purpose: application composition and lifecycle. It creates the store/service, restores before opening the UI, injects IPC, sends snapshots, refreshes after Phase 15 resume, wires tray actions, and disposes. It owns the single service instance but not the timer algorithm. Test most behavior through the service and static integration checks. Interview point: keeping construction at one root makes ownership obvious.

## 12. Debugging guide

Timer does not start: inspect `isProductivityTimerStartRequest()` and `ProductivityTimerService.startTimer()`. Check whether another running, paused, or pending completed timer returns `ACTIVE_TIMER_EXISTS`.

Timer freezes: inspect the diagnostics Scheduler field and `ProductivityTimerService.ensureScheduler()`. Even if visual updates freeze, call/get snapshot and compare `deadlineAt - Date.now()` before assuming truth froze.

Timer loses seconds: inspect `getSnapshot()` and `refresh()`. They must subtract the current wall clock; never add tick counters.

Timer completes twice: log `timerId`, `completionId`, and `completionPending`. Inspect `complete()` state guard, startup restore’s early return, renderer `deliveredCompletionIds`, and acknowledgement result.

Timer disappears after Hide/Show: confirm `hideThukuna()` does not dispose `productivityTimerService`, and `did-finish-load` sends `productivityTimerChanged` when recreating the renderer.

Timer resets after restart: inspect the actual user-data JSON, `ProductivityTimerStore.load()`, validation warnings, and `ProductivityTimerService.restore()`.

Timer fails after sleep: inspect Phase 15 resume in `main.ts`, which calls `productivityTimerService.refresh()`. Compare the stored absolute deadline with current `Date.now()`.

Timer does not restore: verify the JSON is version 1, kind is valid, label is bounded, timestamps are finite, and duration is not above 180 minutes.

Tray says wrong state: inspect `createProductivityTimerTrayModel()` and the snapshot passed by `refreshTray()`. The tray should never cache a second timer object.

Completion reaction does not play: check session state, runtime visibility, current FSM state, interaction override, then `reactToTimerCompletion()`. Pending completion should remain YES until a safe opportunity.

Scheduler duplicates: inspect `intervalHandle`, `ensureScheduler()`, and `stopScheduler()`. The fake-scheduler tests assert start/resume/restore cannot own two handles.

CPU usage rises unexpectedly: diagnostics should show Scheduler STOPPED outside RUNNING. Look for accidental per-frame calls or extra subscriptions; Phase 16 requires one 1 Hz scheduler and one renderer subscription.

## 13. Interview questions

### Why use a deadline instead of decrementing once per second?

Beginner answer: callbacks can arrive late, but subtracting two actual clock times still gives the right remainder.

Interview-quality answer: interval scheduling is best effort. An absolute deadline makes elapsed-time correctness independent of callback count and naturally handles throttling, lock, and suspend/resume.

Follow-up: what tradeoff does `Date.now()` introduce when the system clock changes manually?

### Why put timer ownership in main?

Beginner answer: main survives renderer hiding/throttling and already owns the tray.

Interview-quality answer: one main-process aggregate prevents split-brain state across native tray and renderer, centralizes persistence/lifecycle, and keeps the renderer an eventually updated projection.

Follow-up: how would you preserve ownership if the renderer were recreated?

### How do you handle system sleep?

Beginner answer: keep the original deadline and subtract the new current time after wake.

Interview-quality answer: do not replay missed interval callbacks. Resume triggers one refresh against wall-clock truth; future deadline restores the remainder, past deadline makes one completion transition.

Follow-up: why is a catch-up loop both wasteful and potentially incorrect?

### How do you avoid duplicate completion?

Beginner answer: only RUNNING can become COMPLETED, and every completion has one stable ID.

Interview-quality answer: the service has an idempotent state guard; persisted completion retains identity/pending state; renderer deduplicates the ID and main identity-checks acknowledgement. Startup expired recovery returns after its one completion emission.

Follow-up: what delivery tradeoff exists between acknowledging before versus after a visible reaction?

### How do you persist a running timer?

Beginner answer: save the deadline, not every number shown on screen.

Interview-quality answer: persist a versioned lifecycle record containing immutable metadata plus absolute `deadlineAt`; derive remainder on recovery. Atomic queued writes serialize transitions.

Follow-up: how would you migrate a future version-2 record?

### Why not save every tick?

Beginner answer: the deadline already contains the answer, so every-second writes waste disk work.

Interview-quality answer: tick persistence adds I/O, contention, and crash surface without increasing correctness; lifecycle transitions are the only durable information changes.

Follow-up: which transitions must be durable?

### How do you pause a deadline-based timer?

Beginner answer: calculate the remainder once, remove the deadline, and freeze that number.

Interview-quality answer: atomically snapshot `max(0, deadline-now)`, transition to PAUSED, stop scheduling, and persist remainder. Resume constructs a fresh deadline.

Follow-up: why should paused state not retain a live deadline as truth?

### How do you avoid renderer throttling problems?

Beginner answer: the renderer only displays main’s answer.

Interview-quality answer: renderer scheduling is never part of correctness. Main holds the aggregate and its snapshot getter derives from wall time, so delayed UI events only affect freshness of display.

Follow-up: what should the UI do when it receives an older snapshot?

### How do Phase 15 and Phase 16 interact?

Beginner answer: Phase 15 says whether Windows is active, locked, or suspended; Phase 16 keeps counting but waits to animate safely.

Interview-quality answer: timer truth is orthogonal to system safety. Session events gate presentation and force a resume refresh, while idle/power remain soft contexts that cannot alter deadlines.

Follow-up: why must lock not automatically call Pause?

### How do you keep it lightweight?

Beginner answer: one timer, one interval only when running, and no constant disk writes.

Interview-quality answer: a single owner uses a 1 Hz observer scheduler; paused/idle/completed states are quiescent, persistence is transition-driven, IPC is bounded, and existing FSM/assets are reused.

Follow-up: what metrics would reveal an accidental scheduler leak?

## 14. Tests and physical validation

Automated tests inject fake time, so one test can move from 1 second to 70 seconds instantly and prove deadline correctness without waiting. Fake schedulers count active handles. Fake persistence counts writes and supplies restart records. Renderer tests inject duplicate snapshots, locked/suspended states, and rejected FSM attempts. Pure tray and diagnostics tests run without Electron GUI.

The result is 265 passing tests: all 229 baseline tests plus 36 Phase 16 tests. Automated checks cannot faithfully press the real Windows tray, lock the desktop, or suspend the user’s laptop from the Codex host. Follow the 12-step checklist in `docs/PHASE_16_PRODUCTIVITY_TIMERS.md` before merging.

## PHASE 16 IN 5 MINUTES

Remember these ideas:

1. Main owns one timer; tray and renderer are clients.
2. The deadline is truth: `max(0, deadline - Date.now())`.
3. One 1000 ms interval updates observers only while RUNNING.
4. Pause freezes remainder; Resume makes a new deadline; Cancel returns IDLE.
5. Lifecycle transitions persist; ticks do not.
6. Lock and sleep never pause the deadline. Resume recomputes once.
7. Completed state carries one stable pending ID until a safe Laugh/Wake is acknowledged.
8. Phase 15 blocks visible reaction during lock/suspend; THUKUNA’s FSM blocks Domain and unsafe movement interruption.
9. Preload and main validate the narrow IPC contract; raw Electron stays hidden.
10. The branch is engineering-complete only after build/tests; normal Windows validation is still required before merge.
