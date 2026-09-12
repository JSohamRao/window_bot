# THUKUNA Phase 12 — Windows Release & Packaging

## AUDIT

1. **Phase 12 summary:** Windows x64 release engineering is complete; the clean production package and NSIS installer build and pass structural/content checks. Authoritative installed GUI, uninstall, startup, and packaged-soak checks remain for the user's normal desktop because the Codex Electron renderer is still blocked.
2. **Files/configs inspected:** `package.json`, lockfile, build scripts, Electron main/preload/renderer, platform adapters, settings paths, tray/icon paths, assets, diagnostics, tests, reports, runtime profiles, soak evidence, `dist/`, and `release/`.
3. **Packaging problems found before changes:** broad `dist/**/*` inclusion, whole source `assets/` copied, possible stale tests/maps, hardcoded development controls, no production ICO, incomplete Windows metadata/NSIS policy, no single-instance lock, non-explicit Windows startup executable, and console-only failure diagnostics.
4. **Files modified:** `package.json`, `README.md`, `RELEASE_NOTES.md`, `tsconfig.tests.json`, build/copy/clean/audit/soak scripts, main-process startup/platform/diagnostic files, renderer development-control policy, Phase 12 tests, and generated canonical icon files.
5. **electron-builder configuration location:** one authoritative `build` object in `package.json`.
6. **Version:** `0.1.0`.
7. **appId:** `com.thukuna.desktoppet`.
8. **productName:** `THUKUNA`.
9. **Executable name:** `THUKUNA.exe`.

## CODEX HOST RECHECK

10. **Current Electron version:** `v44.2.0`; `npm list electron` resolves `electron@44.2.0`.
11. **Current Windows version/build:** registry product label `Windows 10 Home`, DisplayVersion `25H2`, build `26200.9445`; this is a Windows 11-era build despite the legacy product label.
12. **Current Codex identity/session:** recheck ran as `soham-hp16\codexsandboxoffline`, medium integrity, console session 3. Packaging permission temporarily changed the sandbox token name to `codexsandboxonline`; no cause inference is made from that token transition.
13. **Stale project Electron processes found:** NO before the fresh recheck. Two later project-owned failed-launch remnants were positively path-matched and stopped before installer tests; unrelated Electron processes were not touched.
14. **Normal `npm start` result:** FAIL at the host renderer/process boundary after a successful build.
15. **Main module reached:** YES.
16. **App ready reached:** YES.
17. **BrowserWindow constructed:** YES.
18. **Renderer launched:** NO; renderer child launch failed with code 49.
19. **did-finish-load reached:** NO.
20. **ready-to-show reached:** NO.
21. **THUKUNA visible:** NO.
22. **THUKUNA interactive:** NO.
23. **Minimal Electron result:** FAIL at the same boundary; MAIN_MODULE, APP_READY, and BROWSER_WINDOW_CONSTRUCTED were reached, but DID_FINISH_LOAD, READY_TO_SHOW, and visible window were not. GPU children exited `0xC0000135` before the fatal unusable-GPU termination.
24. **Optional `--disable-gpu-sandbox` result:** NOT RERUN; the base failure reproduced unchanged and prior evidence already showed that this diagnostic flag did not restore the renderer. It is not persisted anywhere.
25. **Final Codex-host classification:** **CODEX-HOST ELECTRON GUI — STILL BLOCKED**.
26. **Previous restriction still reproduces:** YES.
27. **Codex-host live Phase 12 testing usable:** NO.
28. **If recovered, environment differences observed:** not applicable; the host did not recover.
29. **Recovery cause proven:** NO.

## BUILD

30. **`npm run build` result:** PASS after packaging changes.
31. **`npm test` result:** PASS, zero failures.
32. **Final automated test count:** 199 passed (baseline 192 plus 7 focused Phase 12 release tests).
33. **`npm run package:win` result:** PASS; produced x64 unpacked output and assisted per-user NSIS installer. Codex used a temporary repository-local electron-builder cache solely because its normal AppData cache was sandbox-denied; that cache was removed afterward.
34. **electron-builder version:** `26.15.3`.
35. **Electron version:** `44.2.0`.

## ARTIFACTS

36. **Installer filename/path:** `release/THUKUNA-Setup-0.1.0.exe`.
37. **Installer size:** 322,673,487 bytes (about 307.73 MiB).
38. **Installer SHA-256:** `8A60EB08F2D18B661F1CA36E579F209E593A3E34E051379F234FCD3629B2EDF3`.
39. **Unpacked build path:** `release/win-unpacked/` (73 files; 596,957,923 bytes total).
40. **Installed executable path:** configured normal per-user path is `%LOCALAPPDATA%\Programs\THUKUNA\THUKUNA.exe`; controlled validation used an isolated temp install and removed it afterward because the Codex token could not complete a normal-profile installation.
41. **Application icon:** `assets/icons/thukuna.ico`, a multi-size transparent Windows ICO generated from approved `idle_01.png`; packaged into `THUKUNA.exe` and used by installer/uninstaller.
42. **Tray icon:** `assets/icons/tray.png`, 64×64 transparent canonical THUKUNA art.
43. **Signing status:** unsigned; `Get-AuthenticodeSignature` returned `NotSigned`. No fake certificate was created.
44. **SmartScreen result:** not observable in this non-interactive host; an unsigned/unknown-publisher warning is documented as possible, not confused with malware detection.

## CONTENTS

45. **ASAR policy:** enabled; no broad `asarUnpack` rule. Final ASAR has 169 entries.
46. **Production sprite count in package:** 116 across all 15 approved families; Domain contributes exactly 20 frames.
47. **Sprite integrity result:** PASS; SHA-256/byte equality matched source to packaged ASAR for all 116 sprites.
48. **Tests included:** NO.
49. **art-production included:** NO.
50. **Diagnostics included:** full development diagnostics/files NO; bounded production failure logging YES by design.
51. **Phase reports included:** NO.
52. **Soak CSVs included:** NO.
53. **Temporary profiles included:** NO.
54. **Source dependency result:** PASS structurally. The installed payload contains main/preload/renderer/resources and launches directly without npm, Node CLI, repo `dist/`, or repo assets. The isolated installed executable reached Electron main startup before the same host GPU failure.

## RUNTIME

55. **Installed launch result:** source-independent main launch reached, but installed renderer launch FAILS in Codex for the same proven host restriction; normal-desktop installed GUI validation remains pending.
56. **BrowserWindow geometry:** preserved at 180×250 in packaged code and regression tests; packaged live visual confirmation pending.
57. **Stage geometry:** preserved at 180×180 in packaged HTML/CSS/tests; packaged live visual confirmation pending.
58. **Scale invariant:** all 116 production frame scales remain exactly 1; tests pass.
59. **Crawl:** regression tests and closed Phase 11.5 evidence PASS; packaged live smoke pending.
60. **Jump/Hop/Fall:** regression tests and closed Phase 11.5 evidence PASS; packaged live smoke pending.
61. **Climb/Perch/Drop:** regression tests and closed Phase 11.5 evidence PASS; packaged live smoke pending.
62. **Cursor behavior:** regression tests and closed Phase 11.5 evidence PASS; packaged live smoke pending.
63. **Rage:** regression tests and closed Phase 11.5 evidence PASS; packaged live smoke pending.
64. **Rare events:** regression tests and closed Phase 11.5 evidence PASS; packaged live smoke pending.
65. **Domain:** canonical 20-frame, exactly 3400 ms behavior remains regression-tested; packaged live smoke pending.
66. **Tray:** packaged icon/path and menu model PASS; installed live tray behavior pending because no renderer-capable Codex desktop.
67. **Hide/Show:** implementation/regression tests and Phase 11.5 normal-desktop evidence PASS; packaged live pending.
68. **Reset Position:** implementation/regression tests and Phase 11.5 normal-desktop evidence PASS; packaged live pending.
69. **Settings:** remain in Electron `userData`, never installed resources/source; store tests PASS. Installed persistence requires normal-desktop validation.
70. **Normal/Chaos/Low Power:** behavior policy tests PASS and production package contains unchanged logic; packaged live smoke pending.

## WINDOWS

71. **Single-instance result:** implemented with `app.requestSingleInstanceLock()` and focused unit tests PASS; secondary launch calls the existing show path. Live installed validation pending.
72. **Second launch while visible:** pending normal-desktop validation; Codex primary exits before this can be tested.
73. **Second launch while hidden:** pending normal-desktop validation.
74. **Startup enabled result:** packaged Windows login-item helper test PASS; live registry toggle pending.
75. **Startup executable path:** packaged policy resolves Electron `app.getPath("exe")`, therefore the installed `THUKUNA.exe`; it does not use electron.exe, npm, Node, source, or `dist/main/main.js`.
76. **Startup disabled result:** code sets `openAtLogin: false`; unit coverage PASS, live registry removal pending.
77. **Multi-monitor result:** no physical second display test claimed; existing mocked work-area/bounds coverage passes.
78. **DPI results:** packaged live 100%, 125%, and 150% checks unavailable; no result fabricated.
79. **Windows 11 validation:** build, tests, x64 packaging, ASAR audit, controlled install, and installed-main startup exercised on build 26200.9445; GUI portion blocked by Codex host.
80. **Windows 10 validation status:** compatibility target only; no physical Windows 10 validation claimed.

## INSTALLER

81. **Clean install result:** controlled temp-directory install PASS with exit code 0, `THUKUNA.exe`, uninstaller, and matching installed ASAR. Normal `%LOCALAPPDATA%` file creation was sandbox-blocked despite an installer exit code 0, so a true normal-profile install remains pending.
82. **Uninstall result:** PARTIAL in Codex. The silent uninstaller returned 0 and removed the Start-menu shortcut/registration but left the controlled custom-directory payload; the test payload was then safely deleted. Normal per-user interactive uninstall must be checked outside the sandbox.
83. **User-data behavior after uninstall:** configured `deleteAppDataOnUninstall: false`; settings are intentionally retained. Live confirmation pending.
84. **Reinstall result:** payload installation was repeated successfully with identical ASAR; a strict uninstall-then-clean-reinstall could not be proven because of item 82.
85. **Install-over-existing result:** PASS in the controlled location; same-version installer returned 0 and preserved a valid executable/ASAR.
86. **Shortcuts result:** Start-menu shortcut creation observed and uninstaller removal observed. Desktop shortcut was configured but not observable under the restricted desktop token; normal-desktop check pending.

## PERFORMANCE

87. **Packaged soak duration:** not run; no valid renderer stayed alive in Codex. A 15-minute/30-second sampler is provided at `scripts/phase12-packaged-soak.ps1` for the normal desktop.
88. **Packaged process-count range:** unavailable pending normal-desktop soak.
89. **Packaged initial working set:** unavailable pending normal-desktop soak.
90. **Packaged peak working set:** unavailable pending normal-desktop soak.
91. **Packaged final working set:** unavailable pending normal-desktop soak.
92. **Packaged initial private memory:** unavailable pending normal-desktop soak.
93. **Packaged peak private memory:** unavailable pending normal-desktop soak.
94. **Packaged final private memory:** unavailable pending normal-desktop soak.
95. **CPU assessment:** unavailable for a valid packaged renderer; Phase 11.5 development soak remains passed evidence only.
96. **Memory assessment:** unavailable for a valid packaged renderer; no packaged claim made.
97. **Renderer restart count:** unavailable because the renderer never launched; host process terminated after repeated GPU-child failures.
98. **Crash count:** one installed-start attempt terminated at the known Codex host GPU boundary; this is classified as environment restriction, not a production regression.
99. **Duplicate-instance count:** unavailable live; unit-tested single-instance policy passes.
100. **Hidden-mode result:** unavailable pending normal-desktop packaged soak.

## SECURITY

101. **Sandbox status:** `true` in final packaged main bundle.
102. **contextIsolation status:** `true` in final packaged main bundle.
103. **nodeIntegration status:** `false` in final packaged main bundle.
104. **Production GPU workaround present:** NO.
105. **Updater present:** NO; no updater dependency, feed, server, or background update logic was added. The builder-generated blockmap is inert packaging metadata.
106. **Telemetry present:** NO. Diagnostics are local, bounded to 256 KiB plus one rotated file, and cover main exceptions/rejections, renderer load/process failure, and child-process failure. Local Defender scan status: unavailable because `Start-MpScan` and threat queries returned Access denied; no third-party upload was performed.

## DOCUMENTATION

107. **README Windows installation section:** added with install, launch/tray, startup, uninstall/user-data, unsigned SmartScreen, version, production exclusions, and clean commands.
108. **Release notes path:** `RELEASE_NOTES.md`.
109. **Clean-build instructions:** `npm ci`, `npm run build`, `npm test`, `npm run package:win`, then `npm run audit:release`; no manual file copy is required.
110. **Final artifact inventory:** installer `THUKUNA-Setup-0.1.0.exe` (322,673,487 bytes, SHA-256 `8A60...EDF3`); blockmap (335,021 bytes, SHA-256 `FB28...C980`); unpacked app directory (596,957,923 bytes); unpacked `THUKUNA.exe` (246,261,760 bytes, SHA-256 `1E73...3E64`); `app.asar` (211,489,831 bytes, SHA-256 `4132...09A0`); `release-audit.json` (content audit); and `builder-debug.yml` (builder diagnostic metadata).

## FINAL

111. **Bugs discovered:** overly broad packaged inputs, stale-output risk, missing release icons/identity details, production dev controls enabled, absent single-instance lock, ambiguous Windows startup target, and insufficient bounded production failure logging.
112. **Fixes made:** runtime allowlist, clean dist/release steps, production bundle flag, canonical ICO/tray PNG, stable NSIS x64 identity, ASAR audit with 116 hash checks, installed-executable startup settings, single-instance handling, bounded local diagnostics, seven release tests, soak sampler, README, and release notes.
113. **Unresolved issues:** Codex-host Electron renderer failure; authoritative installed GUI/tray/startup/single-instance validation; normal per-user uninstall verification; Defender scan permission; and packaged soak evidence.
114. **Optional limitations:** unsigned publisher/SmartScreen reputation, no Windows 10 physical test, no physical multi-monitor test, and no 125%/150% DPI test. These are not represented as passed.
115. **Exact final verdict:** **B. ENGINEERING COMPLETE — MINOR MANUAL VALIDATION REMAINS**.
116. **Phase 11.5 remains fully closed:** CONFIRMED; Phase 12 did not rebalance or redesign THUKUNA behavior.
117. **Phase 13 NOT started:** CONFIRMED.
118. **Exact recommended next action:** on the user's normal Windows desktop, run `release\THUKUNA-Setup-0.1.0.exe`, complete the item 55 user flow, then run `powershell -ExecutionPolicy Bypass -File scripts\phase12-packaged-soak.ps1`; attach `phase12-packaged-soak.csv` so the remaining live checks can be recorded and the verdict upgraded to A if they pass.
