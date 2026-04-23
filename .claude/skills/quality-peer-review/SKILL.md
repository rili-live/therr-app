---
name: quality-peer-review
description: Peer review the diff between general and stage branches. Implements low-risk improvements, fixes bugs, adds regression tests for bugfixes where valuable, resolves quality issues, and notes deployment steps. Requires local Docker Compose infrastructure to be running.
user-invocable: true
allowed-tools: Bash(docker*), Bash(git*), Bash(npx*), Bash(npm*), Bash(node*), Read, Glob, Grep, Edit, Write, Agent
argument-hint: [--dry-run]
---

# Peer Review: general → stage

Perform a structured peer review of the diff between the `general` and `stage` branches. This skill is intended to run **locally** with Docker Compose infrastructure active. It will not run automatically — you must invoke it explicitly.

**`--dry-run`**: Analyze and report findings without making any code changes or running tests.

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
   Then re-run /quality-peer-review once services are healthy.
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
   
   Wait for containers to be healthy, then re-run /quality-peer-review.
```
Stop immediately. Do not proceed.

**If both postgres and redis are up**, print a brief confirmation:

```
✓ Infrastructure check passed
  therr-postgres-dev  Up (healthy)
  therr-redis-dev     Up (healthy)
```

---

## Step 1: Sync local general branch and establish diff scope

### 1a: Confirm current branch

```bash
git branch --show-current 2>&1
```

#### 1a-i: Hard-fail if on a niche branch with backend/shared-library changes

If the current branch matches `niche/*`, this review cannot proceed in its normal form. `niche/*` branches never deploy to production (no CI path to `main`), and the critical purpose of this review is validating deployable changes. Before failing, check whether the branch contains changes that **must** live on `general` to ever reach production.

Inspect the diff paths vs `origin/general` (committed, staged, and unstaged):

```bash
git fetch origin general 2>&1
git diff origin/general --name-only 2>&1
git status --short 2>&1
```

Union the file lists. Consider the review **blocked** if any path matches any of:

- `therr-services/**`
- `therr-api-gateway/**`
- `therr-public-library/**` (i.e. `therr-js-utilities`, `therr-react`, `therr-styles`)
- `**/migrations/**`
- `**/db/migrations/**`
- `**/*.sql`
- Root-level `package.json`, `package-lock.json`, `docker-compose*.yml`, `_bin/**`

If **any** path matches, STOP with a hard failure. Do not continue to Step 1b or any later step:

```
⛔ Backend change on niche branch — will not deploy.

   You are on '<branch>', which has no CI path to production.
   The following files must live on 'general' (which flows general → stage → main)
   to ever ship, but they are currently only on this niche branch:

     <list of offending paths, one per line>

   /quality-peer-review cannot proceed here. Use the split-commit workflow:

     1. Switch to general:        git checkout general
     2. Pull latest:              git pull origin general
     3. Cherry-pick clean backend commits, OR apply backend changes as new commits on general.
        (If the offending work is mixed with niche UI in the same commit, split it first —
         see /quality-peer-review-niche, which detects and remediates this automatically.)
     4. Commit backend work on general, then:
          git checkout <niche-branch> && git merge general
     5. Continue any niche-only (TherrMobile/**, therr-client-web/**, brand assets) work
        as separate commits on the niche branch.

   For a guided remediation, run /quality-peer-review-niche on this branch —
   it will identify clean backend commits and cherry-pick them to general for you.
```

After printing the failure, exit the skill without running any tests, lint, or further diff analysis.

#### 1a-ii: Warn if on any other non-general, non-niche branch

If the current branch is neither `general` nor `niche/*` (e.g. a feature branch, `stage`, `main`), warn the user:
```
⚠ You are on '<branch>', not 'general'.
  /quality-peer-review is designed to run on the local general branch.
  Switch to general first, or confirm this is intentional.
```
Stop and ask the user to confirm before proceeding.

### 1b: Pull origin/general (with autostash)

Use `--autostash` so any uncommitted local changes are stashed before the pull and re-applied after, keeping them in scope for the review:

```bash
git pull --autostash origin general 2>&1
```

**If the pull results in merge conflicts** (output contains "CONFLICT" or exit code is non-zero):
```
⛔ Merge conflicts after pulling origin/general.
   Resolve the conflicts below before re-running /quality-peer-review:
   <list conflicting files from git status>
```
Stop immediately. Do not attempt to auto-resolve conflicts.

**If the autostash re-apply has conflicts** (output contains "CONFLICT" after "Applying stash"):
```
⛔ Stash re-apply conflicts after pulling origin/general.
   Your local changes could not be cleanly re-applied.
   Resolve stash conflicts manually, then re-run /quality-peer-review.
```
Stop immediately.

### 1c: Fetch origin/stage for comparison

```bash
git fetch origin stage 2>&1
```

If `stage` doesn't exist on origin, report it and stop:
```
⛔ Cannot diff: branch 'stage' not found on origin.
```

### 1d: Build the diff scope

The review covers **all local changes** — committed and uncommitted — compared to `origin/stage`. This includes everything that would be new on `stage` after a merge of the local working tree.

Get the committed log:
```bash
git log --oneline origin/stage..HEAD 2>&1
```

Get the full working-tree diff (committed + staged + unstaged tracked files):
```bash
git diff origin/stage --stat 2>&1
git diff origin/stage 2>&1
```

Also note any untracked files that may be relevant:
```bash
git status --short 2>&1
```

If there is no diff at all (working tree is identical to origin/stage and no uncommitted changes):
```
ℹ No changes found between local general and origin/stage.
  Nothing to review.
```
Stop.

Summarize the diff scope:
- Number of commits ahead of origin/stage
- Files changed, insertions, deletions (from `--stat`)
- Whether there are unstaged or staged-but-uncommitted changes included
- Which packages are affected (therr-services/*, therr-public-library/*, TherrMobile/*, therr-client-web/*, etc.)

---

## Step 2: Backwards compatibility analysis

Before looking for improvements, scan for anything that could break the **currently deployed mobile app**. Mobile apps cannot be force-updated — any API or schema changes must be backwards compatible.

Flag any of the following as **breaking risk**:

Use `git diff origin/stage -- therr-api-gateway/src/ therr-public-library/ therr-services/` to focus the backwards compat scan on the relevant paths.

1. **Removed or renamed API endpoints**: Check `therr-api-gateway/src/` for route deletions or path changes.
2. **Changed response shape**: Handler functions that now return fewer fields, renamed fields, or changed types.
3. **New required request fields**: Body/query params that are now required but previously optional.
4. **Database schema changes without migration fallback**: New NOT NULL columns without defaults, dropped columns.
5. **Removed Redux actions or reducers** in `therr-public-library/therr-react/` that the mobile app may depend on.
6. **Breaking changes to shared constants/enums** in `therr-js-utilities` (renaming or removing values in use).

For each risk found, report clearly:
```
⚠ Backwards compatibility risk:
  File: therr-api-gateway/src/routes/users.ts
  Issue: Route /v1/users/search removed — mobile app v2.x still calls this endpoint.
  Recommendation: Keep the old route as a deprecated alias, or confirm the deployed
                  mobile version no longer uses it before removing.
```

If no breaking risks are found, note that explicitly.

---

## Step 3: Identify low-risk, high-reward improvements

Review the diff and classify findings into these categories. Only flag genuine issues — do not invent problems.

### Category A: Bugs
- Logic errors, off-by-one issues, incorrect conditionals
- Missing null/undefined checks at system boundaries (user input, external API responses)
- Incorrect error handling (swallowing errors, wrong HTTP status codes)
- Race conditions or missing async/await

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
- Patterns that could be abstracted into shared utilities (per CLAUDE.md abstraction rules)
- Performance concerns (N+1 query patterns, missing indices — flag, don't change schema)
- Security observations (log sensitive data, missing input sanitization)
- Opportunities to improve error messages for developers

---

## Step 4: Implement improvements (skip if `--dry-run`)

For each **Category B** improvement and **Category A** bug fix:

1. Read the affected file before editing.
2. Apply the change using Edit.
3. Keep each change minimal — fix exactly what was identified, nothing more.
4. Ensure changes remain backwards compatible (per Step 2 criteria).

### Step 4a: Add regression tests for bugfixes

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

1. **Locate the existing test file** for the affected module. Follow the package's existing convention — check neighboring files:
   - Services: `therr-services/<service>/tests/unit/**` and `tests/integration/**`
   - Shared libs: `therr-public-library/<lib>/src/**/__tests__/**` or co-located `*.test.ts`
   - Web clients: co-located `*.test.tsx` next to the component
2. **Prefer unit tests over integration tests** when the bug can be exercised at the function or handler level with existing mocks. Only reach for integration tests when the bug involves real DB/Redis behavior that isn't captured by the unit layer.
3. **If no test file exists** for the module and the module is reasonably testable (pure function, handler with mockable deps), create a minimal new test file matching the package's conventions. Do not introduce a new test framework or runner.
4. **Write a focused test** that would have failed against the pre-fix code and passes against the post-fix code. If practical, mentally (or literally) revert the fix to confirm the test fails for the right reason before committing.
5. **Name the test by the observable symptom**, not the implementation detail — e.g. `"returns empty array when user has no connections"` rather than `"calls filter with isActive flag"`.
6. **Run the new test(s) in isolation** to confirm they pass:
   ```bash
   npm run pr:test:unit:<service-short-name> -- --testPathPattern=<new-or-edited-test-file> 2>&1
   ```
   (Or the package's equivalent — re-use the `pr:test:unit:*` and `pr:test:integration:*` wrappers from Step 5.)

If a bugfix genuinely cannot be covered without disproportionate effort or domain knowledge you don't have, **do not fabricate a test**. Record it in the final report under "Regression Tests" with a one-line reason so the user can decide whether to add coverage manually.

### Commit

After all edits and new/updated tests, commit the changes to `general` (the current branch). Stage only the files you modified — do not use `git add -A` or `git add .`:

```bash
git add <file1> <file2> <test-file> ...
git commit -m "peer-review: fix bugs, add regression tests, and apply low-risk improvements from general→stage diff"
```

If no tests were added, drop "add regression tests" from the commit message. If there is nothing to implement (no bugs, no Category B items), skip this step and note it.

---

## Step 5: Run tests

Determine which services were modified based on the diff. For each affected service package:

### Unit tests (always run)

Run from the repo root using the root-level wrapper scripts (these exist to avoid subshell-with-cd patterns that trigger permission prompts):

```bash
npm run pr:test:unit:users 2>&1
npm run pr:test:unit:maps 2>&1
# ... etc for each affected service
```

Available wrappers: `pr:test:unit:gateway`, `pr:test:unit:users`, `pr:test:unit:maps`, `pr:test:unit:messages`, `pr:test:unit:reactions`, `pr:test:unit:push`, `pr:test:unit:websocket`.

### Integration tests

Since Step 0 already confirmed postgres and redis are healthy, run integration tests for each affected service. Service integration tests connect directly to the database — they do not require other service containers to be running.

```bash
npm run pr:test:integration:<service-short-name> 2>&1
```

Available wrappers: `pr:test:integration:gateway`, `pr:test:integration:users`, `pr:test:integration:maps`, `pr:test:integration:messages`, `pr:test:integration:reactions`, `pr:test:integration:push`, `pr:test:integration:websocket`.

### Test failure handling

For each failing test:
1. Read the test file to understand what it validates.
2. Determine if the failure is caused by a change in the diff (expected to need updating) or a pre-existing issue.
3. Fix the test or the implementation as appropriate.
4. Re-run the test to confirm it passes.

If a test failure cannot be resolved without a large refactor or domain knowledge, report it clearly:
```
⚠ Test still failing after investigation:
  Service: therr-services/users-service
  Test: tests/unit/handlers-auth.test.ts — "should validate JWT expiry"
  Reason: Requires mocking a third-party service that isn't stubbed. Needs manual attention.
```

---

## Step 6: Quality check

Run linting and type-checking on the files in the `general→stage` diff plus any additional files edited in Step 4. These are the files that will enter `stage` when `general` is merged.

Get the list of changed files (working tree vs origin/stage):

```bash
git diff --name-only origin/stage 2>&1
```

Add any files you modified in Step 4 that aren't already in that list. Also check `git status --short` for staged-but-not-committed files that may not appear in the diff output.

### Rebuild shared libraries first

Dependent packages (`therr-client-web`, `therr-client-web-dashboard`, `TherrMobile`, every service) consume the **compiled `lib/`** output of `therr-react` and `therr-js-utilities`, not the TypeScript sources. If those libraries were modified in this diff but not rebuilt, downstream `tsc --noEmit` will fail with stale or missing type errors that look like real bugs (e.g. "Property X is missing on type Y" when the prop was just added).

Before running per-package `tsc`, check the diff for changes under either shared library and rebuild any that were touched using the root-level wrapper scripts:

```bash
# Run only the libraries that appear in the diff
npm run pr:build:js-utils 2>&1
npm run pr:build:therr-react 2>&1
```

Build `therr-js-utilities` first when both changed — `therr-react` consumes it.

If neither shared library was modified, skip this step.

### Lint and type-check

For each affected package, run in parallel. ESLint runs per-file; type-checking uses the root-level `pr:typecheck:*` wrapper scripts:

```bash
npx eslint <file1> <file2> ... --fix --no-error-on-unmatched-pattern 2>&1
npm run pr:typecheck:<pkg-short-name> 2>&1
```

Available typecheck wrappers: `pr:typecheck:gateway`, `pr:typecheck:users`, `pr:typecheck:maps`, `pr:typecheck:messages`, `pr:typecheck:reactions`, `pr:typecheck:push`, `pr:typecheck:websocket`, `pr:typecheck:js-utils`, `pr:typecheck:therr-react`, `pr:typecheck:web`, `pr:typecheck:dashboard`, `pr:typecheck:mobile`.

Follow the same package-to-tsconfig mapping as the `/quality-check` skill. Fix any remaining lint errors. If TypeScript errors remain after attempting a fix, report them explicitly rather than leaving them unresolved.

Do not consider the review complete until both ESLint and tsc pass with zero errors on all files in scope.

---

## Step 7: Final report

Output a structured summary:

```
## Peer Review Summary: general → stage

### Diff Scope
  Commits ahead of origin/stage: <N>
  Packages affected: <list>
  Unstaged/staged local changes included: <yes/no>

### Backwards Compatibility
  <"✓ No breaking risks found" or list of risks with resolutions>

### Changes Made
  Bugs fixed:
    - <description> in <file:line>
  Improvements applied:
    - <description> in <file:line>
  Regression tests added:
    - <test name> in <test file> — covers <bugfix description>
    - <or: "None — no bugfixes warranted a new test (see reasons below)">
  Regression tests skipped (with reason):
    - <bugfix description> — <one-line reason, e.g. "cosmetic log fix", "would require mocking X SDK">
  Tests fixed:
    - <description>

### Quality Check
  <"✓ Passed — 0 lint errors, 0 type errors" or list of remaining issues>

### Manual Steps Required After Deploying
  <List any steps that must be run manually after deploying to production, such as:>
  - Database migrations: `npm run migrations:run` in <service>
  - Cache invalidation required
  - Environment variable changes needed
  - Third-party configuration updates
  <Or: "None identified.">

### Suggestions (Not Implemented)
  <Category C items — optional improvements worth discussing:>
  - <description> in <file>

### Config Recommendations
  <Low-risk, high-reward configuration changes worth considering, such as:>
  - Claude settings (CLAUDE.md additions, hook improvements, skill enhancements)
  - Docker Compose tuning
  - TypeScript strictness settings
  - ESLint rule additions
  - CI/CD pipeline improvements
  <Or: "None identified.">
```

---

## Rules

- **Never push** — commit to the local `general` branch only; the user decides when to push and merge to `stage`.
- **Never run destructive git commands** (`reset --hard`, `checkout .`, `clean -f`) without explicit user confirmation.
- **Never modify TherrMobile** unless the diff explicitly touches it — mobile changes require extra care for backwards compatibility.
- **Never skip the infrastructure check** — if Step 0 fails, stop completely and tell the user how to fix it.
- **Scope changes to the diff** — do not refactor code that wasn't touched in the `general→stage` diff.
- **Do not implement Category C suggestions** — report them only.
- When in doubt about whether a change is safe, skip it and add it to the Suggestions section instead.
