# Phase 11.5.2A — Electron Host Sandbox / ACL Diagnostic

Date: 2026-09-12

Status: diagnostic complete. The tests do not prove a THUKUNA configuration defect, project-tree ACL defect, or safe GPU-sandbox workaround. The best-supported classification is **CODEX HOST PROCESS / DESKTOP RESTRICTION**.

## Completion report

1. **Normal `electron .` result.** **FAIL.** `npx electron .` exited 1 after reaching the main module, `app.whenReady()`, BrowserWindow construction, and the load request. The renderer reported `launch-failed (49)`; `did-finish-load`, `ready-to-show`, and visible-window stages were not reached. GPU children repeatedly exited `-1073741515` (`0xC0000135`) before Chromium's fatal GPU termination.

2. **`electron . --disable-gpu-sandbox` result.** **FAIL / HUNG UNTIL TERMINATED.** Main, app ready, BrowserWindow construction, and the load request were reached. The renderer still reported `launch-failed (49)` twice; `did-finish-load`, `ready-to-show`, and visibility were not reached. The separate GPU `-1073741515` crash messages disappeared, but the application did not become usable. There was no natural exit code; the controlled run was terminated, after which the command session closed with code 1.

3. **Minimal Electron normal result.** **FAIL.** The existing `diagnostics/electron-minimal` app reached `MAIN_MODULE`, `APP_READY`, and `BROWSER_WINDOW_CONSTRUCTED`. Its renderer reported `launch-failed (49)`, its GPU process repeatedly exited `-1073741515`, and neither `DID_FINISH_LOAD` nor `READY_TO_SHOW` occurred. Electron's fatal shutdown surfaced as process code 0 in this run, which is not a functional pass.

4. **Minimal Electron with `--disable-gpu-sandbox`.** **FAIL / HUNG UNTIL TERMINATED.** Main, app ready, and BrowserWindow construction were reached, and the separate GPU crash log disappeared. The renderer still reported `launch-failed (49)` twice; the document did not finish loading and no window became ready or visible. The verified test processes were terminated after the result was established.

5. **Clean-profile plus `--disable-gpu-sandbox` result.** **FAIL / HUNG UNTIL TERMINATED.** THUKUNA was run with a new profile at `%TEMP%\thukuna-electron-gpu-sandbox-test-20260912`. Main, app ready, BrowserWindow construction, and the load request were reached. The clean profile removed the prior `os_crypt` and cache warnings, and the flag removed the separate GPU crash messages, but the renderer still reported `launch-failed (49)` twice. No document-load, ready-to-show, or visible-window event occurred.

6. **Project-root ACL.** All shown ACEs are inherited. `M` includes read/execute; the project is not missing execute access for the Codex sandbox group.

   ```text
   S-1-5-21-4337423-894823691-1033422675-2602061227:(I)(OI)(CI)(M)
   S-1-5-21-1092849394-2041164185-3473686583-1536171540:(I)(OI)(CI)(M)
   Soham-HP16\CodexSandboxUsers:(I)(OI)(CI)(M)
   S-1-5-21-2204335103-2366887872-1252686167-4168645871:(I)(OI)(CI)(M)
   NT AUTHORITY\SYSTEM:(I)(OI)(CI)(F)
   BUILTIN\Administrators:(I)(OI)(CI)(F)
   Soham-HP16\soham:(I)(OI)(CI)(F)
   ```

7. **Electron `dist` ACL.** It matches the project root: the same three unresolved SIDs and `CodexSandboxUsers` have inherited object/container `M`; SYSTEM, Administrators, and the desktop user have inherited `F`. No restriction or missing read/execute ACE was found.

   ```text
   S-1-5-21-4337423-894823691-1033422675-2602061227:(I)(OI)(CI)(M)
   S-1-5-21-1092849394-2041164185-3473686583-1536171540:(I)(OI)(CI)(M)
   Soham-HP16\CodexSandboxUsers:(I)(OI)(CI)(M)
   S-1-5-21-2204335103-2366887872-1252686167-4168645871:(I)(OI)(CI)(M)
   NT AUTHORITY\SYSTEM:(I)(OI)(CI)(F)
   BUILTIN\Administrators:(I)(OI)(CI)(F)
   Soham-HP16\soham:(I)(OI)(CI)(F)
   ```

8. **`electron.exe` ACL.** The executable inherits `M` for the same unresolved SIDs and `CodexSandboxUsers`, and `F` for SYSTEM, Administrators, and the desktop user. `M` includes the execute right needed to launch it.

   ```text
   S-1-5-21-4337423-894823691-1033422675-2602061227:(I)(M)
   S-1-5-21-1092849394-2041164185-3473686583-1536171540:(I)(M)
   Soham-HP16\CodexSandboxUsers:(I)(M)
   S-1-5-21-2204335103-2366887872-1252686167-4168645871:(I)(M)
   NT AUTHORITY\SYSTEM:(I)(F)
   BUILTIN\Administrators:(I)(F)
   Soham-HP16\soham:(I)(F)
   ```

9. **Unknown SID findings.** The project, Electron `dist`, and executable inherit three unresolved account SIDs: `S-1-5-21-4337423-894823691-1033422675-2602061227`, `S-1-5-21-1092849394-2041164185-3473686583-1536171540`, and `S-1-5-21-2204335103-2366887872-1252686167-4168645871`; each grants `M`, so none is restrictive. TEMP inherits a different unresolved SID, `S-1-5-21-1293355999-665119703-71607638-1340448066`, also granting `M`. These unresolved allow ACEs are unusual but do not establish causality.

10. **Explicit DENY findings.** **None** on the project root, Electron `dist`, `electron.exe`, TEMP root, clean TEMP profile, or disposable TEMP app. No DENY ACE explains the process failures.

11. **Current-user/token findings.** The process runs as `soham-hp16\codexsandboxoffline` (SID ending `-1006`), not as the normal desktop account, and is a member of `Soham-HP16\CodexSandboxUsers` (SID ending `-1005`). It has a Medium mandatory integrity label and exposes only `SeChangeNotifyPrivilege` as enabled. It is still in the interactive console session and also belongs to Everyone, BUILTIN\Users, INTERACTIVE, CONSOLE LOGON, Authenticated Users, This Organization, Local account, LOCAL, and NTLM Authentication groups. Environment paths point at the normal `soham` user profile/TEMP tree. This is clear evidence of a purpose-specific Codex token/context, but it does not identify the inaccessible low-level resource.

12. **TEMP minimal-app result.** **FAIL.** The exact Electron 44.2.0 binary ran the two-file minimal app from `%TEMP%\electron-acl-test`. Main, app ready, and BrowserWindow construction were reached, followed by renderer `launch-failed (49)`, repeated GPU `-1073741515`, and no loaded or visible window. Moving the app out of the project tree did not help.

13. **TEMP plus `--disable-gpu-sandbox` result.** **FAIL / HUNG UNTIL TERMINATED.** The separate GPU crash messages disappeared, but renderer `launch-failed (49)` occurred twice and no loaded/visible window appeared. The verified recent Electron processes were terminated after the result was captured.

14. **TEMP ACL.** Before any explicit grant, the disposable directory inherited `M` for `CodexSandboxUsers` and the TEMP-specific unresolved SID, and `F` for SYSTEM, Administrators, and the desktop user. It had no DENY, `ALL APPLICATION PACKAGES`, or `ALL RESTRICTED APPLICATION PACKAGES` entry.

   ```text
   Soham-HP16\CodexSandboxUsers:(I)(OI)(CI)(M)
   S-1-5-21-1293355999-665119703-71607638-1340448066:(I)(OI)(CI)(M)
   NT AUTHORITY\SYSTEM:(I)(OI)(CI)(F)
   BUILTIN\Administrators:(I)(OI)(CI)(F)
   Soham-HP16\soham:(I)(OI)(CI)(F)
   ```

15. **Project-vs-TEMP ACL differences.** Both locations grant inherited object/container `M` to `CodexSandboxUsers`, inherited `F` to SYSTEM/Administrators/the desktop user, and contain no DENY or application-package ACE. The project has three project-tree unresolved `M` ACEs; TEMP has one different TEMP-tree unresolved `M` ACE. These are additive allow entries, and both app locations fail identically, so the differences are not causal.

16. **TEMP ACL reset result.** `icacls <verified disposable TEMP path> /reset /T /C` processed all three objects with zero failures. The directory returned to the same inherited TEMP allow ACL, and the subsequent normal minimal run still failed with renderer code 49 and GPU `-1073741515`. **No effect.** The real repository was not reset.

17. **Restricted-app-packages grant result.** The relevant ACE was initially absent, so the authorized disposable-only test granted `S-1-15-2-2:(OI)(CI)(RX)` to `ALL RESTRICTED APPLICATION PACKAGES`; all three objects were processed with zero failures. **Before grant: FAIL. After grant: FAIL.** A normal rerun still produced renderer code 49 and GPU `-1073741515`. A combined post-grant `--disable-gpu-sandbox` run suppressed the GPU crash log but still produced renderer code 49 twice and no window. The grant was never applied to the project.

18. **`ALL APPLICATION PACKAGES` findings.** SID `S-1-15-2-1` was absent from both project and TEMP ACLs. It was inspected but not added blindly. `ALL RESTRICTED APPLICATION PACKAGES` was also absent initially; adding it to only the disposable TEMP copy did not affect the failure.

19. **Exact Windows version/build.** Registry winver-equivalent data reports `DisplayVersion 25H2`, build `26200.9445` (`CurrentBuild 26200`, `UBR 9445`), `BuildLabEx 26100.1.amd64fre.ge_release.240331-1435`, Core/Home client edition. The legacy registry `ProductName` value says `Windows 10 Home`, even though build 26200 is the current Windows 11-era installation previously observed.

20. **Was ACL causality proven?** **NO.** Both locations already provided the Codex sandbox group Modify access with no DENY. Moving to TEMP, resetting TEMP ACLs, and adding restricted-app-package RX all failed to change renderer startup.

21. **Was GPU-sandbox causality proven?** **NO for the overall failure; partial only for one symptom.** `--disable-gpu-sandbox` consistently removed the separate GPU `-1073741515` crash messages, so the flag affects GPU subprocess behavior. It did not let either THUKUNA or the minimal renderer launch, load, become ready, or become visible. It therefore is not a solution and does not prove that the GPU sandbox is the root cause of the unusable app.

22. **Was project-location causality proven?** **NO.** The project-root minimal app and two-file TEMP copy failed at the same renderer/GPU boundary. TEMP also remained broken after ACL reset and explicit restricted-app RX.

23. **Does a Codex-host restriction remain likely?** **YES.** The dedicated `codexsandboxoffline` identity, restricted privilege set, identical renderer failure across app/location/profile/ACL variants, and the user's successful normal-desktop launch collectively make a broader host process/desktop restriction the strongest remaining explanation.

24. **Final classification.** **CODEX HOST PROCESS / DESKTOP RESTRICTION**

25. **Safe dev-only workaround.** **NO.** The only candidate flag changed GPU logging but did not create a usable renderer or visible window. No evidence-backed repository workaround exists.

26. **Was `start:codex` added?** **NO.** Its strict prerequisite—that `--disable-gpu-sandbox` make both minimal Electron and THUKUNA work—was not met.

27. **Was production `npm start` changed?** **NO.** It remains `npm run build && electron .`.

28. **Was the project ACL modified?** **NO.** All reset/grant operations targeted the exact verified disposable TEMP directory only. The project ACL was read, not written.

29. **Was production sandbox/security changed?** **NO.** `sandbox: true`, `contextIsolation: true`, and `nodeIntegration: false` remain in `src/main/petWindow.ts`. No `--no-sandbox`, `--disable-sandbox`, persistent GPU-sandbox flag, global relaxation, or production security downgrade was added.

30. **Temporary directories remaining.** **None from this diagnostic.** `%TEMP%\electron-acl-test`, `%TEMP%\thukuna-electron-gpu-sandbox-test-20260912`, and the repository's generated `diagnostics/profiles` directory were verified and permanently removed after testing. Two verified leftover test processes using this project's Electron binary were also stopped; zero project Electron processes remain. `diagnostics/electron-minimal` remains intentionally as the small reproducible diagnostic source, not a runtime profile.

31. **Exact next recommended action.** Treat Codex-host GUI execution as unavailable and use the user's normal Windows desktop for live THUKUNA smoke/soak testing. If host-level investigation is desired, the Codex runtime owner should trace Electron renderer process creation under `codexsandboxoffline` with Windows Process Monitor and relevant process-mitigation/AppContainer or Code Integrity logs, comparing it with a normal-desktop launch. No repository, Electron-version, DLL, or ACL change is justified by the current evidence.

32. **Phase 12.** **NOT STARTED.** No Phase 12 feature, installer, packaging, updater, LLM, voice, microphone, command, Domain, panel, animation, locomotion, FSM, or sprite work was performed. No soak was run.

## Decision matrix

| Case | Observed | Conclusion |
|---|---:|---|
| Project minimal fails; TEMP works | No | Project-tree ACL causality not supported |
| Both fail; GPU-sandbox-disabled works | No | GPU-sandbox workaround not supported |
| TEMP works after ACL reset/grant | No | ACL/app-package causality not supported |
| Everything fails, including TEMP and GPU-sandbox-disabled | **Yes** | Broader Codex-host process/desktop restriction |
| Minimal works; THUKUNA fails | No | THUKUNA configuration causality not supported |

No final soak was run, and no production behavior was changed.
