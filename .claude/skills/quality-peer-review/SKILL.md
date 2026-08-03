---
name: quality-peer-review
description: Peer review the diff between general and stage branches. Implements low-risk improvements, fixes bugs, adds regression tests for bugfixes where valuable, resolves quality issues, and notes deployment steps. Runs local integration tests when the diff touches backend services (requires Docker Compose infrastructure for that case only).
user-invocable: true
allowed-tools: Bash(docker*), Bash(git*), Bash(npx*), Bash(npm*), Bash(node*), Bash(./_bin/*), Read, Glob, Grep, Edit, Write, Agent
argument-hint: [--dry-run]
---

# Peer Review: general → stage

Perform a structured peer review of the diff between the `general` and `stage` branches — the last checkpoint before code enters the CI build phase. This skill is intended to run **locally**. It will not run automatically — you must invoke it explicitly.

**`--dry-run`**: Analyze and report findings without making any code changes, writing any file, or committing. Read-only tools (lint, tsc, tests) still run.

---

## Step 0: Establish branch and diff scope

Do this **before** any infrastructure or test work — the scope determines what the rest of the review needs to run at all.

### 0a: Confirm current branch

```bash
git branch --show-current 2>&1
```

#### 0a-i: Hard-fail if on a niche branch with backend/shared-library changes

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
- Root-level `package.json`, `package-lock.json`, `docker-compose*.yml`, `_bin/**`, `eslint-config/**`

If **any** path matches, STOP with a hard failure. Do not continue to Step 0b or any later step:

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

#### 0a-ii: Warn if on any other non-general, non-niche branch

If the current branch is neither `general` nor `niche/*` (e.g. a feature branch, `stage`, `main`), warn the user:
```
⚠ You are on '<branch>', not 'general'.
  /quality-peer-review is designed to run on the local general branch.
  Switch to general first, or confirm this is intentional.
```
Stop and ask the user to confirm before proceeding.

### 0b: Pull origin/general (with autostash)

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

### 0c: Fetch origin/stage for comparison

```bash
git fetch origin stage 2>&1
```

If `stage` doesn't exist on origin, report it and stop:
```
⛔ Cannot diff: branch 'stage' not found on origin.
```

### 0d: Build the diff scope

The review covers **all local changes** — committed and uncommitted — compared to `origin/stage`. This includes everything that would be new on `stage` after a merge of the local working tree.

Get the committed log and the changed-file list:
```bash
git log --oneline origin/stage..HEAD 2>&1
git diff --name-only origin/stage 2>&1
git status --short 2>&1
```

### 0e: Read the diff within a budget

A `general→stage` diff can be tens of thousands of lines. Reading it whole wastes the context you need for the actual review, and generated files carry no review signal. **Always exclude generated and binary paths**, and always look at `--stat` before requesting content:

```bash
git diff origin/stage --stat -- . \
  ':(exclude)**/package-lock.json' \
  ':(exclude)**/lib/**' \
  ':(exclude)**/*.png' ':(exclude)**/*.jpg' ':(exclude)**/*.jpeg' ':(exclude)**/*.gif' \
  ':(exclude)**/*.svg' ':(exclude)**/*.jsbundle' ':(exclude)**/*.aab' ':(exclude)**/*.apk' \
  2>&1
```

Then:

- **Under ~2,000 changed lines**: read the full filtered diff in one call (same pathspec, without `--stat`).
- **Over ~2,000 changed lines**: do not read it in one call. Review **package by package**, highest-risk first — `therr-services/**` and `therr-api-gateway/**`, then `therr-public-library/**`, then clients. Scope each read with a path argument, e.g. `git diff origin/stage -- therr-services/users-service`.
- Lockfile and compiled `lib/` changes still matter for *scope* (they tell you a dependency or shared library moved) but are never read line by line. Note them from `--stat` only.

If there is no diff at all (working tree is identical to origin/stage and no uncommitted changes):
```
ℹ No changes found between local general and origin/stage.
  Nothing to review.
```
Stop.

### 0f: Classify the scope

Record and report:
- Number of commits ahead of origin/stage
- Files changed, insertions, deletions (from `--stat`)
- Whether there are unstaged or staged-but-uncommitted changes included
- **Affected package set**, which drives every later step:

| Scope flag | True when the diff touches | Drives |
|---|---|---|
| `BACKEND` | `therr-services/**`, `therr-api-gateway/**` | Step 1 infra check, integration tests |
| `SHARED_LIB` | `therr-public-library/**` | Shared-lib rebuild before typecheck |
| `MIGRATIONS` | `**/migrations/**`, `**/*.sql` | Cross-repo coupling check, deploy steps |
| `MOBILE` | `TherrMobile/**` | Baseline typecheck (not zero-error tsc) |
| `WEB` | `therr-client-web/**`, `therr-client-web-dashboard/**` | Web tests + typecheck |
| `LOCALES` | `**/locales/**` | `npm run locales:check` |
| `LINT_RULES` | `eslint-config/**` | `npm run test:lint-rules` |
| `MIRRORED` | any file listed in `scripts/mirrored-files/mirror-targets.json` | `npm run mirrors:check` |

---

## Step 1: Infrastructure check (only when `BACKEND` is in scope)

Integration tests connect directly to postgres and redis. **If `BACKEND` is not in scope, skip this step entirely** — a mobile-only, web-only, or docs-only review does not need Docker, and blocking on it wastes the user's time.

When `BACKEND` is in scope:

```bash
docker ps --format "{{.Names}}\t{{.Status}}" 2>&1
```

Parse the output:
- Look for `therr-postgres-dev` with a `healthy` or `Up` status.
- Look for `therr-redis-dev` with a `healthy` or `Up` status.

**If Docker is not running at all** (command fails or returns nothing):
```
⛔ Infrastructure check failed: Docker is not running.
   This diff touches backend services, so integration tests need the local
   Docker Compose dev environment.
   Start it with: npm run docker:dev:up
   Then re-run /quality-peer-review once services are healthy.
```
Stop immediately. Do not proceed.

**If Docker is running but postgres or redis containers are missing/unhealthy**:
```
⛔ Infrastructure check failed: Required containers are not running or healthy.
   Missing or unhealthy:
     - therr-postgres-dev  ← <status or "not found">
     - therr-redis-dev     ← <status or "not found">

   Start infrastructure with: npm run docker:dev:up
   Or for infra-only:         npm run docker:infra:up

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

## Step 2: Compatibility analysis

Before looking for improvements, scan for anything that could break a consumer this repo cannot deploy in lockstep with itself. There are two such consumers, and both have caused production incidents.

### 2a: Deployed mobile clients

Mobile apps cannot be force-updated — an install from six months ago still calls the API. Flag any of the following as **breaking risk**:

Scope the scan with `git diff origin/stage -- therr-api-gateway/src/ therr-public-library/ therr-services/`.

1. **Removed or renamed API endpoints**: check `therr-api-gateway/src/` for route deletions or path changes.
2. **Changed response shape**: handlers that now return fewer fields, renamed fields, or changed types.
3. **New required request fields**: body/query params that were previously optional.
4. **Database schema changes without migration fallback**: new NOT NULL columns without defaults, dropped columns.
5. **Removed Redux actions or reducers** in `therr-public-library/therr-react/` that the mobile app may depend on.
6. **Breaking changes to shared constants/enums** in `therr-js-utilities` (renaming or removing values in use).

### 2b: Sibling repos that read this database directly

Only run this sub-step when `MIGRATIONS` or `BACKEND` is in scope. `therr-ai-automator` and `therr-messaging-automator` are separate repositories that query this database with Knex, bypassing the gateway. **No CI in any repo checks this coupling**, and a rename here deploys green then breaks a Cloud Function hours later at its next scheduler firing, with no alert.

From the diff, extract every table or column identifier that is **renamed, dropped, or made NOT NULL**. For each one, report it under a distinct heading — these are not merely suggestions:

```
⚠ Cross-repo coupling risk (no CI covers this):
  Change: main.userAchievements."progressCount" renamed to "progress"
  Migration: therr-services/users-service/src/store/migrations/2026...js
  Action: this is a contract shared with therr-ai-automator and
          therr-messaging-automator. Grep both repos' src/store/ for the old
          identifier before this reaches stage. Use expand/contract — add the new
          column, backfill, and keep the old one readable until both automators
          have deployed against the new name.
```

Two further checks in this sub-step:

- **Brand-scoped tables.** If the diff adds a table to `eslint-config/brand-scoped-tables.js`, the `therr/no-direct-brand-scoped-table` rule cannot see other repositories. Flag that the entry must also be mirrored into `therr-messaging-automator`'s `src/store/brandScoped.ts`.
- **Date arithmetic on `main.thoughts`.** `ai-automator` writes rows dated up to ~30h in the future. Any new SQL computing `NOW() - "createdAt"` must tolerate a negative result — flag unclamped `POWER()`/`LOG()` over that expression as a bug, not a suggestion. This exact pattern caused an 8-day feed outage.

For each risk found in 2a or 2b, report file, issue, and recommendation. If no risks are found in a sub-step, note that explicitly.

---

## Step 3: Identify low-risk, high-reward improvements

Review the diff and classify findings into these categories. Only flag genuine issues — do not invent problems.

### Category A: Bugs
- Logic errors, off-by-one issues, incorrect conditionals
- Missing null/undefined checks at system boundaries (user input, external API responses)
- Incorrect error handling (swallowing errors, wrong HTTP status codes)
- Race conditions or missing async/await
- Migrations that are not safe to re-run, or that pass an `async` callback to a Knex table builder (both are lint-enforced — a hit here means the rule was disabled or the file predates the cutoff)

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

## Step 4: Implement improvements (skip entirely if `--dry-run`)

For each **Category B** improvement and **Category A** bug fix:

1. Read the affected file before editing.
2. Apply the change using Edit.
3. Keep each change minimal — fix exactly what was identified, nothing more.
4. Ensure changes remain backwards compatible (per Step 2 criteria).

**Do not commit yet.** Committing happens once, in Step 7, after tests and quality checks have passed. This avoids amend churn and keeps a failed verification from leaving a broken commit behind.

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
   - Mobile: `TherrMobile/__tests__/**` (Jest `testRegex` only picks up files under that directory — a co-located `*.test.tsx` will never run)
2. **Prefer unit tests over integration tests** when the bug can be exercised at the function or handler level with existing mocks. Only reach for integration tests when the bug involves real DB/Redis behavior that isn't captured by the unit layer.
3. **If no test file exists** for the module and the module is reasonably testable (pure function, handler with mockable deps), create a minimal new test file matching the package's conventions. Do not introduce a new test framework or runner.
4. **Write a focused test** that would have failed against the pre-fix code and passes against the post-fix code. If practical, mentally (or literally) revert the fix to confirm the test fails for the right reason.
5. **Name the test by the observable symptom**, not the implementation detail — e.g. `"returns empty array when user has no connections"` rather than `"calls filter with isActive flag"`.
6. **Run the new test(s) in isolation** to confirm they pass, re-using the `pr:test:*` wrappers from Step 5:
   ```bash
   npm run pr:test:unit:<short-name> -- --testPathPattern=<new-or-edited-test-file> 2>&1
   ```

If a bugfix genuinely cannot be covered without disproportionate effort or domain knowledge you don't have, **do not fabricate a test**. Record it in the final report under "Regression Tests" with a one-line reason so the user can decide whether to add coverage manually.

---

## Step 5: Run tests

Run tests for every package in the Step 0f scope, not just backend ones. All wrappers run from the repo root (they exist to avoid subshell-with-cd patterns that trigger permission prompts).

### Unit tests

| Scope | Wrapper |
|---|---|
| gateway | `npm run pr:test:unit:gateway` |
| users / maps / messages / reactions / push / websocket | `npm run pr:test:unit:<name>` |
| `therr-js-utilities` | `npm run pr:test:unit:js-utils` |
| `therr-react` | `npm run pr:test:unit:therr-react` |
| `therr-client-web` | `npm run pr:test:unit:web` |
| `therr-client-web-dashboard` | `npm run pr:test:unit:dashboard` |
| `TherrMobile` | `npm run pr:test:unit:mobile` |

Run the wrappers for affected packages in parallel (separate Bash calls in one message).

### Integration tests (only when `BACKEND` is in scope)

Step 1 already confirmed postgres and redis are healthy. Service integration tests connect directly to the database — they do not require other service containers.

```bash
npm run pr:test:integration:<service-short-name> 2>&1
```

Available: `pr:test:integration:gateway`, `pr:test:integration:users`, `pr:test:integration:maps`, `pr:test:integration:messages`, `pr:test:integration:reactions`, `pr:test:integration:push`, `pr:test:integration:websocket`.

### Repo-wide gates

CI runs these regardless of package, and each one has caught a real class of defect. Run the ones the scope calls for:

```bash
npm run locales:check     2>&1   # if LOCALES in scope (or any user-facing string was added)
npm run mirrors:check     2>&1   # if MIRRORED in scope
npm run test:lint-rules   2>&1   # if LINT_RULES in scope, or any file under **/migrations/** changed
```

`test:lint-rules` also fails if `MIGRATION_IDEMPOTENCY_CUTOFF` was moved forward or a brand-scoped table entry lost its `*Store.ts` — treat either failure as a Category A finding, not a flaky test.

### Test failure handling

For each failing test:
1. Read the test file to understand what it validates.
2. Determine if the failure is caused by a change in the diff (expected to need updating) or a pre-existing issue. Confirm the latter by checking out nothing — instead run the same wrapper with `git stash` **only if the user approves**; otherwise reason from the diff.
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

Lint and type-check the files in the `general→stage` diff plus anything edited in Step 4 — these are the files that will enter `stage`.

```bash
git diff --name-only origin/stage 2>&1
```

Add files you modified in Step 4 that aren't already listed, and check `git status --short` for staged-but-uncommitted files.

### Rebuild shared libraries first (only when `SHARED_LIB` is in scope)

Dependent packages consume the **compiled `lib/`** output of `therr-react` and `therr-js-utilities`, not the TypeScript sources. Stale `lib/` produces downstream `tsc` errors that look like real bugs (e.g. "Property X is missing on type Y" when the prop was just added).

```bash
npm run pr:build:shared-libs 2>&1
```

That wrapper builds `therr-js-utilities` then `therr-react` in the correct order. If only one changed, `pr:build:js-utils` / `pr:build:therr-react` are available individually.

### Lint

```bash
npx eslint <file1> <file2> ... --fix --no-error-on-unmatched-pattern 2>&1
```

Group files by package and pass each package's files in a single invocation. Omit `--fix` when `--dry-run`.

### Type-check

| Package | Wrapper |
|---|---|
| gateway, users, maps, messages, reactions, push, websocket | `npm run pr:typecheck:<name>` |
| `therr-js-utilities` | `npm run pr:typecheck:js-utils` |
| `therr-react` | `npm run pr:typecheck:therr-react` |
| `therr-client-web` | `npm run pr:typecheck:web` |
| `therr-client-web-dashboard` | `npm run pr:typecheck:dashboard` |
| **`TherrMobile`** | **`npm run pr:tsc-baseline:mobile`** |

**Mobile is a baseline gate, not a zero-error gate.** TherrMobile carries ~104 pre-existing errors inherited from the RN 0.83 upgrade, so `pr:typecheck:mobile` will always report errors and is *not* the pass/fail signal. `pr:tsc-baseline:mobile` compares error *identities* against `TherrMobile/.tsc-baseline` and fails only on signatures not already recorded there. Treat a new signature as a Category A finding and fix it. **Never** run `./_bin/check-mobile-tsc-baseline.sh --update` to make the check pass — that erases the gate. Only regenerate the baseline when pre-existing errors were deliberately *fixed*, and say so in the report.

Every other package must reach zero errors. If TypeScript errors remain after attempting a fix, report them explicitly rather than leaving them unresolved.

---

## Step 7: Record follow-ups and commit (skip entirely if `--dry-run`)

### 7a: Persist manual post-deploy steps

Identify any **manual steps the user must take after deploying** — items code alone cannot complete:

- Database migrations to run on production (`npm run migrations:run`)
- Cache invalidation (Cloudflare, CDN, redis flush)
- Environment variable additions / rotations
- Third-party config changes (Stripe webhook URL, FCM credentials, OAuth callback URLs)
- Sitemap / Search Console re-submission after SSR route changes
- One-off backfill scripts that must run once after deploy
- **Sibling-repo deploys** — any expand/contract contract change from Step 2b that needs `therr-ai-automator` or `therr-messaging-automator` updated before the contract phase

For each item, append a checkbox line to `docs/WORK_IN_PROGRESS.md` immediately before the `<!-- skill-followups:end -->` marker:

```
- [ ] (YYYY-MM-DD, /quality-peer-review) <action> — <why / which commit introduced the requirement>
```

Read the file first, match on action text to avoid duplicating an item already present, and skip the step entirely when there are no manual steps — do not append a "None" line. If `docs/WORK_IN_PROGRESS.md` does not exist, skip silently and surface the items only in the final report.

Also delete the bullet for any WIP TODO this diff resolved, per the CLAUDE.md rule that a fixed TODO loses its bullet in the same commit.

### 7b: Commit once

Stage only files you actually modified — never `git add -A` or `git add .`:

```bash
git add <file1> <file2> <test-file> docs/WORK_IN_PROGRESS.md
git commit -m "peer-review: fix bugs, add regression tests, and apply low-risk improvements from general→stage diff"
```

Drop clauses from the message that don't apply (no tests added, no bugs fixed). Before committing, run `git diff --cached --name-only` and confirm every path belongs on `general` — the commit-separation rule in CLAUDE.md applies to this skill's own commits too. If nothing was implemented, skip the commit and note it.

---

## Step 8: Final report

```
## Peer Review Summary: general → stage

### Diff Scope
  Commits ahead of origin/stage: <N>
  Packages affected: <list>
  Scope flags: <BACKEND, SHARED_LIB, MIGRATIONS, MOBILE, WEB, ...>
  Unstaged/staged local changes included: <yes/no>

### Compatibility
  Deployed mobile clients: <"✓ No breaking risks found" or list with resolutions>
  Sibling repos (ai-automator / messaging-automator): <"✓ No coupled identifiers
    changed" / "n/a — no backend or migration changes" or list of contract risks>

### Changes Made
  Bugs fixed:
    - <description> in <file:line>
  Improvements applied:
    - <description> in <file:line>
  Regression tests added:
    - <test name> in <test file> — covers <bugfix description>
    - <or: "None — no bugfixes warranted a new test (see reasons below)">
  Regression tests skipped (with reason):
    - <bugfix description> — <one-line reason>
  Tests fixed:
    - <description>

### Verification
  Unit tests:        <packages run — pass/fail>
  Integration tests: <packages run — pass/fail, or "skipped — no backend changes">
  Repo-wide gates:   <locales / mirrors / lint-rules — pass/fail/skipped>
  Lint:              <"✓ 0 errors" or remaining issues>
  Type-check:        <"✓ 0 errors" per package; for mobile, "✓ no new baseline
                      signatures" or the new signatures found>

### Manual Steps Required After Deploying
  <List, or "None identified.">

  Note: items here are also appended to docs/WORK_IN_PROGRESS.md between the
  <!-- skill-followups:start --> … <!-- skill-followups:end --> markers.

### Suggestions (Not Implemented)
  <Category C items>

### Config Recommendations
  <Low-risk, high-reward config changes: CLAUDE.md additions, hook or skill
   improvements, Docker Compose tuning, TS strictness, new ESLint rules, CI
   changes. Or: "None identified.">
```

---

## Rules

- **Never push** — commit to the local `general` branch only; the user decides when to push and merge to `stage`.
- **Never run destructive git commands** (`reset --hard`, `checkout .`, `clean -f`) without explicit user confirmation.
- **Never modify TherrMobile** unless the diff explicitly touches it — mobile changes require extra care for backwards compatibility.
- **Never update the mobile tsc baseline to make a check pass.**
- **Never skip the infrastructure check when `BACKEND` is in scope** — but never demand it when it isn't.
- **Scope changes to the diff** — do not refactor code that wasn't touched in the `general→stage` diff.
- **Do not implement Category C suggestions** — report them only.
- **`--dry-run` means no writes of any kind** — no edits, no `docs/WORK_IN_PROGRESS.md` append, no commit, no `--fix` on ESLint.
- When in doubt about whether a change is safe, skip it and add it to the Suggestions section instead.
