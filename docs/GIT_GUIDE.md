# THUKUNA Git and GitHub Guide

This project uses Git for local version history and GitHub for a private remote backup and collaboration point. Git and GitHub are related, but they are not the same thing: Git is the version-control program on this computer; GitHub is an online service that can store a copy of the Git repository.

## The basic model

```text
files you edit
    |
    | git add
    v
staging area
    |
    | git commit
    v
local repository (main branch and tags)
    |
    | git push
    v
private GitHub repository (origin)
```

- A **repository** is a project folder whose history is managed by Git.
- The **working tree** is the current set of files you can edit.
- The **staging area** is the exact set of changes selected for the next commit.
- A **commit** is a permanent, named snapshot in local history.
- A **branch** is a movable name pointing to a line of commits. THUKUNA's primary branch is `main`.
- `HEAD` means the commit currently checked out.
- A **tag** is a fixed milestone label, such as `v0.1.0-windows`.
- A **remote** is another copy of the repository. The conventional name for the main GitHub remote is `origin`.
- `push` sends local commits and tags to a remote. `pull` receives remote work and integrates it locally. `fetch` receives remote history without integrating it.

## Why the early history says “reconstructed”

THUKUNA was developed through Phase 12 before Git was initialized. No exact historical source snapshots survived. The early phase commits are therefore empty, clearly labelled reconstruction markers based on surviving documentation, tests, and current code. They describe known milestones without pretending to contain the original file state, author date, or chronology. The canonical Phase 12 baseline is the first real source snapshot in this repository. Future work, beginning with Phase 15, should use normal commits as the work happens.

## Safe everyday workflow

Run commands from the authoritative folder:

```powershell
Set-Location 'C:\Users\soham\OneDrive\Desktop\window bot'
git status
git diff
git add <specific-file>
git diff --cached
git commit -m "Describe the completed change"
git push origin main
```

Prefer adding specific files. Use `git add --all` only after reviewing `git status`. Before committing, `git diff` shows unstaged changes and `git diff --cached` shows exactly what the commit will contain.

Good commits are small, complete, and understandable. A message such as `fix: keep pet size stable while dragging` is more useful than `updates`. Do not commit generated installers, `node_modules`, caches, local profiles, runtime CSV evidence, secret `.env` files, or signing keys; `.gitignore` protects these paths, but always review the staged list.

## Inspecting history and milestones

```powershell
git log --oneline --decorate --graph --all
git show --stat HEAD
git tag --list
git show v0.1.0-windows
```

Checking out an old tag directly creates a detached `HEAD`, which is useful for inspection but not for normal editing. Return with `git switch main`. If new work must begin from an old point, create a branch instead: `git switch -c <new-branch-name> <tag>`.

## Branches and merging

For a focused feature or risky fix:

```powershell
git switch main
git pull --ff-only origin main
git switch -c feature/short-description
# edit, test, add, and commit
git switch main
git merge --no-ff feature/short-description
git push origin main
```

A merge conflict means Git cannot safely choose between overlapping changes. Open each conflicted file, select the intended final content, remove Git's conflict markers, test, then `git add` the resolved files and complete the merge commit. Do not blindly discard one side.

## Undoing mistakes safely

First run `git status` and identify whether the mistake is unstaged, staged, committed, or already pushed.

```powershell
# Unstage a file while keeping its edits
git restore --staged <file>

# Discard an uncommitted file edit (destructive to that edit)
git restore <file>

# Correct the most recent local commit message or contents
git commit --amend

# Safely undo a committed change by creating a new inverse commit
git revert <commit-hash>
```

Use `git revert` for history that has been pushed. Avoid `git reset --hard`, force-pushing, or deleting branches until you understand exactly what will be lost. If unsure, make a backup branch first: `git branch backup/before-recovery`.

## Private GitHub checks

After GitHub CLI is installed and authenticated, these commands show the connection and privacy state:

```powershell
gh auth status
git remote -v
gh repo view --json nameWithOwner,visibility,url
git status -sb
git branch -vv
```

The GitHub result must report `PRIVATE`. Never create a public fallback. The first push normally uses `git push -u origin main`; tags use `git push origin --tags`. The `-u` records the upstream so future `git push` and `git pull` know which remote branch to use.

Repository privacy controls who can access GitHub's copy; it does not encrypt secrets accidentally committed to history. If a password, token, private key, or signing certificate is ever committed, revoke or rotate it immediately and then clean the history with appropriate help.

## Quick reference

| Goal | Command |
|---|---|
| See current changes | `git status` |
| Review unstaged edits | `git diff` |
| Stage one file | `git add <file>` |
| Review the next commit | `git diff --cached` |
| Create a commit | `git commit -m "message"` |
| View compact history | `git log --oneline --decorate --graph --all` |
| Create a branch | `git switch -c <name>` |
| Return to main | `git switch main` |
| Download remote history | `git fetch origin` |
| Update main without an implicit merge | `git pull --ff-only origin main` |
| Push main | `git push origin main` |
| Push tags | `git push origin --tags` |
| Safely undo a pushed commit | `git revert <hash>` |

Always confirm that the PowerShell prompt is inside `C:\Users\soham\OneDrive\Desktop\window bot` before committing. The old Codex workspace is a legacy backup, not the authoritative repository.
