---
name: tanstack-query-check
description: Decide whether TanStack Query (React Query) is appropriate for a proposed feature, and if so, scaffold it correctly per the repo's case-by-case adoption rules. Blocks misuse that would fragment state or duplicate Redux slices.
user-invocable: true
allowed-tools: Bash(git branch*), Bash(git status*), Bash(git diff*), Read, Glob, Grep
argument-hint: [check "<feature description>" | scaffold <app> <feature-name> | explain]
---

# TanStack Query Check

Gatekeeper skill for introducing TanStack Query (`@tanstack/react-query`) into therr-app. The codebase uses Redux Toolkit as the default data-fetching tool. TanStack Query is permitted **only** for narrow, isolated use cases. This skill enforces the rules documented in root `CLAUDE.md` under "TanStack Query (React Query) — Case-by-Case Adoption".

Always read that section first — this skill operationalizes it.

## Mode Selection

| Argument | Mode |
|----------|------|
| `check "<feature description>"` or _(no argument, with a described feature)_ | Decide fit + list precautions |
| `scaffold <app> <feature-name>` | Scaffold a compliant query file (after check passes) |
| `explain` | Print the adoption rules in a condensed form |

---

## Mode 1: Check (default)

Given a feature description (from the user or prior conversation), decide whether TanStack Query is appropriate and report a decision.

### Step 1: Collect context

```bash
git branch --show-current
```

Read root `CLAUDE.md` (the "TanStack Query — Case-by-Case Adoption" section) so your decision reflects current rules, not stale knowledge.

### Step 2: Run the eligibility checklist

Score the feature against these questions. **Any** No answer in the "Must Be Yes" group disqualifies TanStack Query.

**Must Be Yes (hard requirements):**

1. Is the feature scoped to exactly one app (`therr-client-web`, `therr-client-web-dashboard`, or `TherrMobile`)? — *Must be Yes. Never add to `therr-react`.*
2. Is the data read-mostly or does it use a pattern TanStack is uniquely good at (infinite scroll, polling, optimistic mutations)? — *Must be Yes, otherwise a Redux thunk is the cheaper choice.*
3. Will the feature **NOT** overlap with any of these Redux slices: `user`, `notifications`, `messages`, `userConnections`, presence, socket-driven state? — *Must be Yes. If No, TanStack will fight the socket middleware.*
4. Will the feature **NOT** depend on SSR `__PRELOADED_STATE__` hydration? — *If web SSR is involved, integrating TanStack hydration is a separate architectural decision.*
5. Is there an existing service in `therr-react/services` that can be called from `queryFn` (or is one not needed)? — *Must be Yes. Do not reimplement the HTTP layer.*

**Nice to Have (signals of fit):**

- Infinite list / paginated feed
- Polling or background refresh needed
- Optimistic UI with rollback
- Multiple components subscribing to the same server state with independent lifecycles

**Red flags (signal NOT to use):**

- Feature touches auth, login/logout, or user profile editing
- Data is pushed via socket-io events
- Feature is shared between web and mobile (would belong in `therr-react`)
- Data is also persisted via `redux-persist`
- "We might as well use it because it's modern"

### Step 3: Detect existing conflicts

If the user's proposed feature likely overlaps with existing Redux code, surface it:

```bash
# Find the related Redux action file(s)
```

Use `Glob` / `Grep` to check:
- `therr-public-library/therr-react/src/redux/actions/` for an existing action matching the feature area
- `therr-public-library/therr-react/src/services/` for an existing service
- `TherrMobile/main/redux/actions/` and `therr-client-web/src/redux/actions/` for app-local actions

If an existing Redux action covers this data, recommend extending it rather than creating a parallel TanStack query.

### Step 4: Report decision

Output one of three verdicts.

**✅ APPROVED**
```
✅ TanStack Query is appropriate here.

  Feature: <description>
  App: therr-client-web-dashboard
  Why it fits: infinite scroll + dashboard polling; no socket overlap

  Required precautions:
    1. Add @tanstack/react-query to therr-client-web-dashboard/package.json
       (NOT to therr-react or the root package.json)
    2. Use MapsService.searchSpaces as the queryFn — do not re-call axios directly
    3. Mount QueryClient inside the dashboard feature subtree
    4. Set staleTime: 30_000 and retry: 1 as defaults
    5. Add a comment at the top of the query file stating "TanStack used for
       infinite scroll; Redux pattern would require manual pagination state"

  Next: run `/tanstack-query-check scaffold therr-client-web-dashboard <feature-name>`
```

**⚠ RECONSIDER**
```
⚠ TanStack Query is borderline here. Prefer Redux unless you can justify one of:

  - Infinite scroll (you'd hand-roll pagination state otherwise)
  - Polling (you'd hand-roll setInterval + cleanup otherwise)
  - Optimistic mutation with rollback

  If none apply, a thunk in therr-react/redux/actions/ is cheaper and keeps
  state paradigms consistent.

  Ask: does this feature actually need TanStack, or is it just "nicer"?
```

**❌ REJECTED**
```
❌ TanStack Query is not appropriate here.

  Feature: <description>
  Blocker(s):
    - Touches user/auth state (Redux is the source of truth for auth)
    - Would need to live in therr-react (shared lib) — TanStack is app-scoped only
    - Overlaps with socket-io-middleware notifications slice

  Use Redux instead:
    Extend therr-public-library/therr-react/src/redux/actions/<Area>.ts
    Follow the existing thunk pattern (see ContentActions.ts for reference)
```

---

## Mode 2: Scaffold

Only run after Mode 1 returns ✅ APPROVED. Generate a compliant query file.

### Step 1: Validate arguments

- `<app>` must be one of: `therr-client-web`, `therr-client-web-dashboard`, `TherrMobile`.
- If `<app>` is `therr-react` or any package under `therr-public-library/`, **abort**: "TanStack Query must not be added to shared libraries."

### Step 2: Check the dependency

Read the app's `package.json`. If `@tanstack/react-query` is not listed, note that the user needs to add it:

```bash
# For web/dashboard (from app directory)
npm install @tanstack/react-query --legacy-peer-deps

# For mobile (from TherrMobile/)
npm install @tanstack/react-query --legacy-peer-deps
```

Do NOT install it yourself — the user should run install.

### Step 3: Check for existing QueryClient setup

Search the app for `QueryClientProvider`:

- If present, the new query file just needs to export hooks.
- If absent, the user needs to mount `QueryClientProvider` at the feature subtree root (not the app root, unless they explicitly want app-wide scope).

### Step 4: Generate the query file

Place under `<app>/src/queries/` (create the directory if needed). File name: `use<FeatureName>Query.ts`.

Template (web/dashboard):

```typescript
// TanStack Query used here because: <fill in: infinite scroll / polling / optimistic mutation>
// Approved per CLAUDE.md "TanStack Query — Case-by-Case Adoption" rules.
// - Scoped to this app only (not therr-react)
// - Uses therr-react services for HTTP (preserves interceptors + auth headers)
// - Does not overlap with socket-driven Redux slices
import { useQuery } from '@tanstack/react-query';
import { /* ServiceName */ } from 'therr-react/services';

export const use<FeatureName>Query = (params: /* type */) => useQuery({
    queryKey: ['<feature-name>', params],
    queryFn: () => /* ServiceName */.method(params).then((res) => res.data),
    staleTime: 30_000,
    retry: 1,
});
```

Template (mobile) is identical — React Native has no SSR concern.

### Step 5: Remind the user of integration steps

Print a checklist:

```
Scaffolded <path>

Before merging:
  [ ] Add @tanstack/react-query to <app>/package.json (use --legacy-peer-deps)
  [ ] Mount <QueryClientProvider> at the feature subtree (not inside therr-react)
  [ ] Verify the chosen service in therr-react/services exists and is built (npm run build in therr-public-library)
  [ ] Add a test for the hook (mock the service, assert the queryKey stays stable)
  [ ] Run quality-check before committing
```

---

## Mode 3: Explain

Print a condensed version of the rules:

```
TanStack Query in therr-app — TL;DR

Default: Redux Toolkit thunks in therr-react/redux/actions/
TanStack: ONLY for narrow cases in a single app (web, dashboard, or mobile)

Good fit:       Bad fit:
- Infinite      - Anything auth/user-related
  scroll        - Socket-driven data (messages, notifications, reactions)
- Polling       - Shared between web and mobile (goes in therr-react instead)
- Optimistic    - SSR-hydrated data on therr-client-web
  mutations     - Data already in redux-persist
                - "It would be nicer"

If allowed:
  1. Scope to one app's src/queries/ — never in therr-react
  2. Call existing therr-react/services from queryFn
  3. Mount QueryClient at a feature subtree, not globally unless intentional
  4. Document why TanStack was chosen at the top of each query file
  5. Never duplicate state — if Redux already has it, don't TanStack it too

Full rules: root CLAUDE.md → "TanStack Query (React Query) — Case-by-Case Adoption"
```

---

## Rules

- This skill does not install packages or modify `package.json` — it only reads and scaffolds source files.
- This skill never adds TanStack Query to `therr-public-library/` (shared libraries). That is a hard stop.
- This skill never replaces existing Redux actions — it only adds new, orthogonal query hooks.
- If the user pushes back on a ❌ REJECTED verdict, escalate to a human decision — do not silently approve.
