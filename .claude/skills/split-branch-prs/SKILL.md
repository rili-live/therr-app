---
name: split-branch-prs
description: Split work that touches both shared and niche-specific code into two separate PRs — one targeting `general`, one targeting `niche/<TAG>-general` — so shared code reaches production and brand identity never lands on `general`. Use whenever a task changes both shared code (backend, libraries, cross-brand UI) and brand/niche code (brandConfig, app ids, icons, splash, per-brand assets), or when asked to open a PR from a branch whose diff spans both. Also verifies brand identity after merging `general` down into a niche branch, which silently un-brands the app.
user-invocable: true
allowed-tools: Bash(git*), Bash(gh*), Bash(npm*), Bash(npx*), Bash(node*), Bash(grep*), Bash(ls*), Read, Glob, Grep, Edit, Write
argument-hint: [split|verify-brand|explain]
---

# Split Branch PRs

Turn one mixed pile of changes into **two PRs that each land on the branch they belong to**:

| PR | Base branch | Carries |
|---|---|---|
| Shared | `general` | Backend, shared libraries, migrations, cross-brand UI, CI, docs |
| Niche | `niche/<TAG>-general` | Brand identity, brand assets, per-brand config and copy |

`general` is the only path to production (`general → stage → main`). `niche/*` branches never
deploy — there is no CI path from them to `main`. So shared code stranded on a niche branch is
dead code, and brand identity that rides along on `general` breaks the flagship app.

`/branch-guard` *detects* misplacement. This skill *fixes* it by producing the two PRs.

## Why this exists (read once)

In August 2026 Friends with Habits branding reached `general` through routine merges of
`niche/HABITS-general` into `general`. On `general` that set `applicationId` to
`com.therr.habits` and moved `versionCode` **445 → 21**. Had it merged to `main`, the flagship
Therr Android app would have been unreleasable: Play rejects both a changed package id and a
backwards versionCode. The CI job that built it had also been renamed and re-pointed away from
`main`, so nothing would have built it either.

Nothing failed. No conflict, no red test, no lint error. That is the shape of this bug class —
**it is always silent**, in both directions:

- Brand files on `general` → flagship app breaks at release time, months later.
- Merging `general` down into `niche/<TAG>-general` → clean fast-forward that **un-brands the
  niche app**. The app simply builds as Therr.

Both directions are handled below. Never assume a clean merge means a correct merge.

---

## Mode: `explain`

Print the table above plus the classification rules, then stop. No git operations.

---

## Mode: `verify-brand` (run after ANY merge of `general` into a `niche/*` branch)

This is the cheap check that would have caught the incident. Run it on the niche branch, after
the merge, before pushing.

```bash
git branch --show-current
```

Derive `<TAG>` from `niche/<TAG>-general`. Then compare the brand-identity surface against the
branch's own pre-merge state (`origin/niche/<TAG>-general`, i.e. before your merge commit):

```bash
BASE=origin/niche/<TAG>-general
for f in \
  TherrMobile/main/config/brandConfig.ts \
  TherrMobile/app.json \
  TherrMobile/eas.json \
  TherrMobile/android/app/src/main/res/values/strings.xml \
  TherrMobile/android/app/src/main/res/values/colors.xml \
  TherrMobile/android/app/src/main/res/values/ic_launcher_background.xml \
  TherrMobile/android/app/src/main/res/values-v31/styles.xml ; do
  git diff --quiet "$BASE" -- "$f" && echo "OK      $f" || echo "CHANGED $f"
done
git diff --stat "$BASE" -- \
  'TherrMobile/android/app/src/main/res/mipmap-*' \
  'TherrMobile/android/app/src/main/res/drawable-*' \
  'TherrMobile/assets/bootsplash' \
  'TherrMobile/ios/Therr/Images.xcassets' \
  'TherrMobile/ios/Therr/Colors.xcassets'
git diff "$BASE" -- TherrMobile/android/app/build.gradle | grep -E '^[-+].*(applicationId|versionCode|versionName)'
```

Read the output as follows:

- Any icon/splash diff, or any `-`/`+` on those three gradle values → **the merge overwrote brand
  identity.**
- `CHANGED brandConfig.ts` is expected and fine *if* the only difference is shared work riding
  along (the `: BrandVariations` annotation, comments). Confirm the assigned value survived:

  ```bash
  grep 'export const CURRENT_BRAND_VARIATION' TherrMobile/main/config/brandConfig.ts
  ```

  It must still name this branch's brand (`BrandVariations.HABITS` on `niche/HABITS-general`).
  If it reads `THERR`, the merge un-branded the app.
- `CHANGED` on `strings.xml` or `build.gradle` needs the same treatment — both carry shared work
  too, so diff them and check only the brand values.

A healthy post-merge run looks like: everything `OK` except possibly `brandConfig.ts`, no
icon/splash diff, no gradle brand-value diff.

When identity *was* overwritten, **fix forward** — restore from the pre-merge state rather than
undoing the merge, so the shared work is kept:

```bash
git checkout "$BASE" -- <each overwritten path>
```

For `brandConfig.ts`, `strings.xml` and `build.gradle`, restore only the brand *values* by hand —
these files also carry shared work (the enum annotation on `CURRENT_BRAND_VARIATION`, the
notification channel id, the `notificationActionPrefix` mapping) that must survive.

Then re-run the gates in § Verification and commit as a `chore(<tag>): restore brand identity
after merging general` commit.

---

## Mode: `split` (default)

### Step 1: Determine the target branches

```bash
git branch --show-current
git log --oneline -5
git status --short
```

Establish `<TAG>` (usually `HABITS`). If the working branch is already `general` or
`niche/<TAG>-general`, the split still applies — the work just has not been separated yet.

Pick the comparison base: the branch the work was started from (`origin/general` for most feature
work). Get the full changed set, committed and uncommitted:

```bash
git fetch origin general niche/<TAG>-general
git diff --name-only origin/general
git status --short
```

### Step 2: Classify every changed file

Assign each path to exactly one bucket. When a path could go either way, prefer **shared** — a
shared file on `general` is inherited by every variant, whereas a niche file on `general` breaks
them all.

**Shared → PR targeting `general`:**

- `therr-services/**`, `therr-api-gateway/**`
- `therr-public-library/**` (`therr-react`, `therr-js-utilities`, `therr-styles`)
- `**/migrations/**`, `**/*.sql`
- Root `package.json`, `package-lock.json`, `docker-compose*.yml`, `_bin/**`, `eslint-config/**`
- `docs/**`, `.claude/**`, `scripts/**`
- `TherrMobile/**` feature code, utilities, components and routes that are not brand identity
- `therr-client-web/**`, `therr-client-web-dashboard/**` app code
- `.circleci/config.yml` — **except** release-job branch filters and per-brand EAS profile names

**Niche → PR targeting `niche/<TAG>-general`:**

- `TherrMobile/main/config/brandConfig.ts` (the `CURRENT_BRAND_VARIATION` **value**)
- `TherrMobile/app.json`, `TherrMobile/eas.json`
- `TherrMobile/android/app/build.gradle` — `applicationId`, `versionCode`, `versionName` only
- `TherrMobile/android/app/src/main/res/values/strings.xml` — `app_name`, `filter_view_https_*`
- `TherrMobile/android/app/src/main/res/values/colors.xml`,
  `values/ic_launcher_background.xml`, `values-v31/styles.xml`
- `TherrMobile/android/app/src/main/res/mipmap-*/ic_launcher*`,
  `drawable-*/bootsplash_logo*`, `playstore-icon.png`
- `TherrMobile/assets/bootsplash/**`, `TherrMobile/assets/manifest.json`,
  `TherrMobile/main/assets/bootsplash_logo*`
- `TherrMobile/ios/Therr/Images.xcassets/**`, `ios/Therr/Colors.xcassets/**`,
  `ios/Therr/BootSplash.storyboard`
- `google-services.json`, `GoogleService-Info.plist`
- `TherrMobile/package.json` — only the `adb` script app ids
- Locale strings only that variant renders
- `.circleci/config.yml` release-job branch filters / EAS profile names for that brand

**Shared files that get rebranded by mistake — check these every time.** None are in the
niche bucket; they must keep their Therr values on `general`, and the niche look is produced
by the override mechanisms listed under the next heading. Each of these actually shipped to
`general` in the incident above, past every existing check:

- `TherrMobile/main/styles/themes/{light,dark,retro}/colors.ts` — the **base** palettes are
  always Therr's (`primary3: '#1C7F8A'`). Editing them rebrands every variant at once.
- `TherrMobile/main/styles/themes/paper.ts` — base theme values *and* the comments
  describing them.
- `TherrMobile/main/locales/*/dictionary.json` — shared by every variant. Never hardcode a
  brand name; copy that must name the app takes `{appName}` and is passed
  `BRAND_DISPLAY_NAME` at the call site. This includes the Play **prominent disclosure**,
  which the Therr build renders too and which must name the app the user is holding.
- `TherrMobile/android/app/src/main/AndroidManifest.xml` — permission `tools:node="remove"`
  strips and the Transistorsoft license meta-data. HABITS strips location on its own branch;
  porting that to `general` silently disables location for Therr and Teem.
- Hardcoded colour fallbacks in components (e.g. `|| '#1C7F8A'` in `Input/index.tsx`).

`TherrMobile/__tests__/brandSurfaceConsistency.test.ts` asserts all of the above against
whatever `brandConfig.ts` selects, so it passes on both branches and fails when they
disagree. Run it on **both** sides of the split — it is the fastest way to prove the
separation is clean.

**Careful cases — these look niche but are shared:**

- `TherrMobile/env-config.js` — the per-brand feature-flag override map is shared infrastructure.
  Every brand's overrides live on `general`.
- Brand *feature* code (habits routes, pact components) and its additive assets
  (`main/assets/habits-icons/**`, landing images) — shared; it is flag-gated, not brand identity.
- `brandColorOverrides` / `brandColorVariationOverrides` in `styles/themes/index.ts` and
  `brandPaperColorOverrides` in `paper.ts` — shared. This is *the* supported way to give a
  niche app its palette, which is why the base palettes above never need editing.
- `BRAND_DISPLAY_NAMES` in `brandConfig.ts` — shared; it maps every brand, and
  `BRAND_DISPLAY_NAME` is derived from the selected one, so no per-branch edit is needed.
- A component branching on `CURRENT_BRAND_VARIATION === BrandVariations.HABITS` — shared and
  correct; the other brand's path simply never runs.
- `brandConfig.ts`'s type annotation (`: BrandVariations`) — shared. Only the assigned value is
  niche. Without the annotation, TypeScript narrows to a literal and every
  `=== BrandVariations.HABITS` guard becomes a false TS2367, which churns the mobile tsc baseline
  on every brand flip and is precisely what made the leak hard to see.
- Anything under `**/migrations/**` — always shared, always `general`, no exceptions.

Print the classification as a two-column list and **stop for confirmation** if any file is
ambiguous or if the niche bucket contains something outside the list above.

### Step 3: Build the shared PR first

Shared goes first so the niche branch can merge it and build on top.

```bash
git checkout general
git pull --autostash origin general
git checkout -b <feature>-shared
```

Apply only the shared changes — cherry-pick clean shared-only commits where they exist, otherwise
re-apply as fresh commits. Before committing, prove the bucket held:

```bash
git diff --cached --name-only
```

Every path must be in the shared bucket. Run § Verification, then:

```bash
git push -u origin <feature>-shared
gh pr create --base general --head <feature>-shared \
  --title "<type>: <shared summary>" --body "<what, why, and that the niche half is PR #N>"
```

### Step 4: Build the niche PR on top

```bash
git checkout niche/<TAG>-general
git pull --autostash origin niche/<TAG>-general
git checkout -b <feature>-<tag>
git merge origin/general --no-edit     # or merge the shared branch if it has not landed yet
```

**Immediately run Mode `verify-brand`.** This merge is the un-branding step, and it will not
conflict. Fix forward before adding anything else, in its own commit.

Then apply the niche changes, confirm the bucket again with `git diff --cached --name-only`, run
§ Verification, and open the second PR:

```bash
git push -u origin <feature>-<tag>
gh pr create --base niche/<TAG>-general --head <feature>-<tag> \
  --title "<type>(<tag>): <niche summary>" --body "<what, why, and that the shared half is PR #N>"
```

Cross-link the two PRs in both bodies, and state the merge order: **shared first, niche second.**

### Step 5: Report

Give the user both PR URLs, the file counts per bucket, the gate results, and an explicit
statement of merge order. Never merge either PR yourself.

---

## Verification

Run the gates the scope calls for. There is no Docker in the Claude Code web environment, so
integration tests are out of reach there — say so rather than skipping silently.

```bash
npm run pr:tsc-baseline:mobile   # mobile: pass = no NEW signatures vs .tsc-baseline
npm run pr:test:unit:mobile
npm run locales:check
npx eslint <changed files> --no-error-on-unmatched-pattern
```

For non-mobile packages use the matching `pr:typecheck:<pkg>` and `pr:test:unit:<pkg>` wrappers.

**Never** run `./_bin/check-mobile-tsc-baseline.sh --update` to make the mobile gate pass — that
erases the gate. If the brand value flip produces new TS2367 errors, the fix is the enum
annotation on `CURRENT_BRAND_VARIATION`, not a new baseline.

A correctly split pair has an identical mobile tsc baseline count and an identical passing test
count on **both** branches. If the two branches disagree, something brand-coupled leaked — most
often a test that reads the ambient brand instead of mocking it.

## Rules

- **Two PRs, never one.** A single PR spanning both buckets cannot be landed correctly.
- **Never push to `general`, `stage`, `main`, or `niche/*` directly** — always via a PR branch.
- **Never merge the PRs.** The user decides.
- **A clean merge is not a correct merge** for anything brand-adjacent. Run `verify-brand`.
- If the work turns out to be entirely one bucket, say so and open a single correctly-based PR
  rather than inventing an empty second one.
