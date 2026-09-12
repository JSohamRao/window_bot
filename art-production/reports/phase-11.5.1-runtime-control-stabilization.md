# Phase 11.5.1 — Runtime Control Stabilization + Electron Host Diagnostic

Date: 2026-09-11

Status: engineering complete; real-Windows visual smoke test remains manual because the Codex host cannot launch Electron's renderer/GPU subprocess.

## Pre-change control audit

This table records the implementation-first audit made before consolidation. “Actual shortcut” describes the old handler, not the final registry below.

| Intended action | Documented shortcut | Actual shortcut | Handler file | Current result before Phase 11.5.1 | Problem |
|---|---|---|---|---|---|
| Diagnostics | `D` | `D` | `src/renderer/pet.ts` | Toggled overlay | Required renderer focus was undocumented; no command result telemetry |
| Crawl | `Shift+2`; plain `3` was also easy to interpret as Crawl | `Shift+2` forced state; `3` previewed sprites only | `src/renderer/pet.ts` | Two different operations looked like one | Documentation ambiguity; preview did not move the window |
| Sprint | `Alt+1` | `Alt+1` | `src/renderer/pet.ts` | Called rare-event force path | Rejections were discarded and active-state/cooldown gates were invisible |
| Jump | `Ctrl+Shift+J` | Same | `src/renderer/pet.ts` | Called locomotion force path | Ground/Low Power/capability failure was silent |
| Jump Left | `Ctrl+Shift+Left` | Same | `src/renderer/pet.ts` | Requested left Jump | Failure was silent |
| Jump Right | `Ctrl+Shift+Right` | Same | `src/renderer/pet.ts` | Requested right Jump | Failure was silent |
| Hop | `Ctrl+Shift+H` | Same | `src/renderer/pet.ts` | Called locomotion force path | Ground/Low Power/capability failure was silent |
| Fall | `Ctrl+Shift+F` | Same | `src/renderer/pet.ts` | Called physical Fall path | The required elevated geometry was undocumented and rejection was silent |
| Climb Up | `Ctrl+Shift+Up` | Same | `src/renderer/pet.ts` | Called climb path | Near-edge and capability gates were silent |
| Climb Down | `Ctrl+Shift+Down` | Same | `src/renderer/pet.ts` | Called climb path | Near-edge and capability gates were silent |
| Perch | `Ctrl+Shift+P` | Same | `src/renderer/pet.ts` | Called perch path | Near-edge and capability gates were silent |
| Drop | Reused `Ctrl+Shift+F` after Perch in the old report | No dedicated Drop command | `src/renderer/pet.ts` | Could not distinguish Drop intent from generic Fall | Missing deterministic command and explicit `NOT_PERCHED` feedback |
| Watch | `Shift+M` | Same | `src/renderer/pet.ts` | Called cursor force path | Settings, Low Power, capability and active-state rejection were silent |
| Chase | `Shift+C` | Same | `src/renderer/pet.ts` | Called cursor force path | Could inherit Crawl movement cooldown and exit immediately; other rejection was silent |
| Sleep | `Shift+6` | Same | `src/renderer/pet.ts` | Forced Sleep | A paused-autonomy state could strand a forced state; no result feedback |
| Wake | Sleep was expected to wake naturally | No dedicated Wake command | — | Not directly testable | Missing deterministic command |
| Laugh | Existing shifted number branch | `Shift+4` | `src/renderer/pet.ts` | Forced Laugh | A paused-autonomy state could strand a forced state; no result feedback |
| Angry | `Shift+5` | Same | `src/renderer/pet.ts` | Forced Angry | A paused-autonomy state could strand sequencing; no result feedback |
| Rage | `Shift+R` | Same, in a separate branch | `src/renderer/pet.ts` | Called direct interaction reaction | Split routing and ignored boolean result |
| Fall Over | `Alt+2` | Same | `src/renderer/pet.ts` | Called rare-event force path | Rejection/cooldown/current-state reason was silent |
| Creepy Freeze | Existing Alt-number branch | `Alt+3` | `src/renderer/pet.ts` | Called rare-event force path | Rejection was silent |
| Zoom Stare | Existing Alt-number branch | `Alt+4` | `src/renderer/pet.ts` | Called rare-event force path | Rejection was silent |
| Chaos Run | Existing Alt-number branch | `Alt+5` | `src/renderer/pet.ts` | Called rare-event force path | Rejection was silent |
| Domain | `Alt+6` | Same | `src/renderer/pet.ts` | Called canonical Domain force path | Could be rejected by an active state without explanation |
| Reset Position | Tray only | No keyboard command | — | Not independently testable | Missing narrow renderer-to-main dev request |

The old renderer used one `keydown` listener, but recognition and execution were distributed across multiple maps and branches. Calls returned booleans or `void`; the handler did not surface their outcome. `event.repeat` was not centrally rejected. The window is shown with `showInactive()`, so a user can press a correct key while another app owns focus. CSS contained no `-webkit-app-region: drag`; dragging is the existing pointer/IPC implementation, so draggable-region interception was not a cause.

## Completion report

### Control system

1. **Phase 11.5.1 summary.** Added one strongly typed, development-only command registry/controller/runtime adapter; explicit acceptance/rejection telemetry; deterministic cleanup and force paths; Wake, Drop, Reset Position and optional Landing commands; focused-stage input; startup instrumentation; documentation and tests. No Phase 12 work was performed.

2. **Root causes of unresponsive commands.** Missing focus after `showInactive()`; README ambiguity between full Crawl and sprite preview; scattered routing; ignored boolean outcomes; hidden autonomy/settings/Low Power/platform/geometry/current-state gates; missing Wake/Drop/Reset commands; no repeat suppression; rare-event/Rage replacement without one common cleanup policy; and forced Crawl/Chase inheriting ordinary movement-memory cooldown.

3. **Files inspected.** `package.json`, `README.md`, `src/main/main.ts`, `src/main/petWindow.ts`, IPC/preload/shared channel files, renderer HTML/CSS/global types, `src/renderer/pet.ts`, `ThukunaController`, movement/locomotion/cursor/rare-event/power controllers and configs, state implementations, existing control/geometry/event tests, and Phase 11.5 reports.

4. **Files modified.** `README.md`; `src/main/{main.ts,petWindow.ts,ipc.ts,preload.ts}`; `src/shared/ipcChannels.ts`; `src/renderer/{index.html,pet.css,pet.ts,global.d.ts}`; `src/renderer/engine/ThukunaController.ts`; new `src/renderer/dev/{devCommandRegistry.ts,DevCommandController.ts,ThukunaDevCommandRuntime.ts}`; new `tests/{devCommandController.test.ts,devCommandRuntime.test.ts}`; `tests/thukunaController.test.ts`; and this report.

5. **Previous shortcut architecture.** One window key listener contained several independent maps and conditional branches. Documentation was manually maintained and return values were not observed.

6. **New shortcut architecture.** The single key listener delegates exact recognition to `DevCommandController`, which resolves one registry definition, rejects repeat, asks `ThukunaDevCommandRuntime` to check preconditions/execute, then records requested and actual state/animation.

7. **Authoritative registry path.** `src/renderer/dev/devCommandRegistry.ts`.

8. **Keyboard matching strategy.** Exact `KeyboardEvent.code` plus exact `ctrlKey`, `altKey`, `shiftKey`, and `metaKey` booleans. Number-row commands use `Digit0`–`Digit7`; Numpad keys are not aliases.

9. **Focus requirements.** Local renderer focus is required; click THUKUNA once, then use controls. The pet stage is minimally focusable and pointer-down focuses it. No global hook was added.

10. **Draggable-region findings.** No CSS app drag region exists. Existing pointer capture and validated drag IPC remain intact; the focus change does not replace or resize that surface.

11. **Key-repeat handling.** Every registered command is one-shot. A recognized repeated key returns `KEY_REPEAT` and does not execute.

12. **Dev enable policy.** One `DEVELOPMENT_CONTROLS_ENABLED` constant controls the entire command surface; no scattered environment checks were added.

13. **Diagnostic telemetry added.** Last key, command, accepted/rejected result, reason/detail, request and actual state/animation, FSM timing, frame/scale/anchor, movement/locomotion/side/velocity, window/stage size, platform/capabilities, power/autonomy, left/right edge, cursor dx/dy/same-display/mode/planner/query counts, rare event, override, clicks, Rage and dialogue.

14. **Command result model.** `DevCommandResult` contains `accepted`, `reason`, optional `detail`, `commandId`, `label`, `shortcut`, `requestedState`, `actualState`, `requestedAnimation`, and `actualAnimation`.

15. **Rejection-reason model.** Typed reasons are `KEY_REPEAT`, `NOT_STARTED`, `WINDOW_HIDDEN`, `AUTONOMY_PAUSED`, `LOW_POWER_BLOCKED`, `MOVEMENT_CAPABILITY_DISABLED`, `CURSOR_CAPABILITY_DISABLED`, `MOUSE_AWARENESS_DISABLED`, `RARE_EVENTS_DISABLED`, `CURRENT_STATE_BLOCKED`, `DRAG_ACTIVE`, `NOT_NEAR_EDGE`, `NOT_GROUNDED`, `NOT_ELEVATED`, `NOT_PERCHED`, `NOT_SLEEPING`, `RESET_UNAVAILABLE`, `EXECUTION_REJECTED`, and `EXECUTION_ERROR`; success uses `NONE`.

### Final commands

| # | Action | Shortcut | Preconditions | Expected result | Rejection reasons |
|---:|---|---|---|---|---|
| 16 | Diagnostics | `D` | Focused pet window | Overlay toggles | — |
| 17 | Idle | `Shift+1` | Not dragging | `IDLE` / `idle` | `DRAG_ACTIVE`, unavailable runtime |
| 18 | Crawl | `Shift+2` | Autonomy running; ground movement allowed | `CRAWLING`; start → loop → stop → Idle | autonomy, Low Power, capability, drag |
| 19 | Sprint | `Alt+1` | Autonomy and rare/moving events enabled | Canonical `SPRINT` | autonomy, settings, Low Power, capability, drag |
| 20 | Jump | `Ctrl+Shift+J` | Grounded; Jump allowed | Physical `JUMPING` | not grounded, Low Power, capability, drag |
| 21 | Jump Left | `Ctrl+Shift+Left` | Grounded; Jump allowed | Physical left Jump | not grounded, Low Power, capability, drag |
| 22 | Jump Right | `Ctrl+Shift+Right` | Grounded; Jump allowed | Physical right Jump | not grounded, Low Power, capability, drag |
| 23 | Hop | `Ctrl+Shift+H` | Grounded; Hop allowed | Short physical `HOPPING` | not grounded, Low Power, capability, drag |
| 24 | Fall | `Ctrl+Shift+F` | Elevated; gravity allowed | Physical `FALLING` | `NOT_ELEVATED`, capability, drag |
| 25 | Climb Up | `Ctrl+Shift+Up` | Near left/right edge; Climb allowed | `CLIMBING` upward on reported side | `NOT_NEAR_EDGE`, Low Power, capability, drag |
| 26 | Climb Down | `Ctrl+Shift+Down` | Near left/right edge; Climb allowed | `CLIMBING` downward on reported side | `NOT_NEAR_EDGE`, Low Power, capability, drag |
| 27 | Perch | `Ctrl+Shift+P` | Near left/right edge; Perch allowed | `PERCHED` enter/idle/exit | `NOT_NEAR_EDGE`, Low Power, capability, drag |
| 28 | Drop | `Ctrl+Shift+D` | Currently perched; gravity allowed | Physical `FALLING` | `NOT_PERCHED`, capability, drag |
| 29 | Watch | `Shift+M` | Autonomy/mouse awareness/cursor capability | `WATCHING_CURSOR` | autonomy, mouse setting, Low Power, capability, drag |
| 30 | Chase | `Shift+C` | Autonomy/mouse awareness/chase capability | `CHASE_MOUSE`; existing planner owns movement | autonomy, mouse setting, Low Power, capability, drag |
| 31 | Sleep | `Shift+6` | Autonomy running; not dragging | `sleep_enter` → `sleep_loop` | autonomy, drag |
| 32 | Wake | `Shift+7` | Currently sleeping; not dragging | `wake` → Idle recovery | `NOT_SLEEPING`, drag |
| 33 | Laugh | `Shift+4` | Autonomy running; not dragging | `LAUGHING` | autonomy, drag |
| 34 | Angry | `Shift+5` | Autonomy running; not dragging | enter → loop → exit | autonomy, drag |
| 35 | Rage | `Shift+R` | Not dragging | Canonical direct `RAGE` | drag, execution rejection |
| 36 | Fall Over | `Alt+2` | Autonomy/rare/local events enabled | Canonical `FALL_OVER` | autonomy, settings, Low Power, capability, drag |
| 37 | Creepy Freeze | `Alt+3` | Autonomy/rare/local events enabled | Canonical `CREEPY_FREEZE` | autonomy, settings, Low Power, capability, drag |
| 38 | Zoom Stare | `Alt+4` | Autonomy/rare/local events enabled | Canonical `ZOOM_STARE` | autonomy, settings, Low Power, capability, drag |
| 39 | Chaos Run | `Alt+5` | Autonomy/rare/moving events enabled | Canonical `CHAOS_RUN` | autonomy, settings, Low Power, capability, drag |
| 40 | Domain | `Alt+6` | Autonomy/rare/local events enabled | Canonical 3400 ms `DOMAIN_EXPANSION` | autonomy, settings, Low Power, capability, drag |
| 41 | Reset Position | `Ctrl+Shift+0` | Reset capability; not dragging | Validated main-process safe floor reset and Idle cleanup | `RESET_UNAVAILABLE`, drag |

Optional Landing is `Ctrl+Shift+L`. Plain `3` remains explicitly named **Preview Crawl Sprites**; it does not move the window.

### Validation

42. **Shortcut collision result.** PASS — zero exact active shortcut collisions across all 44 registry commands.

43. **README consistency result.** PASS — automated audit finds every registry label and formatted shortcut in `README.md`.

44. **Low Power rejection behavior.** PASS — prohibited movement, cursor commands, and rare events return `LOW_POWER_BLOCKED`; safe local interaction policy remains intact.

45. **Platform-capability rejection behavior.** PASS — forbidden movement/cursor/reset operations return capability-specific rejection and do not bypass native Wayland limits.

46. **Climb rejection feedback.** PASS — non-edge requests return `NOT_NEAR_EDGE`; the overlay shows left/right edge state, command direction, locomotion phase and attached side.

47. **Perch rejection feedback.** PASS — direct Perch reports `NOT_NEAR_EDGE` or movement capability/Low Power/drag rejection as applicable.

48. **Cursor planner diagnostic.** PASS — overlay shows dx, dy, same-display, near-edge state, cursor mode, planner result and unchanged query counters. No new sampling was added.

49. **Domain force-test behavior.** PASS AUTOMATED — canonical cleanup precedes the existing `RareEventController.forceStart` path; ordinary cooldown is bypassed; the existing 3400 ms staged implementation and transform cleanup tests pass.

50. **Rage force-test behavior.** PASS AUTOMATED — direct interaction-reaction path, canonical replacement cleanup and normal click-triggered Rage coexist.

51. **Automated dev-command test result.** PASS — exact matching, wrong modifiers, unknown keys, repeat, enable policy, collisions, documentation, every required dispatch, rejection paths, cleanup, cooldown bypass, and narrow Reset dispatch are covered.

52. **Manual smoke-test status.** MANUAL LOCAL TEST REQUIRED for visible real-Windows behavior. Every required command is PASS AUTOMATED; none is labelled PASS LIVE because the Codex renderer cannot launch.

| Commands | Classification |
|---|---|
| Diagnostics, Idle, Crawl, Sprint, Jump, Jump Left, Jump Right, Hop, Fall, Climb Up, Climb Down, Perch, Drop, Watch, Chase, Sleep, Wake, Laugh, Angry, Rage, Fall Over, Creepy Freeze, Zoom Stare, Chaos Run, Domain, Reset Position | PASS AUTOMATED |

53. **Total test count.** 185 passed, 0 failed (baseline was 167).

54. **Strict TypeScript/build result.** PASS — `npm run build` exits 0.

### Electron host diagnostic

55. **Electron version.** Installed Electron `44.2.0`.

56. **Current startup command.** `npm start` runs `npm run build && electron .`; it is unchanged.

57. **App command-line switches.** None intentionally set by THUKUNA. There is no `app.commandLine.appendSwitch`, `app.disableHardwareAcceleration`, custom `userData`, or custom cache path. `BrowserWindow` keeps `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.

58. **Normal Codex-host launch result.** FAIL — `electron .` exits 1 after repeated GPU subprocess failures.

59. **Temporary `--disable-gpu` result.** FAIL — `electron . --disable-gpu` still reaches the same fatal GPU subprocess condition. The switch was diagnostic only and was not saved.

60. **Temporary clean-profile result.** FAIL — isolated writable `--user-data-dir=C:\Users\soham\AppData\Local\Temp\thukuna-codex-phase1151-20260911-a` removes the os_crypt/cache errors from output, but GPU subprocess exit `-1073741515` persists. The sandbox prevented automated cleanup of this temporary diagnostic directory after creation.

61. **Point at which startup fails.** The main module loads, Electron becomes ready, and BrowserWindow construction completes. The renderer process then reports `launch-failed (49)` before `did-finish-load` or `ready-to-show`.

62. **Was `main.ts` reached?** YES — `[THUKUNA startup] Main module reached.` and app-ready markers print.

63. **Was BrowserWindow creation reached?** YES — both pre-construction and post-construction markers print.

64. **Was renderer startup reached?** NO — renderer process launch fails before document load completion; no window becomes targetable. This isolates the failure from THUKUNA renderer state/animation logic.

65. **GPU subprocess evidence.** Chromium repeatedly reports `GPU process exited unexpectedly: exit_code=-1073741515`, then `GPU process isn't usable. Goodbye.` The Windows code corresponds to `0xC0000135`; no specific missing DLL was identified, so none is claimed.

66. **Cache/profile evidence.** The normal profile reports os_crypt `0x8009000B`, cache access denied `0x5`, and GPU cache creation failures. Those messages disappear under the clean profile while the GPU crash remains, so profile/cache errors are separate and not sufficient to explain the fatal launch.

67. **Final Codex-host classification.** **HOST-SPECIFIC GPU/RUNTIME ISSUE**.

68. **Production GPU policy changed?** NO. No hardware-acceleration disable or GPU switch was persisted.

69. **Sandbox/security unchanged?** YES — sandbox remains enabled, context isolation remains enabled, and Node integration remains disabled.

### Final

70. **Unresolved manual-command issues.** No known automated control defect remains. Visible timing, animation legibility, real screen-edge attachment, tray behavior and physical cursor motion still require the user's normal Windows desktop because Codex cannot start the renderer.

71. **Remaining Phase 11.5 live checks.** Run all required commands once in Normal mode, then targeted Low Power/Chaos rejection checks; verify both screen edges, elevated Fall, Perch→Drop, cursor planning, tray Reset separately, dialogue/Rage, and fixed size/scale. The final soak remains deferred.

72. **Exact local smoke-test instructions.** In PowerShell, run `npm start`; click THUKUNA once; press `D`; ensure Normal mode and autonomy are enabled; execute the shortcuts in the authoritative table. For Fall, drag him above the floor and release first. For Climb/Perch, drag to a screen edge and release first. For Drop, enter Perch first. For Wake, enter Sleep first. Keep the cursor nearby for Watch/Chase. After every key verify Last Command, `ACCEPTED` or `REJECTED`, reason, expected state, expected animation, `WINDOW: 180x250`, `STAGE: 180x180`, and `SCALE: 1.000`.

73. **Final performance/soak.** NOT RUN, as required.

74. **Phase 12.** NOT STARTED.
