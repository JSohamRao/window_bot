# Phase 11.5.3A — Soak CSV Analysis + Codex-Side Runtime Monitoring

Date: 2026-09-12

Status: complete. The recorded normal-desktop soak meets the process, CPU, and memory stability criteria, and a later externally launched normal-desktop THUKUNA tree completed an additional 15-minute Codex-side monitor. **Soak verdict: SOAK PASS WITH MINOR OBSERVATIONS.** Memory classification: **NORMAL FLUCTUATION / NO LEAK EVIDENCE**. The observations are that Codex could read CPU time for only two of four external-session PIDs and the shorter monitor ended 22.03 MB above its starting private-memory total despite non-monotonic fluctuation. Neither observation overturns the complete 30-minute source soak.

## Summary statistics

CPU percentages estimate utilization of one logical core from cumulative CPU-time deltas divided by the actual interval duration. They are not raw `CPUSeconds` values.

| PID | Samples | Initial WS | Peak WS | Final WS | WS change | Initial private | Peak private | Final private | Private change | Avg CPU | Peak CPU | Stable? |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|:---:|
| 18216 | 60 | 45.08 MB | 45.17 MB | 45.14 MB | +0.06 MB | 11.50 MB | 11.50 MB | 11.30 MB | -0.20 MB | 0.002% | 0.067% | Yes |
| 18664 | 60 | 507.73 MB | 507.73 MB | 107.35 MB | -400.38 MB | 206.12 MB | 206.12 MB | 50.74 MB | -155.38 MB | 2.229% | 16.697% | Yes |
| 33224 | 60 | 122.25 MB | 255.96 MB | 153.36 MB | +31.11 MB | 99.59 MB | 225.87 MB | 128.91 MB | +29.32 MB | 1.923% | 15.727% | Yes |
| 33380 | 60 | 95.85 MB | 110.22 MB | 109.89 MB | +14.04 MB | 69.89 MB | 75.47 MB | 73.54 MB | +3.65 MB | 0.637% | 5.431% | Yes |
| **Total** | **60 rounds** | **770.91 MB** | **770.91 MB** | **415.74 MB** | **-355.17 MB** | **387.10 MB** | **387.10 MB** | **264.49 MB** | **-122.61 MB** | **4.790%** | **34.024%** | **Yes** |

| PID | WS minimum | WS median | Private minimum | Private median |
|---:|---:|---:|---:|---:|
| 18216 | 45.00 MB | 45.10 MB | 11.27 MB | 11.28 MB |
| 18664 | 107.35 MB | 107.90 MB | 50.74 MB | 50.74 MB |
| 33224 | 122.25 MB | 153.76 MB | 99.59 MB | 128.91 MB |
| 33380 | 95.85 MB | 109.81 MB | 67.89 MB | 73.50 MB |
| **Total** | **415.74 MB** | **417.11 MB** | **264.41 MB** | **264.48 MB** |

### Additional Codex monitor summary

| Metric | Result |
|---|---:|
| Sample rounds / rows | 30 / 120 |
| Measured span | 14m 30.551s |
| Interval average / range | 30.019s / 30.009–30.063s |
| PIDs | 6872, 13292, 27244, 36736 |
| Process count | 4 throughout |
| Total working set | 394.22 → 416.57 MB (+22.35 MB, +5.67%) |
| Total private memory | 249.51 → 271.54 MB (+22.03 MB, +8.83%) |
| Accessible-subset CPU | 0.325% average, 1.666% peak of one core |
| CPU coverage | 2/4 PIDs; 60/120 rows |

The additional memory series was bounded and non-monotonic: total private memory ranged from 233.84 to 271.54 MB with 16 increasing and 13 decreasing transitions. Ending at the observed peak is a minor follow-up observation, not proof of a leak. The earlier complete 30-minute source soak ended at a stable 264.49 MB private-memory plateau.

## Completion report

### CSV

1. **CSV found.** **YES.** The source was inspected before analysis and was not regenerated or overwritten.

2. **Exact path.** `C:\Users\soham\Documents\Codex\2026-09-05\ca\outputs\thukuna\phase115-final-soak.csv`.

3. **File size.** **15,422 bytes**. It contains the exact expected header plus 240 non-empty measurement rows.

4. **First timestamp.** `2026-09-12T16:26:24.000+05:30`.

5. **Final timestamp.** `2026-09-12T16:55:55.019+05:30`.

6. **Measured duration.** **1,771.019 seconds = 29 minutes 31.019 seconds** between the earliest first-round row and latest final-round row. This is correct for 60 samples at 30-second cadence because the logger sleeps between the first 59 sample rounds, not after the final sample.

7. **Row count.** **240 valid measurement rows**, arranged as 60 sample rounds × 4 Electron PIDs. Each PID has 60 measurements.

8. **Expected sampling interval.** The script specifies **30 seconds**. Actual round intervals averaged **30.017 s**, with median **30.016 s**, minimum **30.003 s**, and maximum **30.044 s**.

9. **Missing/gap count.** **0 missing samples and 0 long gaps.** All 60 expected rounds are present; no gap exceeded 45.024 seconds (1.5× the observed median interval). There are no missing timestamps or empty rounds.

10. **Malformed row count.** **0.** The header exactly matches `Time,PID,Process,CPUSeconds,WorkingSetMB,PrivateMemoryMB`. All numeric fields parsed as finite values. Exact duplicate rows, duplicate timestamp/PID keys, and within-round duplicate PIDs are also zero. No PowerShell collection-error text appears in the CSV.

### Processes

11. **Unique Electron PIDs.** **18216, 18664, 33224, and 33380**.

12. **Process-count range.** **4–4**. Every one of the 60 sample rounds contains the same four PIDs.

13. **PID births.** **None after the first sample.** No new Electron PID appeared during the soak.

14. **PID deaths.** **None before the last sample.** Every initially observed PID remained present through the final sample.

15. **Renderer restart evidence.** **None.** The CSV does not label Electron subprocess roles, so it cannot identify which PID was the renderer by role; however, the unchanging PID set, uninterrupted CPU counters, and constant process count provide no evidence of a renderer crash or replacement.

16. **Duplicate-process evidence.** **None.** Four stable Electron processes are consistent with a normal Electron process tree. The count never increased, and no new PID appeared. The CSV does not include command lines, so it cannot map each subprocess role, but it provides no evidence of a second pet instance or accumulating duplicate processes.

### CPU

17. **Average CPU estimate per PID.** PID 18216: **0.002%**; PID 18664: **2.229%**; PID 33224: **1.923%**; PID 33380: **0.637%** of one logical core. Combined average: **4.790% of one core**, derived from 84.84 cumulative CPU seconds consumed over the sample span.

18. **Peak CPU interval per PID.** PID 18216: **0.067%** (0.02 CPU s / 30.019 s); PID 18664: **16.697%** (5.01 / 30.005 s); PID 33224: **15.727%** (4.72 / 30.012 s); PID 33380: **5.431%** (1.63 / 30.011 s). These bounded peaks are compatible with startup/animation activity rather than a runaway loop.

19. **Total CPU trend.** Combined cumulative CPU rose from **4.06 s to 88.90 s**. The peak combined interval was **34.024% of one core**, consuming 10.21 CPU seconds from `16:27:24.055` to `16:27:54.063`. Average activity across the first ten intervals was **24.515%**, compared with **0.133%** across the final ten; the median interval was **0.167%**. Activity declined sharply after initial work and stayed near idle rather than growing over time.

20. **Runaway CPU evidence.** **None.** No CPU counter decreased or reset, no process showed increasing late-run interval demand, and the last ten intervals were nearly idle. Ordinary early bursts were not treated as regressions.

### Memory

21. **Initial total working set.** **770.91 MB**.

22. **Peak total working set.** **770.91 MB**, at the initial round. Per-process peaks are shown in the summary table.

23. **Final total working set.** **415.74 MB**. Total median was **417.11 MB**, and the minimum was **415.74 MB**.

24. **Total working-set change.** **-355.17 MB (-46.07%)**. Across 59 transitions, total working set increased 12 times, decreased 29 times, and was unchanged 18 times. Over the final 20 samples it stayed within **415.74–416.18 MB**, ending **0.44 MB lower** than that tail's start.

25. **Initial total private memory.** **387.10 MB**.

26. **Peak total private memory.** **387.10 MB**, at the initial round. Individual PID 33224 briefly peaked at 225.87 MB, but another process trimmed enough memory that the total never exceeded the starting value.

27. **Final total private memory.** **264.49 MB**. Total median was **264.48 MB**, and the minimum was **264.41 MB**.

28. **Total private-memory change.** **-122.61 MB (-31.67%)**. Across 59 transitions, total private memory increased 13 times, decreased 19 times, and was unchanged 27 times.

29. **Monotonic-growth result.** **No sustained monotonic growth.** Total working set and private memory both fell substantially from the initial cache/heap state. Over the final 20 samples, private memory remained within **264.41–264.61 MB**, ended only **0.04 MB** above the tail's start, and had a negligible fitted slope of **+0.016 MB/min**. The final-tail working-set slope was **-0.013 MB/min**. This is a stable plateau with small ordinary fluctuations.

30. **Leak assessment.** **NORMAL FLUCTUATION / NO LEAK EVIDENCE.** Final total working set and private memory are well below their initial values; the final third is flat; process topology is constant; and individual increases are offset by trimming/GC elsewhere. Chromium caching, V8 heap activity, sprite/image caching, eager asset loading, garbage collection, and working-set trimming can explain the early redistribution. A higher final value for two individual PIDs alone is not leak evidence when total private memory declines and stabilizes.

### Optional Codex monitor

31. **Valid normal-desktop THUKUNA instance visible.** **YES.** A later check at `2026-09-12T17:18:39.598+05:30` found four Electron processes in Windows session 3. PIDs 6872 and 13292 exposed the exact THUKUNA repository Electron binary and shared the same external launch time; PIDs 27244 and 36736 were visible in the same session but the restricted Codex token could not read their path/CPU/start-time properties. The raw CSV's `PathMatch=NO` on those `PARTIAL` rows came from comparing an unreadable/null path, not from observing a different executable; the reusable logger now records this case as `UNKNOWN`. This is distinct from the known failed Codex-host launches in session 2, and no new THUKUNA instance was launched by Codex.

32. **Additional Codex monitoring attempted.** **YES.** Codex passively monitored the existing session-3 Electron tree at 30-second cadence. It did not interact with, relaunch, hide, show, or terminate THUKUNA.

33. **Reason.** The user started a normal-desktop THUKUNA instance after the first no-process check. Exact binary-path matches in external Windows session 3 made the existing tree valid to monitor. A first foreground logger attempt developed a real 31-minute host-suspension gap after round 10; that incomplete file was rejected and permanently discarded. A clean hidden background helper then captured all 30 rounds continuously.

34. **Additional soak duration.** **Nominal 15 minutes; measured first-to-last sample span 870.551 seconds = 14 minutes 30.551 seconds.** This is the expected span for 30 samples separated by 29 sleep intervals.

35. **Output CSV path.** `C:\Users\soham\Documents\Codex\2026-09-05\ca\outputs\thukuna\phase115-codex-monitor-soak.csv`. It contains 120 valid rows, 30 rounds, zero malformed/duplicate rows, and zero long gaps. It did not overwrite `phase115-final-soak.csv`.

36. **Additional process-stability result.** **PASS.** The process count remained exactly four, with PIDs 6872, 13292, 27244, and 36736 in every round. There were no process births, deaths, replacements, or count increases.

37. **Additional memory result.** Total working set changed from **394.22 to 416.57 MB** (+22.35 MB, +5.67%), ranging **379.76–416.57 MB**. Total private memory changed from **249.51 to 271.54 MB** (+22.03 MB, +8.83%), ranging **233.84–271.54 MB**. Both series repeatedly rose and fell (private: 16 rises, 13 falls), so growth was not monotonic. The final value being the short run's peak is a minor observation; it is not leak evidence when considered with the longer source soak's lower stable plateau.

38. **Additional CPU result.** **Bounded for the readable subset; whole-tree CPU unavailable.** Codex could read cumulative CPU for exact-path PIDs 6872 and 13292 only. Together they consumed 2.8282 CPU seconds over 870.551 seconds, averaging **0.325% of one core** with a **1.666%** peak interval. PID 6872 averaged 0.011%; PID 13292 averaged 0.314%. CPU fields for PIDs 27244 and 36736 are intentionally blank because the restricted token denied those properties; no values were fabricated.

### Quality

39. **Build result.** **PASS.** `npm run build` exited 0.

40. **Automated tests.** **PASS.** `npm test` exited 0 with no failed, cancelled, skipped, or todo tests. The intentionally simulated cursor-provider failure log remains part of a passing negative-path test.

41. **Final test count.** **192 passed, 0 failed**.

### Final

42. **Soak verdict.** **SOAK PASS WITH MINOR OBSERVATIONS.** This verdict applies only to recorded process stability, memory, CPU, cadence, and logger quality. The original 30-minute dataset is a full performance pass; the minor observations come from partial CPU visibility and the shorter monitor's higher endpoint.

43. **Evidence supporting verdict.** The original soak has 60 complete rounds with stable PIDs, bounded CPU, falling totals, and a tight final memory plateau. The additional monitor independently has 30 complete rounds with the same four PIDs, zero births/deaths/replacements, no malformed or duplicate rows, intervals within 30.009–30.063 seconds, fully readable memory for all PIDs, and very low CPU for the readable subset. The additional memory endpoint rose modestly but was non-monotonic and remains compatible with normal caching/interaction fluctuation rather than a demonstrated leak.

44. **Remaining user live checks.** The CSV cannot prove Domain's visual stages/cleanup, Climb contact with the screen edge, Perch appearance, sprite rendering/anchors/scale, Hide/Show visual behavior, tray menu behavior, or visible geometry. Those remain separate normal-desktop USER LIVE VISUAL checks unless the user has already confirmed them elsewhere.

45. **Application code changed.** **NO.** No animation, Domain, FSM, locomotion, sprite, IPC, tray, PlatformService, BrowserWindow, Electron flag, shortcut, panel, or other application source was edited. Diagnostic-only analyzers, a passive monitor script, JSON statistics artifacts, the separate monitor CSV, and this report were added. The original `phase115-final-soak.csv` and its logger were not modified.

46. **Production Electron security changed.** **NO.** No GPU, GPU-sandbox, no-sandbox, in-process-GPU, software-rendering, BrowserWindow, or sandbox setting was changed.

47. **Phase 12 started.** **NO.** This task remained Phase 11.5.3A analysis and monitoring only.

48. **Exact next action.** On the normal Windows desktop, complete and record the remaining live visual checklist: Domain stages and return to idle at identity scale, Climb edge contact, Perch/drop appearance, representative sprite rendering/anchors, Hide/Show, tray controls, and window geometry. Use those observations together with this soak pass to decide Phase 11.5 closure. Do not infer visual success from the CSV and do not start Phase 12 from this report alone.

## Diagnostic artifacts

- Machine-readable statistics: `art-production/reports/phase-11.5.3a-soak-statistics.json`
- Additional monitor CSV: `phase115-codex-monitor-soak.csv`
- Additional monitor statistics: `art-production/reports/phase-11.5.3a-codex-monitor-statistics.json`
- Reusable analyzer: `art-production/scripts/analyze_phase115_soak.py`
- Additional monitor analyzer: `art-production/scripts/analyze_codex_monitor_soak.py`
- Passive monitor logger: `art-production/scripts/run_codex_monitor_soak.ps1`
- Optional plots were not produced because the bundled Python runtime has no Matplotlib. No dependency was installed solely for diagnostics.
