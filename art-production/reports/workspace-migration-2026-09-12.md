# THUKUNA Workspace Migration — 2026-09-12

## Technical completion report

### MIGRATION

1. **Resolved source path:** `C:\Users\soham\Documents\Codex\2026-09-05\ca\outputs\thukuna`.
2. **Resolved destination path:** `C:\Users\soham\OneDrive\Desktop\window bot`. Windows `GetFolderPath("Desktop")` was blank under the Codex token and the registry value pointed to a nonexistent local Desktop; the existing, empty `window bot` folder under the available OneDrive Desktop established the actual destination.
3. **Copy method used:** `robocopy` with `/E /COPY:DAT /DCOPY:T /R:2 /W:1 /XJ`, excluding only reproducible `node_modules`.
4. **Copy result:** PASS. Robocopy exit code 1 means files were copied successfully; 901 files, 144 directories, and 1,950,747,520 bytes were transferred with zero failures, mismatches, or extras.
5. **Source retained:** YES. The old folder was not moved, deleted, renamed, or edited.
6. **Destination file count:** 901 migrated project/evidence files before dependency installation and regenerated build/test output; 981 non-`node_modules` files after verification, before this report was added.
7. **Migration errors:** none. The only expected deviation is that the source was not a Git repository; the user explicitly authorized a non-Git copy.

### GIT

8. **`.git` transferred:** NO—there was no `.git` directory or gitfile in the source to transfer.
9. **Branch:** not applicable; source and destination are non-Git folders.
10. **Latest commit:** not applicable; no Git history exists in the supplied source.
11. **Remote:** not applicable; no Git configuration exists in the supplied source.
12. **Git status before migration:** `fatal: not a git repository (or any of the parent directories): .git`.
13. **Git status after migration:** the same expected non-Git result.
14. **Uncommitted changes preserved:** YES in the filesystem sense. Before destination-only edits, SHA-256 comparison of all 901 copied files produced zero missing files, zero extras, zero length mismatches, and zero hash mismatches. Git cannot label them “uncommitted” because no repository exists.
15. **New Git top-level path:** not applicable. The authoritative filesystem project root is `C:\Users\soham\OneDrive\Desktop\window bot`.

### ASSETS

16. **Production sprite count:** 116.
17. **Animation family count:** 15.
18. **Domain frame count:** 20.
19. **Asset integrity result:** PASS. All migrated files initially matched source SHA-256 hashes; the Phase 12 ASAR audit also matched all 116 packaged sprites to the production source set.

### PATH AUDIT

20. **Old absolute-path references found:** 15 final text matches: 11 inherited historical/generated matches plus 4 necessary references in this migration report identifying the source/backup location.
21. **Runtime references fixed:** none required. Current runtime source and regenerated `dist` contain zero references to the old path and already derive paths from module/repository/Electron locations.
22. **Script references fixed:** none required. `package.json`, `src`, `scripts`, `diagnostics`, and `tests` contain zero old-workspace references.
23. **Historical references intentionally retained:** four report references describing where old Phase 11.5 runs occurred, four copied Chromium profile log entries, and three copied `release/builder-debug.yml` entries. These are historical/generated evidence and are not runtime inputs.
24. **Repository relocatable:** YES as a filesystem project. Build, tests, assets, and release audit resolve from the checkout rather than relying on the previous absolute path.

### QUALITY

25. **`npm ci` result:** PASS; 314 packages installed from the unchanged `package-lock.json`. The copied source `node_modules` was neither used nor modified.
26. **`npm run build` result:** PASS from the new workspace.
27. **`npm test` result:** PASS from the new workspace, zero failures.
28. **Final test count:** 199 passed.
29. **`npm start` migration/path result:** PASS for migration scope. It rebuilt and reached THUKUNA's main module from the new workspace. The Codex token then received Access Denied creating Electron's singleton lock; this is an existing host/token limitation, not an old-path dependency. No project Electron process remained.
30. **Release audit result:** PASS from the new workspace: ASAR enabled, 169 entries, 116 matching sprites, 15 families, x64 identity, production controls disabled, secure Electron options retained, and no updater.
31. **`package:win` result:** not rerun. The copied installer, blockmap, and ASAR match the source hashes exactly, and `npm run audit:release` succeeds from the new path; rebuilding would only replace already-verified historical release artifacts with new hashes.

### WORKSPACE

32. **Authoritative new THUKUNA path:** `C:\Users\soham\OneDrive\Desktop\window bot`.
33. **Old workspace status:** retained unchanged as legacy/backup only.
34. **Future work location:** all future THUKUNA commands, edits, tests, builds, reports, and later phase work must use `C:\Users\soham\OneDrive\Desktop\window bot`.
35. **Phase 15 started:** NO.

## Beginner-friendly explanation

### What a workspace is

A project workspace is the main folder that contains everything used to develop an application. For THUKUNA, that includes the TypeScript source code, images, tests, build scripts, installer configuration, reports, and dependency descriptions. A terminal opened in the workspace can run commands such as `npm test` because it can see `package.json` in the current folder.

THUKUNA originally lived under a Codex-generated dated folder because that was the working directory assigned when development began. That was useful during construction, but it is awkward as a permanent home: the path is long, tied to one Codex session layout, and easy to confuse with temporary output. The new `window bot` folder is a stable location chosen by the developer.

### Copying a folder versus preserving Git

Copying transfers normal files and directories. Preserving a Git repository additionally requires copying the hidden `.git` directory. `.git` normally stores commit history, branches, tags, remotes, and Git's index. Without it, source files still work, but commands such as `git status` cannot describe their history or changes.

The supplied THUKUNA source did not contain `.git`, and Git confirmed that neither the source nor an ancestor was a repository. Therefore this migration could preserve every project file, but it could not preserve Git history that was not present. No replacement repository was invented because this task explicitly prohibited `git init`; after your instruction, the project was migrated honestly as a non-Git folder.

### Why the package files matter

`package.json` describes the project, commands, metadata, and dependency ranges. `package-lock.json` records the exact dependency versions selected for a reproducible install. Together they let `npm ci` reconstruct `node_modules`.

`node_modules` is a large generated dependency folder. It is less valuable to copy because it can contain platform-specific caches or stale files. We excluded it, copied the authoritative package files, and ran `npm ci` in the new workspace. That installed 314 packages cleanly without touching the old copy.

### Absolute and relative paths

An absolute path starts from a drive, for example:

```text
C:\Users\soham\Documents\Codex\2026-09-05\ca\outputs\thukuna\assets
```

That path breaks when the project moves. A relative path describes a location from a known project file, such as `assets/thukuna/animations`, or a script derives the project root from `$PSScriptRoot`, `__dirname`, or `import.meta.dirname`. Relative/derived paths make the project relocatable.

The scan found zero old absolute-path references in current source, scripts, tests, or regenerated build output. Eleven inherited references remain only in old reports, old browser-profile logs, and builder diagnostics; this migration report necessarily mentions the source path four more times. They describe past runs or this transfer and do not control current behavior, so changing them would falsify historical evidence without improving the app.

### How integrity was checked

Robocopy reported every transferred file and zero failures. More importantly, every one of the 901 copied files was matched by relative filename, length, and SHA-256 hash before destination-only edits. A SHA-256 hash acts like a very sensitive file fingerprint: matching hashes provide strong evidence that the bytes are identical.

The production sprite tree was checked separately:

- 116 production PNG files
- 15 animation-family folders
- 20 Domain Expansion frames
- 116 packaged sprite hashes matched by the release audit

The installer, blockmap, packaged ASAR, Phase 11.5 soak CSV, and Phase 12 packaged-soak CSV also match their old-workspace hashes exactly.

### Why build and tests matter

A successful copy alone does not prove that imports, scripts, or generated paths still work. `npm run build` compiled THUKUNA from the new folder. `npm test` then ran all 199 automated tests with zero failures. `npm run audit:release` opened the copied Windows release from the new location and revalidated its architecture, ASAR contents, sprites, security settings, and production policy.

`npm start` also rebuilt and entered THUKUNA's main process from the new folder. Electron's GUI could not continue because this Codex token could not create its process-singleton lock. Since the new path was already used successfully by the build and main module, that host error is not a migration failure.

### Why the old folder remains

The old folder is a safety copy. If you later notice a missing personal note or want to compare something manually, it is still available. Deleting it during the same operation would turn a recoverable copy mistake into data loss. It may be archived or deleted manually after you are satisfied with the new workspace and any OneDrive synchronization has completed.

From now on, do not open an old terminal and accidentally continue editing the dated Codex folder. Two independent copies can silently diverge: fixes made in one do not appear in the other. The `window bot` checkout is now authoritative.

### Confirming the correct workspace yourself

Open PowerShell inside `window bot` and run:

```powershell
Get-Location
Resolve-Path .
Test-Path .\package.json
npm test
```

The first two commands should show:

```text
C:\Users\soham\OneDrive\Desktop\window bot
```

`Test-Path` should return `True`, and the test command should report 199 passes.

These Git commands are normally useful in a repository:

```powershell
git rev-parse --show-toplevel
git status
```

For THUKUNA today, they are expected to report “not a git repository” because the original workspace had no `.git`. If Git is deliberately introduced in a separate future task, `git rev-parse --show-toplevel` should then show the new `window bot` path.

### Before and after

```text
Before
C:\Users\soham\Documents\Codex\2026-09-05\ca\outputs\thukuna
└── authoritative development folder

After
C:\Users\soham\OneDrive\Desktop\window bot
└── AUTHORITATIVE development folder

C:\Users\soham\Documents\Codex\2026-09-05\ca\outputs\thukuna
└── legacy backup only (unchanged)
```

### File/folder overview

```text
window bot\
├── package.json / package-lock.json  dependency and command definitions
├── src\                            Electron and THUKUNA source code
├── assets\                         116 production sprites and icons
├── tests\                          automated test suite
├── scripts\                        build, audit, packaging, and soak tools
├── diagnostics\                    diagnostic repro/tools
├── art-production\                 art history and phase reports
├── release\                        Windows installer and unpacked release
├── dist\                           regenerated compiled output
├── README.md                        user/developer guide
└── RELEASE_NOTES.md                 version 0.1.0 release notes
```

### Common mistakes after moving a project

- Opening PowerShell in the old dated folder and making changes there.
- Creating two different “latest” copies and forgetting which one is authoritative.
- Deleting the backup before checking OneDrive synchronization and normal-desktop behavior.
- Copying stale `node_modules` instead of running `npm ci`.
- Editing generated `dist` or `release` files instead of their source/build configuration.
- Adding personal absolute paths to scripts when a relative path would work.
- Assuming Git history exists just because source files exist.
- Running commands from the parent Desktop folder rather than the folder containing `package.json`.

### Five-minute recap

1. A workspace is the folder containing the complete project.
2. THUKUNA's permanent workspace is now `C:\Users\soham\OneDrive\Desktop\window bot`.
3. The old dated Codex folder is a read-only-style backup for you to keep temporarily.
4. This is a non-Git project because the source had no `.git`; no history was lost during copying, but none was available to transfer.
5. All 901 original files matched byte-for-byte immediately after copying.
6. `npm ci`, the build, 199 tests, and the release audit all pass from the new workspace.
7. All 116 sprites, 15 families, 20 Domain frames, reports, CSVs, and Windows release artifacts survived.
8. Current scripts contain no dependency on the old absolute path.
9. Always check `Get-Location` before future work.
10. Phase 15 has not begun.
