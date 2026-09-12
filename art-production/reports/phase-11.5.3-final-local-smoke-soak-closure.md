# Phase 11.5.3 — Final Local Smoke Test + Soak + Closure

Date: 2026-09-11

## Closure table

“Blocked live” means the check was not executed and is not a failure claim. The only targetable THUKUNA window in this session was the already-known Codex-host instance: its renderer document was detectable, but the surface stayed transparent with no visible sprite, a physical stage click passed through to the application behind it, and `D` did not expose diagnostics. Per the phase environment rule, no visible result is fabricated.

| Check | Result | Evidence |
|---|---|---|
| Build | PASS | `npm run build` exited 0 on 2026-09-11 |
| Automated suite | PASS | 192 passed, 0 failed |
| Domain panel | BLOCKED LIVE | No usable visible renderer/panel in Codex host; canonical path passes automated tests |
| Domain keyboard | BLOCKED LIVE | Same environment block; `Ctrl+Shift+6` registry/equivalence tests pass |
| Crawl | BLOCKED LIVE | Canonical movement and dev dispatch tests pass |
| Sprint | BLOCKED LIVE | Canonical rare-event movement and dispatch tests pass |
| Jump | BLOCKED LIVE | Physics and dispatch tests pass |
| Hop | BLOCKED LIVE | Physics and dispatch tests pass |
| Fall | BLOCKED LIVE | Gravity/landing tests pass; elevated desktop geometry not exercised live |
| Left Climb Up | BLOCKED LIVE | Locomotion tests pass; left-edge contact not observed |
| Left Climb Down | BLOCKED LIVE | Locomotion tests pass; left-edge contact not observed |
| Right Climb Up | BLOCKED LIVE | Locomotion/mirroring logic tested; right-edge contact not observed |
| Right Climb Down | BLOCKED LIVE | Locomotion/mirroring logic tested; right-edge contact not observed |
| Perch | BLOCKED LIVE | State/geometry tests pass; desktop edge not exercised |
| Drop | BLOCKED LIVE | Perch-exit/Fall path tests pass |
| Watch | BLOCKED LIVE | Cursor-awareness tests pass; visible eye/body response not observed |
| Chase | BLOCKED LIVE | Planner/movement tests pass; physical cursor pursuit not observed |
| Sleep/Wake | BLOCKED LIVE | Deterministic state/animation dispatch tests pass |
| Laugh | BLOCKED LIVE | State/animation dispatch tests pass |
| Angry | BLOCKED LIVE | Enter/loop/exit tests pass |
| Rage | BLOCKED LIVE | Repeated state/cleanup tests pass |
| Fall Over | BLOCKED LIVE | Canonical event/cleanup tests pass |
| Creepy Freeze | BLOCKED LIVE | Canonical event/cleanup tests pass |
| Zoom Stare | BLOCKED LIVE | Canonical event/cleanup tests pass |
| Chaos Run | BLOCKED LIVE | Canonical event/movement tests pass |
| Reset dev command | BLOCKED LIVE | Narrow PlatformService dispatch test passes |
| Reset tray | BLOCKED LIVE | Tray model test passes; native menu not exercised |
| Hide/Show | BLOCKED LIVE | Visibility lifecycle test passes; native tray not exercised |
| 25 drags | BLOCKED LIVE | Automated 25-cycle ownership test passes; physical sequence not run |
| Geometry | PASS AUTOMATED / BLOCKED LIVE | Constants and tests remain 180×250 window, 180×180 stage |
| Scale | PASS AUTOMATED / BLOCKED LIVE | All 116 frames remain scale 1; post-soak display not observed |
| Process stability | BLOCKED | No valid running pet workload to measure |
| Hidden mode | BLOCKED LIVE | Automated suspension test passes; tray hide not available |
| 30-minute soak | NOT RUN | Running against the broken Codex-host surface would not test THUKUNA |

## Completion report

1. **Final verdict.** **C. PARTIALLY COMPLETE.** Engineering prechecks pass, but the mandatory visible Windows smoke test and 30-minute mixed soak were not executable in the known-broken Codex host. Therefore Phase 11.5 cannot honestly receive full closure yet.

2. **Windows runtime used.** Codex Windows session 2, interactive desktop, system DPI 96 / 100% scaling, Electron 44.2.0. This was not the user’s authoritative normal-desktop runtime: the targetable Electron surface exhibited the known host restriction.

3. **Build result.** **PASS** — `npm run build` exited 0.

4. **Automated test result.** **PASS** — zero failures.

5. **Final test count.** **192/192**.

### Commands

6. **Domain panel.** **BLOCKED LIVE.** No panel was visibly available in the Codex-host surface. Automated panel dispatch, command ID and canonical runtime coverage pass.

7. **Domain keyboard.** **BLOCKED LIVE.** `Ctrl+Shift+6` is verified in the registry and keyboard/panel equivalence test, but visible behavior could not be observed.

8. **Domain duration.** **PASS AUTOMATED:** exactly 3,400 ms at the controller/FSM boundary; not timed visually in this phase.

9. **Domain repeat result.** **NOT RUN LIVE.** Existing repeated-event transform ownership and single-cleanup tests pass, but the required five visible mixed panel/keyboard runs remain.

10. **Crawl.** **BLOCKED LIVE; PASS AUTOMATED.** Window motion and sprite staging were not visibly observed.

11. **Sprint.** **BLOCKED LIVE; PASS AUTOMATED.** Relative visible speed was not observed.

12. **Jump.** **BLOCKED LIVE; PASS AUTOMATED.** Full physics and direction tests pass; visible no-bounce/no-snap check remains.

13. **Hop.** **BLOCKED LIVE; PASS AUTOMATED.** Shorter trajectory logic passes; visible comparison remains.

14. **Full Fall.** **BLOCKED LIVE; PASS AUTOMATED.** Elevated release and one-floor-stop were not physically exercised.

15. **Left Climb Up.** **BLOCKED LIVE; PASS AUTOMATED.** Left-edge contact remains to observe.

16. **Left Climb Down.** **BLOCKED LIVE; PASS AUTOMATED.** Downward left-edge contact remains to observe.

17. **Right Climb Up.** **BLOCKED LIVE; PASS AUTOMATED.** Right-side mirror/contact remains to observe.

18. **Right Climb Down.** **BLOCKED LIVE; PASS AUTOMATED.** Right-side downward attachment remains to observe.

19. **Perch.** **BLOCKED LIVE; PASS AUTOMATED.** Edge geometry is required for the live check.

20. **Drop.** **BLOCKED LIVE; PASS AUTOMATED.** Perch-exit → Fall → Land behavior remains to observe.

21. **Watch.** **BLOCKED LIVE; PASS AUTOMATED.** Cursor sampling/state logic passes; visible tracking remains.

22. **Chase.** **BLOCKED LIVE; PASS AUTOMATED.** Planner decisions pass; physical non-flying pursuit remains.

23. **Sleep/Wake.** **BLOCKED LIVE; PASS AUTOMATED.** Both deterministic dev paths pass tests.

24. **Laugh.** **BLOCKED LIVE; PASS AUTOMATED.** Visible response remains.

25. **Angry.** **BLOCKED LIVE; PASS AUTOMATED.** Enter/loop/exit staging passes.

26. **Rage.** **BLOCKED LIVE; PASS AUTOMATED.** Repeated cleanup is tested; ten visible runs remain.

27. **Fall Over.** **BLOCKED LIVE; PASS AUTOMATED.** Ten visible recovery runs remain.

28. **Creepy Freeze.** **BLOCKED LIVE; PASS AUTOMATED.** Canonical event path passes.

29. **Zoom Stare.** **BLOCKED LIVE; PASS AUTOMATED.** Canonical event and transform cleanup pass.

30. **Chaos Run.** **BLOCKED LIVE; PASS AUTOMATED.** Canonical bounded movement passes.

31. **Reset dev command.** **BLOCKED LIVE; PASS AUTOMATED.** Narrow validated reset dispatch passes.

32. **Reset tray.** **BLOCKED LIVE; PASS AUTOMATED.** Tray model contains the action; corner/edge repositioning remains.

33. **Hide/Show.** **BLOCKED LIVE; PASS AUTOMATED.** Visibility lifecycle suspension/resume passes; native tray cycle remains.

### Regressions

34. **25-drag result.** **NOT RUN LIVE.** Automated 25-cycle drag ownership/reset test passes.

35. **BrowserWindow size.** **180×250 PASS AUTOMATED**; unavailable from live diagnostics in this host.

36. **Stage size.** **180×180 PASS AUTOMATED**; unavailable from live diagnostics in this host.

37. **Final scale.** **1 for all 116 production frames PASS AUTOMATED**; no post-soak live reading exists.

38. **Transform drift result.** **PASS AUTOMATED / NOT RUN LIVE.** Repeated locomotion and rare-event cleanup tests show identity ownership; physical drag/event soak remains.

### Performance / soak

39. **Process count.** Two project Electron processes were present in the blocked host snapshot. This is recorded only as environment evidence, not a valid pet baseline.

40. **Initial working set.** Blocked-host snapshot: PID 6788 = 104.64 MB and PID 31544 = 45.46 MB (150.10 MB total); private memory 70.64 MB and 11.68 MB. These values are not used for leak assessment.

41. **Hidden working set.** **NOT MEASURED** — no functional tray/renderer to perform a valid hide interval.

42. **Post-soak working set.** **NOT MEASURED**.

43. **Hidden CPU observation.** **NOT MEASURED**.

44. **Soak duration.** **0 minutes executed in this host.** The required local duration remains 30 minutes.

45. **Soak CSV path.** `phase115-final-soak.csv` is prepared with its header only. `phase115-final-soak.ps1` will overwrite and populate it every 30 seconds for 30 minutes on the normal desktop.

46. **Crash count.** **NOT MEASURED FOR SOAK**.

47. **Renderer restart count.** **NOT MEASURED FOR SOAK**.

48. **Duplicate process/window count.** **NOT MEASURED FOR SOAK**. The blocked-host snapshot had two same-binary Electron processes, which is not treated as a duplicate-pet failure.

49. **Memory-growth assessment.** **NO VERDICT** — no valid workload or time series. Normal Chromium fluctuation is not labelled a leak.

50. **Tray status after soak.** **NOT TESTED**.

### Final

51. **Bugs discovered.** No reproducible THUKUNA code defect was discovered. The visible attempt encountered only the already-classified Codex-host runtime limitation.

52. **Fixes made.** None. Working product code was not changed or refactored.

53. **Tests added.** None; the unchanged 192-test suite passes.

54. **Unresolved issues.** Mandatory normal-desktop smoke checks, tray/edge/drag checks, repeat tests and the 30-minute mixed soak remain unobserved.

55. **Final Phase 10 closure status.** **CLOSED / NO AUTOMATED REGRESSION.** Its 180×250, 180×180 and two-dimensional movement invariants remain green; this phase did not reopen Phase 10 engineering.

56. **Final Phase 11.5 closure status.** **NOT FULLY CLOSED — LIVE CLOSURE PENDING.** Complete the procedure below and record the table before choosing verdict A.

57. **Exact run command.** In the project directory run `npm start`. In a second PowerShell window run `powershell -ExecutionPolicy Bypass -File .\phase115-final-soak.ps1`. Click THUKUNA, press `D`, execute the closure-table sequence while the logger runs, include at least 60 seconds hidden and several minutes untouched, then repeat Domain/Rage/Crawl/Reset/Hide-Show after the logger completes.

58. **Codex-host GPU workaround added.** **NO.** No `--disable-gpu`, `--no-sandbox`, `--in-process-gpu`, software-rendering switch or security weakening was added.

59. **Phase 12 started.** **NO.** No packaging, installer, updater, Linux release or new product feature work was performed.

## Authoritative local procedure

1. Open PowerShell in `C:\Users\soham\Documents\Codex\2026-09-05\ca\outputs\thukuna` and run `npm start`.
2. In a second PowerShell in the same directory run `powershell -ExecutionPolicy Bypass -File .\phase115-final-soak.ps1`.
3. Click THUKUNA, press `D`, and confirm 180×250 window, 180×180 stage, scale 1.000, Win32 movement/cursor capabilities.
4. Run Domain from the panel, then `Ctrl+Shift+6`; observe the full 3.4-second sequence and return to Idle.
5. Run the remaining panel and keyboard commands from the closure table. Establish required elevation/edge/perch geometry before Fall/Climb/Perch/Drop.
6. Perform 25 drags, corner/edge resets, a 30-second Hide/Show, five mixed Domain runs, ten Rage runs and ten Fall Over runs.
7. During the logger’s 30 minutes mix all command families and modes, include at least 60 seconds hidden and several untouched idle minutes.
8. After completion recheck Domain, Rage, Crawl, tray Reset and Hide/Show; confirm geometry/scale and inspect the CSV for process duplication or sustained monotonic growth.

Do not use the removed `Alt+1..6` shortcuts. Do not begin Phase 12 until this live table can truthfully be marked PASS.
