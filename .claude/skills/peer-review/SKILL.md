---
name: peer-review
description: Peer review the diff between general and stage branches. Implements low-risk improvements, fixes bugs, resolves quality issues, and notes deployment steps. Requires local Docker Compose infrastructure to be running.
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
   Then re-run /peer-review once services are healthy.
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
   
   Wait for containers to be healthy, then re-run /peer-review.
```
Stop immediately. Do not proceed.

**If both postgres and redis are up**, print a brief confirmation:

```
✓ Infrastructure check passed
  therr-postgres-dev  Up (healthy)
  therr-redis-dev     Up (healthy)
```

---

## Step 1: Check local state and fetch branches

Before fetching, check for uncommitted local changes:

```bash
git status --short 2>&1
```

If there are uncommitted changes, note them in the final report — they are **not** part of the `general→stage` diff and won't be reviewed. Do not stash or discard them; just be aware they exist.

Fetch the latest `general` and `stage` branches from origin:

```bash
git fetch origin general stage 2>&1
```

If either branch doesn't exist on origin, report it and stop:
```
⛔ Cannot diff: branch 'general' (or 'stage') not found on origin.
   These are required reference branches for peer review.
```

Get the diff of commits in `general` that are not yet in `stage`:

```bash
git log --oneline origin/stage..origin/general 2>&1
```

Also get the full file diff:

```bash
git diff origin/stage...origin/general --stat 2>&1
git diff origin/stage...origin/general 2>&1
```

If the diff is empty (branches are identical):
```
ℹ No diff found between general and stage — branches are identical.
  Nothing to review.
```
Stop.

Summarize the diff scope:
- Number of commits
- Files changed, insertions, deletions
- Which packages are affected (therr-services/*, therr-public-library/*, TherrMobile/*, therr-client-web/*, etc.)

---

## Step 2: Backwards compatibility analysis

Before looking for improvements, scan for anything that could break the **currently deployed mobile app**. Mobile apps cannot be force-updated — any API or schema changes must be backwards compatible.

Flag any of the following as **breaking risk**:

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

After all edits, commit the changes to the **current working branch** (not to `general` or `stage`). Stage only the files you modified — do not use `git add -A` or `git add .`:

```bash
git add <file1> <file2> ...
git commit -m "peer-review: fix bugs and low-risk improvements from general→stage diff"
```

If there is nothing to implement (no bugs, no Category B items), skip this step and note it.

---

## Step 5: Run tests

Determine which services were modified based on the diff. For each affected service package:

### Unit tests (always run)

Run from the repo root using subshells so the working directory is not changed:

```bash
(cd therr-services/users-service && npm run test:unit) 2>&1
(cd therr-services/maps-service && npm run test:unit) 2>&1
# ... etc for each affected service
```

### Integration tests

Since Step 0 already confirmed postgres and redis are healthy, run integration tests for each affected service. Service integration tests connect directly to the database — they do not require other service containers to be running.

```bash
(cd therr-services/<service-name> && npm run test:integration) 2>&1
```

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

Get the list of changed files from the diff:

```bash
git diff --name-only origin/stage...origin/general 2>&1
```

Add any files you modified in Step 4 that aren't already in that list.

For each affected package, run in parallel:

```bash
npx eslint <file1> <file2> ... --fix --no-error-on-unmatched-pattern 2>&1
npx tsc --noEmit -p <package>/tsconfig.json 2>&1
```

Follow the same package-to-tsconfig mapping as the `/quality-check` skill. Fix any remaining lint errors. If TypeScript errors remain after attempting a fix, report them explicitly rather than leaving them unresolved.

Do not consider the review complete until both ESLint and tsc pass with zero errors on all files in scope.

---

## Step 7: Final report

Output a structured summary:

```
## Peer Review Summary: general → stage

### Diff Scope
  Commits reviewed: <N>
  Packages affected: <list>
  Uncommitted local changes: <"None" or list of files — these were not reviewed>

### Backwards Compatibility
  <"✓ No breaking risks found" or list of risks with resolutions>

### Changes Made
  Bugs fixed:
    - <description> in <file:line>
  Improvements applied:
    - <description> in <file:line>
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

- **Never push** to `general`, `stage`, or `main` — all commits go to the current working branch.
- **Never run destructive git commands** (`reset --hard`, `checkout .`, `clean -f`) without explicit user confirmation.
- **Never modify TherrMobile** unless the diff explicitly touches it — mobile changes require extra care for backwards compatibility.
- **Never skip the infrastructure check** — if Step 0 fails, stop completely and tell the user how to fix it.
- **Scope changes to the diff** — do not refactor code that wasn't touched in the `general→stage` diff.
- **Do not implement Category C suggestions** — report them only.
- When in doubt about whether a change is safe, skip it and add it to the Suggestions section instead.
