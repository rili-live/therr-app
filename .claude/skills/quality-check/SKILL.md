---
name: quality-check
description: Run ESLint and TypeScript type-checking on changed or specified files, grouped by package. Required by CLAUDE.md before completing any code change.
user-invocable: true
allowed-tools: Bash(git diff*), Bash(git status*), Bash(npx eslint*), Bash(npx tsc*), Bash(find *)
argument-hint: [--package <name>] [--fix] [--changed-only]
---

# Quality Check

Run lint and type-checking on modified files in this monorepo. This satisfies the code quality requirements in CLAUDE.md: ESLint must pass and TypeScript must have zero errors before any change is complete.

## Step 1: Determine which files to check

**If `--package <name>` is given**, target that package only. Package names match directory names:
- `therr-client-web`, `therr-client-web-dashboard`, `TherrMobile`
- `therr-api-gateway`
- `therr-services/users-service`, `therr-services/maps-service`, `therr-services/messages-service`, `therr-services/reactions-service`, `therr-services/push-notifications-service`, `therr-services/websocket-service`
- `therr-public-library/therr-js-utilities`, `therr-public-library/therr-react`, `therr-public-library/therr-styles`

**Otherwise**, get changed files:
```bash
git diff --name-only HEAD 2>/dev/null
git status --short 2>/dev/null
```
Combine staged, unstaged, and untracked `.ts`/`.tsx`/`.js`/`.jsx` files. Deduplicate. Skip deleted files.

## Step 2: Group files by package

Map each file path to its package using this prefix table:

| File prefix | Package dir | ESLint config | tsconfig |
|-------------|-------------|---------------|---------|
| `TherrMobile/` | `TherrMobile` | `TherrMobile/.eslintrc.js` | `TherrMobile/tsconfig.json` |
| `therr-client-web/` | `therr-client-web` | `therr-client-web/.eslintrc.js` | `therr-client-web/tsconfig.json` |
| `therr-client-web-dashboard/` | `therr-client-web-dashboard` | `therr-client-web-dashboard/.eslintrc.js` | `therr-client-web-dashboard/tsconfig.json` |
| `therr-api-gateway/` | `therr-api-gateway` | `therr-api-gateway/.eslintrc.js` | `therr-api-gateway/tsconfig.json` |
| `therr-services/users-service/` | `therr-services/users-service` | `therr-services/users-service/.eslintrc.js` | `therr-services/users-service/tsconfig.json` |
| `therr-services/maps-service/` | `therr-services/maps-service` | `therr-services/maps-service/.eslintrc.js` | `therr-services/maps-service/tsconfig.json` |
| `therr-services/messages-service/` | `therr-services/messages-service` | `therr-services/messages-service/.eslintrc.js` | `therr-services/messages-service/tsconfig.json` |
| `therr-services/reactions-service/` | `therr-services/reactions-service` | `therr-services/reactions-service/.eslintrc.js` | `therr-services/reactions-service/tsconfig.json` |
| `therr-services/push-notifications-service/` | `therr-services/push-notifications-service` | `therr-services/push-notifications-service/.eslintrc.js` | `therr-services/push-notifications-service/tsconfig.json` |
| `therr-services/websocket-service/` | `therr-services/websocket-service` | `therr-services/websocket-service/.eslintrc.js` | `therr-services/websocket-service/tsconfig.json` |
| `therr-public-library/therr-js-utilities/` | `therr-public-library/therr-js-utilities` | `therr-public-library/therr-js-utilities/.eslintrc.js` | `therr-public-library/therr-js-utilities/tsconfig.json` |
| `therr-public-library/therr-react/` | `therr-public-library/therr-react` | `therr-public-library/therr-react/.eslintrc.js` | `therr-public-library/therr-react/tsconfig.json` |

Files outside these prefixes (shell scripts, markdown, JSON config) are skipped — no lint needed.

## Step 3: Run ESLint per package

For each package that has changed `.ts`/`.tsx` files, run ESLint. Always run from the repo root.

**Without `--fix`:**
```bash
npx eslint <file1> <file2> ... --no-error-on-unmatched-pattern
```

**With `--fix`:**
```bash
npx eslint <file1> <file2> ... --fix --no-error-on-unmatched-pattern
```

Pass all changed files for that package in a single invocation. If the package has no `.eslintrc.js` (e.g., `therr-styles`), skip ESLint for that package.

## Step 4: Run TypeScript type-check per package

For each package that was touched, run:
```bash
npx tsc --noEmit -p <package>/tsconfig.json 2>&1
```

Run from the repo root. Capture stdout+stderr together. A zero exit code means no errors.

**Skip tsc for**: `therr-public-library/therr-styles` (no TypeScript). Also skip if no `tsconfig.json` exists in the package.

## Step 5: Report results

**If all checks pass**: Print a single summary line:
```
✓ Quality check passed — <N> package(s) checked, 0 errors
```
No further output. Don't list every file or package when everything is green.

**If any checks fail**: Print a grouped report:

```
Quality check failed

ESLint errors:
  therr-client-web/src/routes/Foo.tsx
    Line 42: 'bar' is assigned a value but never used  (no-unused-vars)
    Line 58: Missing semicolon  (semi)

TypeScript errors:
  therr-services/users-service
    src/handlers/users.ts(31,5): error TS2322: Type 'string' is not assignable to type 'number'

Packages checked: therr-client-web, therr-services/users-service
```

Then list specific action items needed to fix each error. If `--fix` was used, note which ESLint issues were auto-fixed and which remain.

## Rules

- Never skip a package just because its files weren't directly edited — if `--package` is specified, always check it fully
- Run ESLint and tsc in parallel (separate Bash calls in the same message) when checking multiple packages to save time
- Do not suggest changes beyond what lint/tsc report — this skill checks quality, it doesn't refactor
- If `npx` is not found or a config file is missing, report that clearly rather than silently skipping
