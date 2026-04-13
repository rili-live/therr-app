---
name: branch-guard
description: Analyze the current git branch and changed files to catch shared code committed to niche branches (or vice versa), and help navigate the branch strategy safely.
user-invocable: true
allowed-tools: Bash(git branch*), Bash(git diff*), Bash(git status*), Bash(git stash*), Bash(git checkout*), Bash(git log*), Read, Glob
argument-hint: [check|explain|switch <TAG>]
---

# Branch Guard

Help navigate the therr-app branch strategy safely. The biggest risk in this monorepo is putting
shared code on a niche branch (other app variants won't get it) or niche-specific code on `general`
(it pollutes shared code for all variants).

## Branch Strategy Reference

| Branch | Purpose | Who inherits it |
|--------|---------|----------------|
| `general` | Shared backend, libraries, reusable components | All niche apps via merge |
| `niche/<TAG>-general` | App-specific: brand config, assets, navigation, bundle ID | Only that app variant |
| `stage` | CI build phase — merged from `general` | Production pipeline |
| `main` | Production deploy — merged from `stage` | Live users |
| `claude/*` or feature branches | In-progress work | Merged to appropriate branch above |

## Mode Selection

| Argument | Mode |
|----------|------|
| `check` or _(no argument)_ | Analyze current branch + changed files for misplacement risk |
| `explain` | Print branch strategy with current branch context |
| `switch <TAG>` | Safely switch to `niche/<TAG>-general` |

---

## Mode 1: Check (default)

### Step 1: Get current branch and changed files

```bash
git branch --show-current
git diff --name-only HEAD 2>/dev/null
git status --short 2>/dev/null
```

Collect all modified, staged, and untracked file paths. Note the current branch name.

### Step 2: Classify the branch

- **Niche branch**: name matches `niche/<TAG>-general` (e.g., `niche/HABITS-general`, `niche/TEEM-general`)
- **Shared branch**: `general`, `stage`, `main`
- **Feature branch**: anything else (e.g., `claude/...`, `feat/...`) — warn that final merge target matters

For **niche branches**, also determine the TAG (e.g., `HABITS`, `TEEM`) and read its project brief if it exists:
```
docs/niche-sub-apps/<TAG>_PROJECT_BRIEF.md
```

### Step 3: Classify each changed file

Apply these rules to every changed file:

**Niche-specific signals** (these belong on `niche/*` branches):
- `TherrMobile/main/config/brandConfig.ts` — brand selector
- `TherrMobile/main/assets/` paths containing a brand name
- Any file containing only brand-conditional blocks (`BrandVariations.HABITS`, `BrandVariations.TEEM`)
- App store metadata, bundle ID config, niche-only navigation screens

**Shared signals** (these belong on `general`):
- `therr-services/*/src/` — backend service handlers, routes, store methods
- `therr-public-library/` — shared libraries
- `therr-api-gateway/src/` — gateway middleware and routing
- `therr-client-web/` — main web client
- `therr-client-web-dashboard/` — admin dashboard
- `TherrMobile/main/locales/` — translations (always shared)
- `TherrMobile/main/redux/` — shared state
- Database migrations (`*/src/store/migrations/`)
- Root config files (`package.json`, `tsconfig.json`, `docker-compose*.yml`, `.circleci/`)
- `CLAUDE.md`, `docs/` — documentation

**Ambiguous** (needs human judgment):
- `TherrMobile/main/routes/` — could be shared screen or niche-only screen
- `TherrMobile/main/components/` — most are shared, some may be brand-specific

### Step 4: Detect mismatches and report

**On a `niche/*` branch**: flag any shared-signal files as potential misplacement.
**On `general`/`stage`/`main`**: flag any niche-specific-signal files as potential pollution.
**On a feature branch**: remind the developer where this work should ultimately land.

#### Output format

If no issues detected:
```
✓ Branch check passed
  Branch: niche/HABITS-general
  Changed files: 4 — all appear niche-specific
  
  Next step: merge to niche/HABITS-general when ready
```

If issues detected:
```
⚠ Branch mismatch detected
  Branch: niche/HABITS-general (niche — HABITS app only)
  
  Shared code found on a niche branch (won't reach other app variants):
    therr-services/users-service/src/handlers/users.ts  ← backend service (shared)
    therr-public-library/therr-js-utilities/src/constants/enums/Branding.ts  ← shared library

  Niche-specific files (correctly on this branch):
    TherrMobile/main/config/brandConfig.ts  ✓

  Recommendation: Move shared changes to the `general` branch first, then
  merge general → niche/HABITS-general so all app variants inherit the fix.
```

For a feature branch:
```
ℹ Feature branch: claude/plan-agent-skills-zuu8Q
  Changed files include both shared and niche-specific code.
  
  When merging, target:
    Shared code   → general
    Niche code    → niche/<TAG>-general
```

---

## Mode 2: Explain

Print a summary of the branch strategy tailored to the current branch:

```bash
git branch --show-current
git log --oneline -5 --no-merges
```

Output a human-readable explanation of:
1. What this branch type is for
2. What kinds of changes belong here
3. The merge path to production (e.g., general → stage → main)
4. Which project brief applies (if niche branch, name the docs file)

---

## Mode 3: Switch `<TAG>`

Safely switch to `niche/<TAG>-general`.

### Step 1: Check for uncommitted changes

```bash
git status --short
```

If there are uncommitted changes:
- Ask the user if they want to stash them: "You have uncommitted changes. Stash before switching? (git stash)"
- If yes: `git stash push -m "branch-guard auto-stash before switching to niche/<TAG>-general"`
- If no: abort and tell the user to commit or stash manually

### Step 2: Switch branch

```bash
git checkout niche/<TAG>-general 2>&1
```

If the branch doesn't exist locally, try fetching it:
```bash
git fetch origin niche/<TAG>-general 2>&1
git checkout niche/<TAG>-general 2>&1
```

If it still doesn't exist, report clearly: "Branch niche/<TAG>-general not found locally or on origin."
Do NOT create the branch automatically — niche branches require intentional setup per `docs/NICHE_APP_SETUP_STEPS.md`.

### Step 3: Confirm and orient

After switching, report:
- Current branch confirmed
- Path to the relevant project brief: `docs/niche-sub-apps/<TAG>_PROJECT_BRIEF.md`
- Whether there's a stash to restore: "Run `git stash pop` to restore your stashed changes when ready."

---

## Rules

- Never force-push, reset, or delete branches
- Never create a `niche/*` branch — that requires the full setup process in `docs/NICHE_APP_SETUP_STEPS.md`
- When in doubt about a file's classification, mark it as **ambiguous** and let the developer decide
- This skill does not commit or push anything — it only reads git state and optionally switches branches
