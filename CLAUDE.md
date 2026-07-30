# Claude Code Instructions

Monorepo for Therr App and its niche variants. 13 packages, ~250k LOC.
Most of what you need is inferable from the filesystem — what follows is the
subset that is **not**, plus the gotchas that have actually cost time.

Package-specific detail lives in each package's own `CLAUDE.md`, which loads
automatically when you work in that directory. Full doc index: [`docs/README.md`](docs/README.md).

## Branch Awareness (check this first)

Before making code changes, check the current git branch.

- **`general`** — shared code inherited by all niche apps. The only path to production.
- **`niche/*`** (e.g. `niche/HABITS-general`) — app-variant branding, assets, config.
- **`stage`** — merging `general` → `stage` triggers the CI **build** phase.
- **`main`** — merging `stage` → `main` triggers the CI **deploy** phase.

### Deployment reality

**`niche/*` branches NEVER deploy to production.** There is no CI path from a niche
branch to `main`. Only `general → stage → main` deploys. Code committed only to a
`niche/*` branch is dead code — it runs locally, it shows in diffs, it never runs in
production.

These paths **MUST** land on `general` to ever ship:

- `therr-services/**`, `therr-api-gateway/**` — backend
- `therr-public-library/**` — shared libraries
- `**/migrations/**`, `**/*.sql` — schema
- Root `package.json`, `package-lock.json`, `docker-compose*.yml`, `_bin/**`, `eslint-config/**`

These may stay on a `niche/*` branch:

- `TherrMobile/**` — mobile UI, navigation, brand components
- `therr-client-web/**`, `therr-client-web-dashboard/**` — brand-scoped web UI
- Brand assets, `brandConfig.ts`, Firebase/Google Services files
- Locale strings only that variant renders

**When a task touches both**, split it:
1. Switch to `general`, commit the shared/backend part there.
2. `git checkout niche/<TAG>-general && git merge general`
3. Commit the niche-only part separately.

Do it in that order. Mixed commits cannot be split cleanly after the fact.

### Commit separation

Every commit must be landable on a single branch:

- Never mix backend and frontend in one commit.
- Never mix shared-library and app-specific code in one commit.
- Never mix two niche variants in one commit.

Before staging, run `git diff --cached --name-only` and confirm every path belongs on
the current branch.

`.husky/pre-commit` enforces this mechanically on `niche/*` branches (installed by
`npm install` via `"prepare": "husky"`). It also runs locale-parity and lints staged
files. `.husky/pre-push` runs tests for changed packages. Bypass with `--no-verify`
only for a genuinely legitimate exception.

Use `/branch-guard` to check the current branch against changed files.

### Switching niche apps locally

```bash
git checkout niche/HABITS-general         # or general, or niche/TEEM-general
./_bin/switch-brand.sh habits              # habits | therr | teem
cd TherrMobile && npm start                # terminal 1
cd TherrMobile && npm run android:habits   # terminal 2
```

`switch-brand.sh` rewrites `TherrMobile/main/config/brandConfig.ts`, kills Metro, and
clears its caches. The `android:<brand>` scripts are thin aliases — brand selection
comes from `brandConfig.ts`.

### Project brief for the current branch

Read the brief matching your branch early in a session:

| Branch | Brief |
|---|---|
| `general`, `stage`, `main` | `docs/niche-sub-apps/PROJECT_BRIEF.md` |
| `niche/<TAG>-general` | `docs/niche-sub-apps/<TAG>_PROJECT_BRIEF.md` |

Teem is **shelved**; its brief is a stub. Friends With Habits is the active consumer bet
and is in open testing.

## Commands

```bash
npm run install:all      # install across all packages (use --legacy-peer-deps)
npm run build:all:dev    # build all libraries and services
npm run build:changed    # rebuild only changed packages
npm run lint:changed     # lint changed packages
npm run test:changed     # test changed packages
npm run locales:check    # locale dictionary parity across all packages
npm run test:lint-rules  # unit tests for the custom ESLint rules
```

Type-check and lint a specific package:

```bash
npx eslint <path> --fix
npm run pr:typecheck:<pkg>       # gateway|users|maps|messages|reactions|push|
                                 # websocket|js-utils|therr-react|web|dashboard
npm run pr:tsc-baseline:mobile   # mobile gates on "no NEW errors" vs a 104-error baseline
```

Or just run `/quality-check`, which groups changed files by package and does both.

## Code Quality

CI enforces lint, type-checking, and tests on every branch (`.circleci/config.yml`).
Run `/quality-check` before finishing a change rather than relying on CI to tell you.

Conventions worth knowing because they are **not** the common defaults:

- **4-space indentation** (`eslint-config/base.js`), not 2.
- `max-len` 160.
- `no-explicit-any` is off, but justify any `any` you add.
- TherrMobile extends `@react-native`, not airbnb-base.

## Monorepo Structure

```
therr-api-gateway/          # Public API entry (7770)
therr-services/             # Backend microservices (7771-7775, 7743)
therr-public-library/       # therr-react, therr-js-utilities, therr-styles
therr-client-web/           # Main web app (7070)
therr-client-web-dashboard/ # Admin dashboard (7071)
TherrMobile/                # React Native (isolated package.json)
eslint-config/              # Shared config + eslint-plugin-therr (custom rules)
```

No npm workspaces — build order is a hardcoded dependency chain in
`_bin/apply-to-all.sh`; incrementality is git-diff predicates in
`_bin/apply-to-changed.sh`. Shared libraries are consumed as compiled `lib/` output,
so **build them before type-checking or linting consumers**.

Most dependencies live in the root `package.json`. TherrMobile has its own.

## Key Dependencies

- **Node 24.12.0** (`.nvmrc`), npm 11+ (enforced by `_bin/prep.sh`)
- **TypeScript** 5.9.x
- **React** 18.2 (web) / 19.2 (mobile) — hooks and functional components, no class components
- **React Native** 0.83.6, new architecture enabled
- **Redux Toolkit** 2.5, React Router 6
- Backend: Express + raw SQL via Knex (not an ORM), separate read/write pools per service

Always use `--legacy-peer-deps` for npm installs in `TherrMobile` (not in Docker).

## Where to Put Shared Code

| Location | When |
|---|---|
| `therr-js-utilities/` | Isomorphic — needed by both frontend and backend |
| `therr-react/` | React-specific, shared between web and mobile |
| Service `utilities/` | Backend-only, single service |
| Local file | Single use — don't abstract prematurely |

Keep it local unless it is already duplicated in 2+ packages, or is clearly reusable and
stable. Avoid abstractions for hypothetical reuse.

**Data fetching defaults to Redux Toolkit**, not TanStack Query. TanStack is permitted
for narrow cases only (infinite scroll, polling, optimistic mutations in a single app) and
never in `therr-react`. Run `/tanstack-query-check` before introducing it — that skill
holds the full adoption rules. If unsure: use Redux.

## Brand Variations

Variants are defined by the `BrandVariations` enum in
`therr-js-utilities/src/constants/enums/Branding.ts` and selected by the
`x-brand-variation` HTTP header. Backend reads it via `getBrandContext(req.headers)`;
mobile reads `CURRENT_BRAND_VARIATION` from `../config/brandConfig`.

Full documentation: `docs/MULTI_BRAND_ARCHITECTURE.md`.

### Brand-scoped database tables

Core tables are `main.*`; niche features get their own schema (`habits.*`). Rows that
belong to exactly one brand live in **brand-scoped** tables, which must never be read
without a `brandVariation` predicate.

`eslint-plugin-therr` enforces this: `therr/no-direct-brand-scoped-table` makes any
direct string reference to a listed table a lint error outside its sanctioned store.
When adding a table to that set, three things land together — the entry in
`eslint-config/brand-scoped-tables.js`, a `*Store.ts` extending `BrandScopedStore`, and
a narrow `// eslint-disable-next-line therr/no-direct-brand-scoped-table` in that store.
`npm run test:lint-rules` fails if the first two get out of sync.

Migrations adding the column should default it to `'therr'` (NOT NULL) so legacy rows
stay visible, with a composite index leading on the most selective column. See
`20260425000002_main.notifications.brandVariation.js` and
`docs/NICHE_APP_DATABASE_GUIDELINES.md`. Use `/db-migration-scaffold` to generate
migrations in the right service and schema.

> Note: both Cloud Function repos (`therr-ai-automator`, `therr-messaging-automator`)
> query this database directly and are **not** covered by the lint rule. Check them
> before renaming or dropping any column they read — see § Sibling Repos below.

## Sibling Repos

This monorepo is not the whole system. Four sibling repos in the `rili-live` org run in
production, and two of them **read and write this database directly**, bypassing the
gateway. No CI in any repo checks these couplings.

| Repo | Couples to this repo via |
|---|---|
| `therr-messaging-automator` | Direct Knex reads (users/maps/reactions) + `POST /v1/habits/pacts/digest/run-daily` on users-service over the VPC |
| `therr-ai-automator` | Direct Knex reads **and writes** — it authors `main.thoughts` / `main.thoughtReactions` |
| `therr-infra-terraform` | Provisions Cloud SQL, the Cloud Functions, Cloud Scheduler, and the internal IP that `k8s/prod` pins |
| `therr-landing` | Public API only (`/v1/users-service/subscribers/signup`) — not coupled |

The four rules that actually bite:

1. **Migrations are expand/contract.** A rename here deploys green and breaks a Cloud
   Function hours later at its next scheduler firing, with no alert. Grep both automators'
   `src/store/` first.
2. **Brand-scoping doesn't cross repos.** `therr/no-direct-brand-scoped-table` can't see
   another repository, and the messaging automator reads `main.notifications` and
   `main.userAchievements`. Adding a table to `BRAND_SCOPED_TABLES` means mirroring it into
   that repo's `src/store/brandScoped.ts` too.
3. **`main.thoughts` rows can be dated in the future** (ai-automator drips a run's output out
   over ~30h). Any SQL doing arithmetic on `NOW() - "createdAt"` must assume a negative
   result — an unclamped `POWER()` on one caused an 8-day feed outage.
4. **The habits digest has no server-side dedup.** Once-a-day is a property of there being a
   single Cloud Scheduler job, not of the code. Never add a second trigger path.

Full detail, including the table-by-table coupling surface and the internal-LB network path:
`docs/CROSS_REPO_INTEGRATION.md`.

## Localization

Every user-facing string must exist in **all** locales for its package —
`en-us`, `es`, `fr-ca`. Never add a key to one dictionary without adding it to the others.

`npm run locales:check` enforces this (also in CI and pre-commit). Use `/i18n-sync` to
find and scaffold gaps.

One non-obvious rule: frontend code that pattern-matches against *translated* text must
include variants for all three locales, or it silently fails for non-English users. See
`getHighlightValues()` in `TherrMobile/main/routes/Notifications/Notification.tsx`.

## Backlog

`docs/WORK_IN_PROGRESS.md` is the prioritized backlog plus the
**§ Manual Operational Follow-ups** checklist of post-deploy steps humans must do.

At the start of a non-trivial session, scan that section for unchecked `- [ ]` items and
surface the 1–3 most relevant to the current work. Don't recite the whole list. When you
fix a TODO, delete its bullet in the same commit. `/work-plan` proposes the next batch.

## Session Memory

At session start, read `context/USER.md`, `context/MEMORY.md`, and today's
`context/memory/{YYYY-MM-DD}.md` if it exists. Keep it to that — these are capped at
1,375 and 2,500 characters respectively, and mid-session writes only take effect next
session.

Log session activity silently to today's daily log (goal, deliverables, decisions, open
threads). Never announce that you logged something. `/memory-write` handles "remember
this" / "forget about" requests and enforces the cap. Full protocol:
`docs/MEMORY_SYSTEM_SETUP.md`.

## Other Documentation

Read when relevant — see [`docs/README.md`](docs/README.md) for the full index.

- `docs/ARCHITECTURE.md` — system design, service boundaries
- `docs/CROSS_REPO_INTEGRATION.md` — the four sibling repos and what couples them to this one
- `docs/MULTI_BRAND_ARCHITECTURE.md` — brand variation system
- `docs/NICHE_APP_DATABASE_GUIDELINES.md` — schema isolation, migration patterns
- `docs/NICHE_APP_SETUP_STEPS.md` — creating a new brand variation
- `docs/FEATURES.md` — **update when adding or removing a feature**
- `docs/GROWTH_STRATEGY.md` — B2B funnel, the active growth strategy
- `docs/AUTOMATION_ROADMAP.md` — cross-repo automation priorities
- `docs/OFFLINE_FIRST_PLAN.md` — offline-first architecture and roadmap
- `docs/SECRETS_AND_LOCAL_BOOTSTRAP.md` — local dev setup
- `docs/PROD_DEBUG_CLAUDE.md` — production debugging runbook
- `docs/MEMORY_SYSTEM_SETUP.md` — the `context/` memory system and session protocol
