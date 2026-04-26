---
name: quality-peer-review-niche
description: Peer review the **new work** on the current niche/* branch (vs origin/<NICHE_BRANCH> on a -general branch, or vs origin/niche/<TAG>-general on a feature branch). Separately detects backend and shared-library leaks against origin/general (these would never reach production via stage→main) and cherry-picks clean backend-only commits introduced on this branch over to general. Implements low-risk improvements, fixes bugs, adds regression tests for bugfixes where valuable, and resolves quality issues. Requires local Docker Compose infrastructure to be running.
user-invocable: true
allowed-tools: Bash(docker*), Bash(git*), Bash(npx*), Bash(npm*), Bash(node*), Read, Glob, Grep, Edit, Write, Agent
argument-hint: [--dry-run]
---

# Peer Review: niche/* new work

Perform a structured peer review of the **new work** on the current `niche/*` branch — scoped to unpushed commits + uncommitted changes when on `niche/<TAG>-general`, or to commits unique to the feature branch when on `niche/<TAG>-feature-*`. Separately detects and remediates backend / shared-library leaks introduced on this branch (compared to `origin/general`) by cherry-picking them over. This skill is intended to run **locally** with Docker Compose infrastructure active. It will not run automatically — you must invoke it explicitly.

**`--dry-run`**: Analyze and report findings without making any code changes, commits, cherry-picks, or running tests.

## Why this skill exists (read first)

The deploy pipeline only runs on `stage → main`. Niche branches never merge into `stage`. Therefore:

- **Backend service code** (`therr-services/*`, `therr-api-gateway/*`)
- **Shared library code** (`therr-public-library/*`)
- **Database migrations**
- **Shared infrastructure** (root `package.json`, `docker-compose*.yml`, `_bin/*`)

…committed only to a niche branch is **dead code** — it will never reach production. All such changes must live on `general` instead. This skill's primary job is detecting these leaks and lifting clean ones over to `general`. Niche-appropriate work (mobile branding, brand-specific web views, brand assets, brand-specific config) stays on the niche branch.

---

## Step 0: Verify this is a local dev session with infrastructure running

This skill requires Docker Compose dev infrastructure. Check for the critical services:

```bash
docker ps --format "{{.Names}}\t{{.Status}}" 2>&1
```

Parse the output:
- Look for `therr-postgres-dev` with a `healthy` or `Up` status.
- Look for `therr-redis-dev` with a `healthy` or `Up` status.

**If Docker is not running at all** (command fails or returns nothing):
```
⛔ Infrastructure check failed: Docker is not running.
   This command requires the local Docker Compose dev environment.
   Start it with: docker compose -f docker-compose.dev.yml up -d
   Then re-run /quality-peer-review-niche once services are healthy.
```
Stop immediately. Do not proceed.

**If Docker is running but postgres or redis containers are missing/unhealthy**:
```
⛔ Infrastructure check failed: Required containers are not running or healthy.
   Missing or unhealthy:
     - therr-postgres-dev  ← <status or "not found">
     - therr-redis-dev     ← <status or "not found">

   Start infrastructure with: docker compose -f docker-compose.dev.yml up -d
   Or for infra-only: docker compose -f docker-compose.infra.yml up -d

   Wait for containers to be healthy, then re-run /quality-peer-review-niche.
```
Stop immediately. Do not proceed.

**If both postgres and redis are up**, print a brief confirmation:

```
✓ Infrastructure check passed
  therr-postgres-dev  Up (healthy)
  therr-redis-dev     Up (healthy)
```

---

## Step 1: Confirm niche branch and establish diff scope

### 1a: Confirm current branch matches `niche/*`

```bash
git branch --show-current 2>&1
```

If the current branch does not start with `niche/`, warn the user:
```
⚠ You are on '<branch>', not a niche/* branch.
  /quality-peer-review-niche is designed for niche branches.
  For the general → stage review, use /quality-peer-review instead.
```
Stop and ask the user to confirm before proceeding. Save the branch name as `<NICHE_BRANCH>` for use throughout the rest of the skill.

### 1b: Pull origin/<NICHE_BRANCH> with autostash

Use `--autostash` so any uncommitted local changes are stashed before the pull and re-applied after, keeping them in scope for the review:

```bash
git pull --autostash origin <NICHE_BRANCH> 2>&1
```

**If the pull results in merge conflicts** (output contains "CONFLICT" or exit code is non-zero):
```
⛔ Merge conflicts after pulling origin/<NICHE_BRANCH>.
   Resolve the conflicts below before re-running /quality-peer-review-niche:
   <list conflicting files from git status>
```
Stop immediately. Do not attempt to auto-resolve conflicts.

**If the autostash re-apply has conflicts** (output contains "CONFLICT" after "Applying stash"):
```
⛔ Stash re-apply conflicts after pulling origin/<NICHE_BRANCH>.
   Your local changes could not be cleanly re-applied.
   Resolve stash conflicts manually, then re-run /quality-peer-review-niche.
```
Stop immediately.

### 1c: Fetch origin/general for comparison

```bash
git fetch origin general 2>&1
```

If `general` doesn't exist on origin, report it and stop:
```
⛔ Cannot diff: branch 'general' not found on origin.
```

### 1d: Establish two diff bases

This skill uses **two separate diff bases** because leak detection and peer review answer different questions:

- **`<REVIEW_BASE>`** — the peer-review base. Scopes Steps 3–7 to **only the new work on this branch**, not everything that's ever lived on the niche line.
  - On a main niche branch (`niche/<TAG>-general`): `<REVIEW_BASE>` = `origin/<NICHE_BRANCH>`. Review covers unpushed commits + uncommitted changes.
  - On a feature branch off a niche line (e.g. `niche/HABITS-feature-foo`): `<REVIEW_BASE>` = `origin/niche/<TAG>-general`. Review covers commits unique to the feature branch + uncommitted changes.

- **`origin/general`** — the leak-detection base. Backend / shared-library leaks are dead code regardless of which niche sub-branch introduced them. Used in Step 2 only.

#### Determine `<REVIEW_BASE>`

Extract the niche tag from `<NICHE_BRANCH>`. The pattern is `niche/<TAG>-...` where `<TAG>` is uppercase letters (e.g. `HABITS`, `TEEM`):

```bash
NICHE_TAG=$(echo "<NICHE_BRANCH>" | sed -E 's|^niche/([A-Z]+)-.*$|\1|')
```

If extraction fails (output equals input or is empty), warn and stop:
```
⛔ Cannot parse niche tag from branch '<NICHE_BRANCH>'.
   Expected pattern: niche/<TAG>-... (e.g. niche/HABITS-general, niche/TEEM-feature-foo).
```

Fetch the parent niche branch from origin so the comparison is fresh:
```bash
git fetch origin niche/${NICHE_TAG}-general 2>&1
```

If `niche/<TAG>-general` doesn't exist on origin, report and stop:
```
⛔ Cannot diff: branch 'niche/<TAG>-general' not found on origin.
```

Set the review base:
- If `<NICHE_BRANCH>` == `niche/${NICHE_TAG}-general`: `<REVIEW_BASE>` = `origin/<NICHE_BRANCH>`
- Otherwise (feature branch): `<REVIEW_BASE>` = `origin/niche/${NICHE_TAG}-general`

#### Build the review diff (drives Steps 3–7)

Get the committed log:
```bash
git log --oneline <REVIEW_BASE>..HEAD 2>&1
```

Get the full working-tree diff (committed + staged + unstaged tracked files):
```bash
git diff <REVIEW_BASE> --stat 2>&1
git diff <REVIEW_BASE> 2>&1
```

Note any untracked files:
```bash
git status --short 2>&1
```

#### Hygiene checks

Check whether the niche branch is behind `general`:
```bash
git log --oneline HEAD..origin/general 2>&1
```
If non-empty, note it for the final report — the user should consider merging `origin/general` into the niche branch.

If on a feature branch (i.e. `<REVIEW_BASE>` is `origin/niche/<TAG>-general`), also check whether the feature branch is behind its parent:
```bash
git log --oneline HEAD..origin/niche/${NICHE_TAG}-general 2>&1
```
If non-empty, note it — the feature branch should consider merging the parent niche branch in.

#### No-op short-circuit

If the review diff is empty AND no leaked files exist against `origin/general` (Step 2a will compute these — for the short-circuit, do a quick `git diff origin/general --name-only` and grep for must-be-on-general paths):
```
ℹ No new work in review scope and no backend / shared-library leaks against origin/general.
  Nothing to review.
```
Stop.

If the review diff is empty but pre-existing leaks exist on the broader niche line, continue to Step 2 to surface them — Steps 3–7 will then no-op naturally.

#### Summary

Print:
- Review base used: `<REVIEW_BASE>`
- Leak base: `origin/general`
- Number of commits ahead of `<REVIEW_BASE>` (review scope)
- Number of commits ahead of `origin/general` (full niche divergence — informational)
- Files changed in review scope (from `--stat`)
- Whether unstaged/staged-but-uncommitted changes are included
- Which packages the review touches (TherrMobile/*, therr-client-web/*, therr-services/*, etc.)
- Whether the branch is behind `origin/general` and/or behind its parent niche branch

---

## Step 2: Detect & remediate backend / shared-library leaks (CRITICAL)

This is the most important step. Define **must-be-on-general paths** as any file matching one of:

```
therr-api-gateway/**
therr-services/**
therr-public-library/therr-js-utilities/**
therr-public-library/therr-react/**
therr-public-library/therr-styles/**
**/migrations/**
**/db/migrations/**
package.json                      (root level only — not TherrMobile/package.json or service package.json files)
package-lock.json                 (root level only)
docker-compose*.yml               (root level only)
_bin/**
```

Any change to these paths on a niche branch is a **leak** and must be moved to `general` to ever reach production.

### 2a: Enumerate leaked files

Compute two leak sets:

```bash
# Full picture: all leaked files vs origin/general (informational)
git diff origin/general --name-only 2>&1

# Actionable: leaks introduced in the review scope (these get cherry-picked)
git diff <REVIEW_BASE> --name-only 2>&1
```

Filter both to only the must-be-on-general paths above. Also check `git status --short` for uncommitted changes that match — these belong to the actionable set.

Define:
- **Actionable leaks** = files in the `<REVIEW_BASE>` diff matching must-be-on-general paths, plus uncommitted matches.
- **Pre-existing leaks** = (full set) − (actionable set). Report only; do not auto-remediate (they were already on the parent niche branch).

If both sets are empty, print:
```
✓ No backend / shared-library leaks detected.
```
Skip to Step 3.

If only pre-existing leaks exist (review scope is clean), print them as "see also" and skip the cherry-pick steps:
```
ℹ Pre-existing leaks on the niche line (not introduced by this branch):
    <list>
  These were already on the parent niche branch. To address them, switch
  to niche/<TAG>-general and re-run /quality-peer-review-niche there.
```
Skip to Step 3.

### 2b: Categorize each actionable leak

Operate on the **actionable** set only (leaks introduced in the review scope). For each actionable leaked file, determine which commit(s) on this branch introduced the change:
```bash
git log <REVIEW_BASE>..HEAD --oneline -- <file> 2>&1
```

Then for each commit that touched any actionable leaked file, classify it:

```bash
git show --stat --name-only <sha> 2>&1
```

- **Clean backend commit**: every file touched falls under the must-be-on-general paths.
- **Mixed commit**: touches both must-be-on-general paths and other (niche-appropriate) paths.

Also identify **uncommitted leaked files** (in working tree, not yet committed). These are handled separately in 2e.

### 2c: Report findings

Before remediating, print a clear inventory so the user can interrupt if anything looks wrong:

```
🔎 Backend / shared-library leaks detected on <NICHE_BRANCH>:

  Actionable (introduced in review scope):

    Clean backend commits (will be cherry-picked to general):
      <sha-short> "commit message"  — <N> files
      ...

    Mixed commits (cannot auto-remediate — manual split required):
      <sha-short> "commit message"
        Backend files: <list>
        Niche files:   <list>
      ...

    Uncommitted leaked files (will be moved to general working tree):
      <file>
      ...

  Pre-existing on parent niche line (informational — not auto-remediated):
    <file>
    ...
```

If `--dry-run`, stop here for this step and continue to Step 3 without modifying anything.

### 2d: Remediate clean backend commits (skip if `--dry-run`)

Cherry-pick clean backend commits to `general` in chronological order (oldest first). The niche branch's history is **not** rewritten — these commits stay on the niche branch as well. The duplicates will be subsumed when `general` is later merged into the niche branch.

```bash
# Save current branch
ORIGINAL_BRANCH=$(git branch --show-current)

# Switch to general
git checkout general 2>&1

# Verify local general is at or ahead of origin/general; fast-forward if behind
git merge --ff-only origin/general 2>&1
```

If `--ff-only` fails (local general has diverged from origin/general):
```
⛔ Local 'general' has diverged from origin/general.
   Cannot safely cherry-pick. Resolve the divergence first
   (e.g., reset general to origin/general or rebase your local commits),
   then re-run /quality-peer-review-niche.
```
Switch back to the niche branch (`git checkout $ORIGINAL_BRANCH`) and stop.

For each clean backend commit (in chronological order):
```bash
git cherry-pick <sha> 2>&1
```

If a cherry-pick fails with a conflict:
```bash
git cherry-pick --abort 2>&1
git checkout $ORIGINAL_BRANCH 2>&1
```
Then report:
```
⛔ Cherry-pick conflict applying <sha> "<msg>" to general.
   Aborted and returned to <NICHE_BRANCH>.
   This usually means general has diverged from where the niche commit was based.
   Manual cherry-pick or rebase is required. After resolving, re-run /quality-peer-review-niche.
```
Stop.

After all cherry-picks succeed, return to the niche branch:
```bash
git checkout $ORIGINAL_BRANCH 2>&1
```

Record the cherry-picked SHAs for the final report.

### 2e: Remediate uncommitted leaked files (skip if `--dry-run`)

For uncommitted backend files, move them to `general` without auto-committing — the user should write the commit message themselves since they wrote the code:

```bash
ORIGINAL_BRANCH=$(git branch --show-current)

# Stash only the leaked files
git stash push -m "niche-backend-leak" -- <leaked-file-1> <leaked-file-2> ... 2>&1

git checkout general 2>&1
git merge --ff-only origin/general 2>&1
git stash pop 2>&1
```

If `git stash pop` produces conflicts:
```
⛔ Stash pop conflict moving uncommitted backend files to general.
   The files are still in the stash; switch back to <NICHE_BRANCH> with:
     git checkout <NICHE_BRANCH>
     git stash list   # find the niche-backend-leak entry
     git stash pop <ref>
   Resolve manually, then re-run.
```
Stop.

Otherwise, leave the changes staged-or-unstaged on `general` for the user to inspect and commit. Then return to the niche branch:
```bash
git checkout $ORIGINAL_BRANCH 2>&1
```

Note in the final report: the user must `git checkout general`, review, and commit those changes manually.

### 2f: Mixed commits — report only

For mixed commits, do **not** rewrite history (the niche branch may have been pushed and shared). Report the SHA, the backend files, and a recommended manual procedure:

```
⚠ Mixed commit cannot be auto-remediated:
  <sha> "<msg>"
  Backend files (must move to general): <list>
  Niche files (stay on niche):          <list>

  Recommended manual fix:
    1. Save the backend portion as a patch:
         git show <sha> -- <backend-files...> > /tmp/backend.patch
    2. Apply it to general as a new commit:
         git checkout general && git apply /tmp/backend.patch
         git add <backend-files...> && git commit -m "<rewritten message>"
    3. The duplicate backend files on niche will be reconciled when
       general is later merged into the niche branch.
```

---

## Step 3: Backwards compatibility analysis

Even after backend leaks have been moved to `general`, the niche branch still ships frontend/mobile updates that must remain backwards compatible with the API version currently deployed. Mobile apps especially cannot be force-updated.

Flag any of the following as **breaking risk**:

1. **Mobile or web code that calls APIs only present on general** — e.g. a route that exists in `therr-api-gateway/src/` only on `general` (or only after Step 2's cherry-picks) but not yet on `main`. The niche client release would 404 in production until the API ships.
2. **Mobile or web code that depends on shared-library changes not yet released** — e.g. importing a new export from `therr-react` that only exists on `general`.
3. **Niche-only response-shape assumptions** — if the niche client expects a response field that's only added by a backend change still pending deploy.

Use:
```bash
git diff <REVIEW_BASE> -- TherrMobile/ therr-client-web/ therr-client-web-dashboard/ 2>&1
```
to focus the analysis on niche-side files **introduced by this branch**.

For each risk found, report clearly:
```
⚠ Backwards compatibility risk:
  File: TherrMobile/main/routes/Foo.tsx
  Issue: Calls /v1/foo/bar which only exists on general (cherry-picked above) — not yet in main.
  Recommendation: Hold the niche client release until the corresponding API change has shipped to main.
```

If no breaking risks are found, note that explicitly.

---

## Step 4: Identify low-risk, high-reward improvements

Review the **non-leak** portion of the **review diff** (the changes between `<REVIEW_BASE>` and `HEAD`, excluding files already handled in Step 2). Classify findings into these categories. Only flag genuine issues — do not invent problems.

### Category A: Bugs
- Logic errors, off-by-one issues, incorrect conditionals
- Missing null/undefined checks at system boundaries (user input, external API responses)
- Incorrect error handling (swallowing errors, wrong HTTP status codes)
- Race conditions or missing async/await
- Brand-conditional code that forgets to handle the niche brand variation correctly

### Category B: Low-Risk Improvements (implement unless `--dry-run`)
Apply these without asking:
- Unused imports or variables (lint-flagged)
- Inconsistent indentation or formatting issues
- Dead code (unreachable branches, commented-out code blocks)
- Obvious typos in variable names, comments, or string literals
- Missing `const` where `let` is used but not reassigned
- Duplicate logic within the same file that can be deduplicated simply

### Category C: Suggestions (report but do not implement)
These require more judgment or have wider impact:
- **Possible "should-be-shared" candidates**: niche-side changes that look generally applicable to all brands and might belong on `general` instead (e.g. a TherrMobile component change with no brand conditional). Per CLAUDE.md, ask the user before assuming.
- Patterns that could be abstracted into shared utilities (per CLAUDE.md abstraction rules)
- Performance concerns (N+1 query patterns, missing indices — flag, don't change schema)
- Security observations (logging sensitive data, missing input sanitization)
- Opportunities to improve error messages for developers
- Missing locale strings — if the diff adds user-facing copy in one locale dictionary but not all three (`en-us`, `es`, `fr-ca`), flag it (see CLAUDE.md i18n section)

---

## Step 5: Implement improvements (skip if `--dry-run`)

For each **Category B** improvement and **Category A** bug fix:

1. Read the affected file before editing.
2. Apply the change using Edit.
3. Keep each change minimal — fix exactly what was identified, nothing more.
4. Ensure changes remain backwards compatible (per Step 3 criteria).
5. **Do not add new must-be-on-general changes** in this step — if a fix would touch backend/shared-library code, treat it as a Category C suggestion instead and direct the user to make that fix on `general`.

### Step 5a: Add regression tests for bugfixes

For each **Category A** bugfix applied above, decide whether a regression test would add meaningful protection against the bug recurring. The goal is to lock in the corrected behavior, not to chase coverage.

**Add a regression test when the fix involves:**
- A logic error, incorrect conditional, or off-by-one (wrong operator, missing branch, inverted check)
- Previously unhandled edge cases at a boundary (null/undefined input, empty collection, zero/negative values, boundary dates)
- Incorrect error handling (swallowed errors, wrong HTTP status codes, wrong error shape)
- Incorrect data transformation, filtering, sorting, or aggregation
- A bug that silently returned incorrect results rather than throwing — these are the highest-value tests
- A missing `await` or race-condition fix that can be expressed as an ordered assertion

**Skip writing a test when:**
- The fix is a Category B improvement (typo, formatting, dead code, unused import, `let`→`const`) — these do not warrant tests
- The bug is purely cosmetic, log-only, or affects developer tooling rather than runtime behavior
- A passing test already covers the corrected behavior (verify by reading it — do not assume)
- Reproducing the bug requires significant new test scaffolding (new mocks for third-party SDKs, new DB fixtures, standing up services that aren't already covered), and the fix itself is low-risk
- The surface is UI-only in a package without a test runner configured for that surface

### For each test worth writing

1. **Locate the existing test file** for the affected module. Follow the package's existing convention — check neighboring files.
2. **Prefer unit tests over integration tests** when the bug can be exercised at the function or handler level with existing mocks.
3. **If no test file exists** for the module and the module is reasonably testable, create a minimal new test file matching the package's conventions. Do not introduce a new test framework or runner.
4. **Write a focused test** that would have failed against the pre-fix code and passes against the post-fix code.
5. **Name the test by the observable symptom**, not the implementation detail.
6. **Run the new test(s) in isolation** to confirm they pass.

If a bugfix genuinely cannot be covered without disproportionate effort or domain knowledge you don't have, **do not fabricate a test**. Record it under "Regression Tests" with a one-line reason.

### Commit

After all edits and new/updated tests, commit the changes to the niche branch (the current branch). Stage only the files you modified — do not use `git add -A` or `git add .`:

```bash
git add <file1> <file2> <test-file> ...
git commit -m "peer-review: fix bugs, add regression tests, and apply low-risk improvements from <NICHE_BRANCH> review"
```

If no tests were added, drop "add regression tests" from the commit message. If there is nothing to implement (no bugs, no Category B items), skip this step.

---

## Step 6: Run tests

Determine which packages were modified based on:
1. Files changed by Step 5 (committed to the niche branch)
2. Files cherry-picked to `general` in Step 2d

For (1): run tests on the niche branch (current branch) for each affected package.

For (2): if the cherry-picks touched a backend service, run that service's tests against `general`. Switch branches, run, switch back:

```bash
ORIGINAL_BRANCH=$(git branch --show-current)
git checkout general
npm run pr:test:unit:<service-short-name> 2>&1
npm run pr:test:integration:<service-short-name> 2>&1
git checkout $ORIGINAL_BRANCH
```

Available wrappers: `pr:test:unit:gateway`, `pr:test:unit:users`, `pr:test:unit:maps`, `pr:test:unit:messages`, `pr:test:unit:reactions`, `pr:test:unit:push`, `pr:test:unit:websocket`, plus the `pr:test:integration:*` equivalents.

### Test failure handling

For each failing test:
1. Read the test file to understand what it validates.
2. Determine if the failure is caused by a change in the diff (expected to need updating) or pre-existing.
3. Fix the test or the implementation as appropriate, on the **branch where the change lives** (general for cherry-picks, niche for everything else).
4. Re-run to confirm.

If a failure cannot be resolved without a large refactor or domain knowledge you don't have, report it clearly and stop trying.

---

## Step 7: Quality check

Run linting and type-checking on:
1. Files you modified in Step 5 (on the niche branch)
2. Files cherry-picked to `general` in Step 2d (on `general`)

### Rebuild shared libraries first (when applicable)

Dependent packages consume the **compiled `lib/`** output of `therr-react` and `therr-js-utilities`, not the TypeScript sources. If those libraries were touched by the cherry-picks in Step 2d, rebuild them on `general` before running per-package `tsc`:

```bash
git checkout general
npm run pr:build:js-utils 2>&1     # if therr-js-utilities was touched
npm run pr:build:therr-react 2>&1  # if therr-react was touched
```

Build `therr-js-utilities` first when both changed — `therr-react` consumes it.

### Lint and type-check

For each affected package:
```bash
npx eslint <file1> <file2> ... --fix --no-error-on-unmatched-pattern 2>&1
npm run pr:typecheck:<pkg-short-name> 2>&1
```

Available typecheck wrappers: `pr:typecheck:gateway`, `pr:typecheck:users`, `pr:typecheck:maps`, `pr:typecheck:messages`, `pr:typecheck:reactions`, `pr:typecheck:push`, `pr:typecheck:websocket`, `pr:typecheck:js-utils`, `pr:typecheck:therr-react`, `pr:typecheck:web`, `pr:typecheck:dashboard`, `pr:typecheck:mobile`.

Switch back to the niche branch when finished:
```bash
git checkout $ORIGINAL_BRANCH
```

Do not consider the review complete until both ESLint and tsc pass with zero errors on all in-scope files.

---

## Step 8: Persist manual post-deploy steps to the WIP tracker

Before printing the final report, identify any **manual steps the user must
take after this review** — items code alone cannot complete.

Examples specific to niche peer reviews:

- Pushing `general` (after reviewing cherry-picked backend commits)
- Committing uncommitted backend changes left in `general`'s working tree
- Manually splitting mixed commits identified in Step 2
- Running migrations introduced by cherry-picked commits on `general` →
  `stage` → `main` after each merge step
- Verifying that brand-isolation flips (shadow → enforce) have a clean
  7-day production window before they ride the next deploy
- Re-submitting sitemap to Google Search Console if SSR routes changed
- Re-warming AWS SES sender reputation if outreach copy changed

For each item, append a checkbox line to `docs/WORK_IN_PROGRESS.md` inside
the marked region:

```
<!-- skill-followups:start -->
- [ ] (YYYY-MM-DD, /quality-peer-review-niche) <action> — <why>
<!-- skill-followups:end -->
```

Implementation: read the file on the `general` worktree (the file lives
there, not on the niche branch — niche branches don't deploy). Locate the
`<!-- skill-followups:start -->` marker and insert new lines immediately
before `<!-- skill-followups:end -->`. Do **not** duplicate items already
present (match on the action text). If no manual steps are required, skip
this step entirely.

Because this skill operates across two branches (niche + general), append
to the WIP file on **whichever branch you're committing to next**:

- If new cherry-picked commits exist on `general`, append to
  `docs/WORK_IN_PROGRESS.md` on `general` and amend the most recent
  cherry-pick (or create a separate "follow-ups" commit on general).
- If only niche-side changes were made, do **not** edit
  `docs/WORK_IN_PROGRESS.md` from the niche branch — the file is owned by
  general and a niche-side edit would be dead code per the deployment
  rules. Instead, append the lines to a small temporary file
  (`/tmp/wip-followups.md`) and surface the items in the final report so
  the user can land them on `general` themselves. Mention this clearly.

If `docs/WORK_IN_PROGRESS.md` does not exist on `general`, skip silently
and surface the items only in the final report.

---

## Step 9: Final report

Output a structured summary:

```
## Peer Review Summary: <NICHE_BRANCH> → general

### Diff Scope
  Review base:                       <REVIEW_BASE>
  Commits ahead of <REVIEW_BASE>:    <N>  (review scope)
  Commits ahead of origin/general:   <N>  (full niche divergence — informational)
  Behind origin/general by:          <N> commits  (consider merging general → niche)
  Behind parent niche by:            <N> commits  (consider merging parent → branch)  [feature branches only]
  Niche packages affected:           <list>
  Unstaged/staged local changes:     <yes/no>

### Backend / Shared-Library Leaks
  Actionable (introduced in review scope):
    Cherry-picked to general (clean commits):
      - <sha> "msg" — <files>
      - ...
    Uncommitted leaks moved to general working tree (review and commit manually):
      - <files>
    Mixed commits requiring manual split:
      - <sha> "msg" — backend: <files>, niche: <files>
  Pre-existing on parent niche line (informational):
    - <files>
  <Or: "✓ No backend / shared-library leaks detected.">

### Backwards Compatibility
  <"✓ No breaking risks found" or list of risks with resolutions>

### Changes Made (on <NICHE_BRANCH>)
  Bugs fixed:
    - <description> in <file:line>
  Improvements applied:
    - <description> in <file:line>
  Regression tests added:
    - <test name> in <test file> — covers <bugfix>
    - <or: "None — no bugfixes warranted a new test">
  Regression tests skipped (with reason):
    - <bugfix> — <one-line reason>
  Tests fixed:
    - <description>

### Quality Check
  <"✓ Passed — 0 lint errors, 0 type errors" or list of remaining issues>

### Manual Steps Required After This Review
  - Push general (after reviewing cherry-picked commits):
      git checkout general && git push origin general
  - Commit any uncommitted backend changes left on general's working tree
  - Manually split mixed commits (see procedure above)
  - Database migrations (run on general / stage / main as appropriate)
  - <other steps>
  <Or: "None identified.">

  Note: items in this section have also been appended to
  `docs/WORK_IN_PROGRESS.md` on `general` under "Skill-generated items"
  (between the `<!-- skill-followups:start -->` markers) so they survive
  across sessions and are visible to coding agents at session start.
  See Step 8 for the cross-branch behavior.

### Suggestions (Not Implemented)
  <Category C items — including any "this looks shared, should it be on general?" candidates>

### Config Recommendations
  <Low-risk, high-reward configuration changes worth considering>
  <Or: "None identified.">
```

---

## Rules

- **Never push** — commits and cherry-picks stay local; the user decides when to push and merge.
- **Never rewrite niche branch history** — no `rebase`, no `commit --amend`, no `reset --hard`, no `cherry-pick` followed by removal. The niche branch is treated as if it has been pushed.
- **Cherry-picks to `general` are additive and safe** — duplicates left on the niche branch will be subsumed when `general` is later merged into niche.
- **Mixed commits are reported only** — never auto-split them.
- **Never run destructive git commands** without explicit user confirmation.
- **Never skip the infrastructure check** — if Step 0 fails, stop completely.
- **Scope niche-side changes to the diff** — do not refactor code that wasn't touched.
- **Do not implement Category C suggestions** — report them only.
- **If a niche-side fix would require changing a must-be-on-general path**, do not make the change here — report it as a Category C item directing the user to make the fix on `general`.
- When in doubt about whether a change is safe, skip it and add it to the Suggestions section instead.
