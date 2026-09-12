# Phase 11.5.2 — Live Command Reliability + Domain Repair + Electron Host Runtime Repair

Date: 2026-09-11

Status: engineering complete. The deterministic command surface and canonical Domain path are verified by 192 automated tests. Visible confirmation remains a short user-machine smoke test because the Codex host still cannot launch any Electron 44.2.0 renderer process.

## Domain / commands

1. **Phase 11.5.2 summary.** Repaired development-force semantics, kept normal product policy separate, made forced states progress while autonomy is paused, added typed execution tracing and immediate stall detection, replaced unreliable Alt rare-event shortcuts, added a 26-button development panel on the existing diagnostic surface, added Domain asset/timeline/cleanup diagnostics, and expanded the suite from 185 to 192 passing tests. No product feature or Phase 12 work was added.

2. **Exact Domain failure root cause.** The old “force Domain” route was still coupled to ordinary product policy. It could stop in the development runtime before cleanup/dispatch when autonomy was paused, rare events were disabled, or Low Power blocked rare events. A second shared defect existed after a forced timed state entered: `ThukunaController.tick` updated ordinary FSM states only while autonomy was running, so a forced Domain entered during a paused session could remain on its first frame and never complete. Domain’s assets and canonical 3,400 ms state implementation were not the defect.

3. **Domain keyboard result before fix.** **FAIL LIVE (user-observed)** with `Alt+6`. The prior UI did not retain stage-by-stage trace data, so it cannot truthfully establish whether that individual attempt stopped at Windows/Electron Alt input, runtime product-policy rejection, or the paused FSM update gate.

4. **Domain panel result before fix.** **NOT AVAILABLE** — the clickable panel did not exist before Phase 11.5.2.

5. **Domain execution-path failure point.** Code audit found two exact stops: (a) `ThukunaDevCommandRuntime` precondition evaluation could reject before canonical cleanup and `RareEventController.forceStart`; (b) after state entry, the controller RAF skipped `stateMachine.update` while autonomy was paused, preventing frame/stage progression and completion. The new trace now records recognition → runtime → hard precondition → cleanup → controller request → event-force acceptance → state → animation → immediate verification.

6. **Changes made.** Updated `devCommandRegistry.ts`, `DevCommandController.ts`, `ThukunaDevCommandRuntime.ts`, `ThukunaController.ts`, `EventVisualController.ts`, `thukunaAnimations.ts`, `pet.ts`, `pet.css`, README and relevant fakes/tests; added `DevCommandPanel.ts`, seven new test cases, and the isolated `diagnostics/electron-minimal` reproduction.

7. **DEV Domain override policy.** DEV force bypasses autonomy pause, rare-events toggle, Low Power rare-event suppression, scheduler randomness, global/per-event cooldown and current temporary-state policy. It still requires a started, visible renderer, no active drag, all 20 Domain assets, canonical cleanup and the existing Domain state/event implementation. It does not move the BrowserWindow, so Wayland movement policy does not block it. Diagnostics show `DEV OVERRIDE: YES`.

8. **Normal Domain policy.** Unchanged: autonomous Domain continues to obey settings, autonomy, power policy, probability, scheduler eligibility, cooldowns, state eligibility and the existing platform policy.

9. **Final Domain keyboard shortcut.** `Ctrl+Shift+6`, matched through exact `event.code === "Digit6"` and exact modifier booleans. `Alt+6` was removed from the registry.

10. **Final Domain button behavior.** The `Domain Expansion` panel button calls `DevCommandController.handlePanelCommand("DOMAIN")`; it does not call an event or state directly. It therefore uses the same runtime, cleanup, `forceRareEvent("DOMAIN_EXPANSION", DEV_OVERRIDE)`, FSM and animation path as the keyboard command. Result: **PASS AUTOMATED; visible user-machine check required**.

11. **Measured/verified Domain duration.** Exactly **3,400 ms**. The fixed duration range remains `3,400..3,400`; sequence durations remain 900 + 700 + 800 + 400 + 600 ms; a controller-level test advances the actual RAF/FSM path to 3,399 ms (still Domain) and 3,400 ms (Idle).

12. **Domain cleanup result.** **PASS.** Controller-level verification records one activation and exactly one event-visual cleanup, clears the active event, returns to Idle while autonomy remains paused, clears the development-override lifetime flag, restores the idle animation and retains identity scale. Existing repeated-event transform tests also remain green.

13. **Domain frame progression result.** **PASS AUTOMATED.** The manifest exposes 20 unique, resolvable production paths split 8/4/3/3/2 across charge/expand/peak/collapse/recover. State progression reaches FREEZE, DIALOGUE, AURA, EXPAND, PEAK, COLLAPSE and RECOVER. The overlay reports a global `x / 20` frame, elapsed milliseconds, stage, computed event transform, activation count and cleanup count.

14. **Other broken commands discovered.** The paused-FSM defect affected any development-forced non-interaction timed/active state, notably Crawl, cursor Watch/Chase, Sleep, Laugh, Angry and rare events. Product-policy gates also made cursor/movement/local-event commands unsuitable as deterministic test commands. No second command-specific canonical animation defect was found.

15. **Command fixes made.** All behavior commands now pass an explicit development override into existing controller methods; active temporary behavior is replaced through canonical state exit/cleanup; policy-derived Low Power/settings/autonomy blocks were removed from DEV preconditions; hard capabilities and physical geometry remain; accepted requests are immediately checked against requested state; actual exceptions are shown as development errors.

16. **Commands intentionally conditional.** Crawl and Sprint require hard window-movement capability. Jump/Jump Left/Jump Right/Hop require movement capability and grounded geometry. Fall requires movement capability and elevation. Climb Up/Down and Perch require their platform capability plus near-edge geometry. Drop requires gravity movement and an active Perch. Watch requires cursor-position capability; Chase also requires window movement. Wake requires Sleeping. Chaos Run requires movement capability. Reset requires validated absolute-position/reset capability. Optional Landing requires movement capability.

17. **Hard physical preconditions.** Started lifecycle, visible renderer and no active drag apply to all behavior commands. Additional hard gates are platform movement/cursor/climb/perch/reset capability, grounded/elevated/near-edge/perched/sleeping geometry or state, Domain asset availability and safe window bounds. DEV force does not fake geometry or bypass PlatformService.

18. **Normal product-policy gates bypassed by DEV force.** Autonomy pause, mouse-awareness setting, rare-events setting, Low Power suppression, scheduler interval/probability, event cooldown and ordinary movement-memory cooldown. These are bypassed only on an explicit development command and normal autonomous behavior is unchanged.

19. **Keyboard mappings changed.** Sprint and the five other rare events moved from `Alt+1..6` to `Ctrl+Shift+1..6`. The registry, README, panel labels, diagnostics and tests use the new mappings. No shortcut collision exists.

20. **Final shortcut table.** Classification assumes the renderer is started, visible and not being dragged.

| Command | Keyboard | Panel | Classification | Additional hard condition |
|---|---|---|---|---|
| Diagnostics | `D` | — | Reliably forceable | Keyboard focus |
| Idle | `Shift+1` | Idle | Reliably forceable | — |
| Crawl | `Shift+2` | Crawl | Conditionally forceable | Window movement capability |
| Sprint | `Ctrl+Shift+1` | Sprint | Conditionally forceable | Window movement capability |
| Jump | `Ctrl+Shift+J` | Jump | Conditionally forceable | Grounded + movement capability |
| Jump Left | `Ctrl+Shift+Left` | Jump Left | Conditionally forceable | Grounded + movement capability |
| Jump Right | `Ctrl+Shift+Right` | Jump Right | Conditionally forceable | Grounded + movement capability |
| Hop | `Ctrl+Shift+H` | Hop | Conditionally forceable | Grounded + movement capability |
| Fall | `Ctrl+Shift+F` | Fall | Conditionally forceable | Elevated + movement capability |
| Climb Up | `Ctrl+Shift+Up` | Climb Up | Conditionally forceable | Near edge + climb capability |
| Climb Down | `Ctrl+Shift+Down` | Climb Down | Conditionally forceable | Near edge + climb capability |
| Perch | `Ctrl+Shift+P` | Perch | Conditionally forceable | Near edge + perch capability |
| Drop | `Ctrl+Shift+D` | Drop | Conditionally forceable | Perched + movement capability |
| Watch Cursor | `Shift+M` | Watch Cursor | Conditionally forceable | Cursor-position capability |
| Chase Cursor | `Shift+C` | Chase Cursor | Conditionally forceable | Cursor + movement capability |
| Sleep | `Shift+6` | Sleep | Reliably forceable | — |
| Wake | `Shift+7` | Wake | Conditionally forceable | Currently Sleeping |
| Laugh | `Shift+4` | Laugh | Reliably forceable | — |
| Angry | `Shift+5` | Angry | Reliably forceable | — |
| Rage | `Shift+R` | Rage | Reliably forceable | — |
| Fall Over | `Ctrl+Shift+2` | Fall Over | Reliably forceable | — |
| Creepy Freeze | `Ctrl+Shift+3` | Creepy Freeze | Reliably forceable | — |
| Zoom Stare | `Ctrl+Shift+4` | Zoom Stare | Reliably forceable | — |
| Chaos Run | `Ctrl+Shift+5` | Chaos Run | Conditionally forceable | Window movement capability |
| Domain Expansion | `Ctrl+Shift+6` | Domain Expansion | Reliably forceable | 20 Domain assets available |
| Reset Position | `Ctrl+Shift+0` | Reset Position | Conditionally forceable | Platform reset capability |
| Force Landing | `Ctrl+Shift+L` | Force Landing | Conditionally forceable | Movement capability |

21. **Dev panel implementation.** Pressing `D` reveals a compact fixed 176 px panel inside the existing 180×250 canvas. It contains 26 required buttons plus optional Landing, is generated from `DEV_PANEL_COMMAND_IDS`, does not resize the window or 180×180 stage, adds no process/timer/RAF/polling loop and is removed with the development-control cleanup.

22. **Panel/keyboard equivalence result.** **PASS.** Every panel ID is unique and present exactly once; every panel and keyboard dispatch resolves to the same registry command ID and runtime. Tests cover all panel commands.

23. **Command-stall detection result.** **PASS.** An accepted command whose requested state is not immediately active becomes `COMMAND_STALLED` with expected and observed state. This is an immediate verification on the existing event turn, not a timer or polling loop.

24. **Final rejection telemetry.** Panel/overlay show command, source, accepted/rejected, typed reason/detail, DEV override, requested/actual state and requested/actual animation. The trace records policy/lifecycle context, cleanup and dispatch stages. Domain-specific live state reports elapsed time, stage, frame, transform and activation/cleanup counts. Exceptions are retained as DEV-only `EXECUTION_ERROR` detail rather than swallowed.

25. **Focus behavior.** `showInactive()` still means keyboard shortcuts initially require clicking THUKUNA; pet pointer-down calls `focus({preventScroll:true})`. Recognized commands call `preventDefault()` and repeats are rejected; unrelated keys are not swallowed. Once diagnostics are visible, buttons are directly clickable and do not depend on keyboard focus or bubble into the sibling drag stage. No global hook or draggable CSS region was added.

## Electron host

26. **Electron dist inventory.** Electron is `44.2.0`; `path.txt` resolves to nonzero `dist/electron.exe`. The official archive contains 73 files, and the extracted dist has exactly those 73 files with matching sizes: zero missing, zero zero-byte, zero size mismatches and zero unexpected files. Key nonzero files include `electron.exe`, both Chrome PAKs, `resources.pak`, `icudtl.dat`, both snapshots, `ffmpeg.dll`, `d3dcompiler_47.dll`, `dxcompiler.dll`, `dxil.dll`, `vulkan-1.dll`, `vk_swiftshader.dll` and its ICD JSON. This release’s official archive does not contain `libEGL.dll` or `libGLESv2.dll`, so their absence is expected rather than an installation defect.

27. **Missing/corrupt runtime files.** None found in Electron dist. All archive entries are present, nonzero and size-identical. Direct Windows load probes successfully loaded every bundled DLL (`d3dcompiler_47`, DXC, DXIL, FFmpeg, Vulkan loader and SwiftShader).

28. **npm/Electron package integrity.** `npm ls electron --depth=0` resolves exactly `electron@44.2.0`; package version, dist `version` and binary `--version` agree. The cached `electron-v44.2.0-win32-x64.zip` SHA-256 is `4021363e3090d67a144ebedb90765cf193b0e61f300c519c83f0174502a481da`, an exact match to Electron’s bundled `checksums.json`. The lockfile pins npm wrapper integrity `sha512-oK1ic...`. `npm cache verify` could not unlink one external cache entry due Codex permissions, but the exact Electron archive and installed dist checks are stronger and passed.

29. **Reinstall attempted.** **NO.** There is no evidence of package corruption, and a deterministic reinstall would replace byte-identical contents while requiring external-cache writes. Electron version was not changed.

30. **Minimal Electron reproduction result.** **FAILS THE SAME WAY.** The isolated app contains only `app.whenReady()`, a standard 320×240 `BrowserWindow` and static HTML. It reaches main module, app ready and BrowserWindow construction, then GPU children exit `-1073741515`, renderer exits `launch-failed (49)`, and neither `did-finish-load` nor `ready-to-show` occurs.

31. **Minimal BrowserWindow result.** A standard opaque framed window with no preload, sprites, tray, PlatformService, settings, transparency or THUKUNA code fails. This strongly rules out THUKUNA’s BrowserWindow configuration and renderer logic.

32. **THUKUNA BrowserWindow reduction result.** **NOT PERFORMED**, as specified by the decision tree: reduction is useful only if the minimal standard BrowserWindow works. It did not.

33. **Windows event-log findings.** No recent Application-log entry named a faulting Electron module, DLL-load error or SideBySide failure. The System log contains Application Popup event 26 for `electron.exe`: deliberate fatal breakpoint `0x80000003` at Chromium’s “GPU process isn't usable” termination. This supplies no evidence for a specific missing DLL, so none is claimed.

34. **VC++/Windows runtime findings.** `VCRUNTIME140.dll`, `VCRUNTIME140_1.dll`, `MSVCP140.dll` (all `14.50.35719.0`) and `ucrtbase.dll` (`10.0.26100.9444`) exist in System32, are nonzero and have valid Microsoft signatures. VC++ 14 x64 registration reports installed version `v14.50.35719.00`; x86 is also registered in the 32-bit registry view. No Microsoft runtime absence was found and no system software was installed.

35. **GPU/ANGLE DLL findings.** All GPU-related files included by the official Electron archive are present, nonzero, hashable and directly loadable. `d3dcompiler_47.dll` and `dxil.dll` have valid Microsoft signatures; Electron-supplied FFmpeg/Vulkan/SwiftShader/DXC binaries load successfully even where Authenticode is not present. The SwiftShader ICD points to the existing `vk_swiftshader.dll`. No named missing ANGLE/Vulkan dependency was identified.

36. **Host GPU/display information.** PnP reports started Intel UHD Graphics (`32.0.101.6790`, 2025-04-28) and NVIDIA GeForce RTX 4060 Laptop GPU (`32.0.15.9282`, 2026-06-03), both physical PCI adapters. Windows is build 26200.9445. Explorer and the Codex-launched process are both interactive in session 2; no RDP client/session environment marker was exposed. CIM video-controller access was denied, so PnP and registry evidence were used.

37. **Temporary GPU backend tests.** Clean-profile minimal runs with `--disable-gpu`, `--use-gl=angle --use-angle=swiftshader`, and `--use-gl=swiftshader` each still produce GPU exit `-1073741515` plus renderer `launch-failed (49)`. Switches were diagnostic only and were not persisted.

38. **In-process GPU diagnostic.** `--in-process-gpu` removed the separate GPU-child exit message, but renderer subprocess launch still failed with exit 49 and the diagnostic app remained hung. The two exact test Electron processes were then terminated. This strengthens the evidence for a general Codex-host Electron subprocess boundary, not a THUKUNA GPU-backend choice.

39. **Final host failure classification.** **CODEX SANDBOX / DESKTOP RESTRICTION (best-supported classification).** Exact official Electron bytes, loadable bundled DLLs, present VC++ runtimes, two physical GPUs, a failing minimal standard window, clean profiles and backend-independent failure rule out corrupted install, known missing runtime and THUKUNA window configuration. The precise low-level Codex host restriction remains outside repository control.

40. **Host repair performed.** No permanent repair was safe or evidence-backed. Writable clean profiles removed unrelated os_crypt/cache warnings but not subprocess failure; backend changes did not help. No DLL was downloaded, no system runtime installed, no Electron version changed and no security flag weakened.

41. **Normal `electron .` result after investigation.** **FAIL.** It reaches main module, app ready, BrowserWindow construction and `loadFile`, then renderer launch fails with exit 49 and GPU exits `-1073741515` until Chromium terminates.

42. **`npm start` result after investigation.** Build completes, then Electron fails at the same host subprocess boundary; command exits 1.

43. **Furthest startup stage reached.** BrowserWindow created and renderer load requested. `did-finish-load`, `ready-to-show`, renderer initialization and visible-pet stages are not reached.

44. **Whether THUKUNA became visible in Codex host.** **NO.** The user’s normal Windows environment, where THUKUNA launches, remains authoritative for the short live smoke test.

45. **Production GPU policy changed.** **NO.** No acceleration-disable, backend, in-process or command-line switch was saved.

46. **Sandbox/security unchanged.** **YES.** `sandbox: true`, `contextIsolation: true` and `nodeIntegration: false` remain. No `--no-sandbox`, global hook or widened preload API was introduced.

## Quality

47. **BrowserWindow invariant.** **PASS:** 180×250, fixed/non-resizable. Existing geometry tests remain green.

48. **Stage invariant.** **PASS:** 180×180. The panel overlays the canvas without resizing the stage.

49. **Frame-scale invariant.** **PASS:** all 116 production frames across 15 families remain scale 1; Domain returns to identity after cleanup.

50. **Build result.** **PASS:** `npm run build` exits 0 with strict main/test TypeScript checks and renderer bundling.

51. **Final automated test count.** **192 passed, 0 failed** (required baseline: at least 185).

52. **Regressions discovered.** The old development-force/product-policy coupling, paused forced-state progression gap, stale README shortcut/policy text, missing panel equivalence coverage and event-visual fake counters that did not model real cleanup ownership.

53. **Regressions fixed.** Explicit scoped development override, active-override RAF progression, hard-vs-product preconditions, canonical cleanup, Ctrl+Shift rare-event namespace, generated panel surface, exact telemetry/watchdog, accurate event counters, README synchronization and seven focused regression tests.

54. **Unresolved command issues.** No known engineering or automated failure remains. Actual visible rendering/legibility and real desktop geometry for Climb/Perch must still be confirmed by the user-machine smoke test; no command is claimed PASS LIVE from the Codex host.

55. **Unresolved Electron-host issue.** Electron 44.2.0 renderer/GPU subprocesses cannot start inside the Codex execution host despite valid binaries/runtimes. There is no safe repository-level fix identified. This does not reproduce in the user’s normal THUKUNA launch environment.

56. **Exact local manual test steps.** Run `npm start`; click THUKUNA; press `D`; click **Domain Expansion** and verify all stages/frame count, completion to Idle and scale 1; press `Ctrl+Shift+6` and compare the command ID/result. Then click **Rage**, **Crawl** and **Jump**. Move THUKUNA to a screen edge before testing **Climb Up/Down** and **Perch**. Read any rejection reason directly in the panel/overlay.

57. **Soak.** **NOT RUN**, as required. Run it only after Domain and the required panel commands are visibly confirmed on the user’s normal Windows desktop.

58. **Phase 12.** **NOT STARTED.** No installer, release package, updater, productivity feature, LLM, voice or microphone work was performed.
