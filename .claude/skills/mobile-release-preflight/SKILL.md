---
name: mobile-release-preflight
description: Go/no-go gate before cutting an Android or iOS build of a Therr mobile app. Verifies brand and branch agree, versionCode/versionName were bumped, patch-package patches match installed versions, no deprecated Android 15 APIs are referenced, locales are in parity, and the tsc baseline, lint, and Jest suites are green — then checks Play release notes and records post-release follow-ups.
user-invocable: true
allowed-tools: Bash(git*), Bash(npm*), Bash(npx*), Bash(node*), Bash(ls*), Bash(grep*), Bash(./_bin/*), Read, Glob, Grep, Edit
argument-hint: [--brand <therr|habits|teem>] [--platform <android|ios|both>] [--fix]
---

# Mobile Release Preflight

A bad mobile release is the most expensive failure mode in this repo. There is no rollback: an app store build reaches users' devices and stays there, a Play Console rejection costs a review cycle, and a wrong-brand or un-bumped build wastes the whole submission. Backend mistakes get a hotfix in twenty minutes; a mobile mistake gets a week.

This skill runs the checks that have actually blocked or broken a release here, and returns a single **GO** or **NO-GO** with the blocking list.

**`--brand`**: the brand you intend to ship. Inferred from `brandConfig.ts` if omitted.
**`--platform`**: defaults to `android` (the automated EAS + Play path). `ios` and `both` are supported; iOS-only checks are noted per section.
**`--fix`**: auto-apply the small mechanical fixes flagged below (lint autofix, locale scaffolding). Never applies version bumps or patch regeneration.

Run this **before** kicking off an EAS build, not after.

---

## Step 1: Establish release identity

```bash
git branch --show-current 2>&1
git status --short 2>&1
grep -n "CURRENT_BRAND_VARIATION" TherrMobile/main/config/brandConfig.ts 2>&1
grep -n "versionCode\|versionName" TherrMobile/android/app/build.gradle 2>&1
node -e "console.log(JSON.stringify(require('./TherrMobile/app.json'), null, 2))" 2>&1
```

### P1 — Brand, branch, and package identity agree (BLOCKER)

Three things encode which app is being built, and they must tell the same story:

| Brand | Branch | `CURRENT_BRAND_VARIATION` | Android applicationId |
|---|---|---|---|
| therr | `general` (or `niche/THERR-*` if present) | `BrandVariations.THERR` | `app.therrmobile` |
| habits | `niche/HABITS-general` | `BrandVariations.HABITS` | `com.therr.habits` |
| teem | `niche/TEEM-general` | `BrandVariations.TEEM` | `com.therr.teem` |

(Source of truth for the applicationId mapping is `_bin/switch-brand.sh`; re-read it rather than trusting this table if they disagree.)

Mismatch is a **BLOCKER**. Building `general`'s brandConfig from a habits branch produces an app that ships Therr branding under the habits listing, or sends the wrong `x-brand-variation` header and reads the wrong brand-scoped rows. Remediation is `./_bin/switch-brand.sh <brand>` from the repo root, then re-run this skill — the script also kills Metro and clears its caches, which is required for the change to take.

### P2 — Working tree is clean (BLOCKER)

Uncommitted changes mean the artifact cannot be reproduced from a commit. Report `git status --short` and stop. Untracked files that are gitignored build inputs (`.env`, `android/app/google-services.json`) are expected and are **not** a blocker — call them out separately in P3.

### P3 — Build secrets present (BLOCKER for a local build only)

`android/app/google-services.json` is deliberately not committed. For a **local** release build it must exist on disk; for an **EAS** build it is injected by the `eas-build-pre-install` script from `$GOOGLE_SERVICES_JSON`, and its absence locally is correct.

```bash
ls TherrMobile/android/app/google-services.json TherrMobile/.env 2>&1
```

Determine which path the user is on and only block on the one that applies. `.env` must supply `GOOGLE_APIS_ANDROID_KEY` and `GOOGLE_APIS_IOS_KEY` — `react-native-dotenv` runs with `allowUndefined: false`, so a missing key is a build failure, not a runtime one.

---

## Step 2: Version checks

### P4 — versionCode bumped and monotonic (BLOCKER)

Google Play rejects an upload whose `versionCode` is less than or equal to any previously published one. Compare the working value against the last released state:

```bash
grep -n "versionCode\|versionName" TherrMobile/android/app/build.gradle 2>&1
git log -20 --oneline -L '/versionCode/,+1:TherrMobile/android/app/build.gradle' 2>&1 | head -40
```

Confirm:
- `versionCode` is strictly greater than the value on the last release commit.
- `versionName` was bumped too if this is a user-visible release. A `versionCode` bump with a stale `versionName` ships a build users cannot identify in a bug report.
- The bump is committed (P2 covers this, but state it explicitly here — an uncommitted version bump is the single most common near-miss).

For **iOS**, `Info.plist` uses `$(MARKETING_VERSION)` / `$(CURRENT_PROJECT_VERSION)`, so the real values live in the Xcode project rather than the plist. Report that these must be checked in Xcode; do not attempt to parse `project.pbxproj`.

### P5 — Play release notes exist for this versionCode (WARN)

Release notes live in the Fastlane `supply` layout and are pushed by `_scripts/populate-play-release-notes.mjs` after EAS submit:

```bash
ls TherrMobile/fastlane/metadata/android/*/changelogs/ 2>&1
npm --prefix TherrMobile run play:release-notes:dry 2>&1 | tail -20
```

A per-versionCode file (`<versionCode>.txt`) is preferred; `default.txt` is the fallback and shipping it means users see generic notes. Locales present are `en-US`, `es-419`, `fr-CA` — notes missing for a locale that has app translations is a **WARN**, not a blocker.

The dry run exits 0 without credentials by design, so treat a "no credentials" message as informational rather than a failure.

---

## Step 3: Native integrity

### P6 — patch-package patches match installed versions (BLOCKER)

Patches are keyed by exact version. A version bump leaves the patch either silently unapplied or failing `postinstall`, and one of these patches is load-bearing for Play acceptance.

```bash
node -e "
const fs=require('fs');
let lock={}; try { lock=(require('./TherrMobile/package-lock.json').packages)||{}; } catch (e) {}
fs.readdirSync('TherrMobile/patches').filter(f=>f.endsWith('.patch')).forEach(f=>{
  const base=f.replace(/\.patch$/,'');
  const i=base.lastIndexOf('+');
  const name=base.slice(0,i).replace(/\+/g,'/');
  const pinned=base.slice(i+1);
  let actual=null, src='installed';
  try { actual=require('./TherrMobile/node_modules/'+name+'/package.json').version; } catch (e) {
    const e2=lock['node_modules/'+name]; actual=e2&&e2.version; src='lockfile';
  }
  const status=!actual?'MISSING':(actual===pinned?'ok   ':'DRIFT');
  console.log(status+'  '+name+'  patch='+pinned+'  '+src+'='+(actual||'not found'));
});" 2>&1
```

Run from the repo root. It prefers the installed version and falls back to the lockfile's resolved version. **Do not compare against the range in `package.json`** — `react-native-tab-view` is declared `^3.3.0` and resolves to `3.5.2`, so a range comparison reports drift that isn't there.

Any `DRIFT` is a blocker. `MISSING` means the patch targets a package that is no longer a dependency — delete the patch file. The `react-native` patch specifically neutralizes `StatusBarModule`'s references to the deprecated Android 15 status-bar color getter/setter. If `react-native` was bumped, the patch **must be regenerated** — edit the installed `StatusBarModule.kt`, run `npx patch-package react-native` from `TherrMobile/`, and re-verify against the Play Console pre-launch report. Carrying the old patch forward means the deprecated reference returns to the bytecode.

### P7 — No deprecated Android 15 window APIs (BLOCKER)

The Play Console pre-launch report flags any bytecode reference to these, and API 36 is the target:

```bash
grep -rn "setStatusBarColor\|getStatusBarColor\|setNavigationBarColor\|getNavigationBarColor" TherrMobile/android TherrMobile/main 2>&1
```

Expected clean result: no hits in `TherrMobile/android/**` app sources and none in JS. `EdgeToEdgeModule.kt` deliberately avoids the nav-bar color getters/setters — it only toggles `setDecorFitsSystemWindows` and `isNavigationBarContrastEnforced`. Any new hit is a blocker.

Also check that JS is not setting bar styling through the wrong API:
```bash
grep -rn "StatusBar" TherrMobile/main --include=*.tsx --include=*.ts 2>&1 | grep -v "BaseStatusBar\|SystemBars" | head -20
```
`StatusBar` imported from `react-native` for styling is a finding — use `SystemBars` from `react-native-edge-to-edge` or the `BaseStatusBar` wrapper.

### P8 — Native config invariants (WARN)

```bash
grep -n "minSdkVersion\|compileSdkVersion\|targetSdkVersion" TherrMobile/android/build.gradle 2>&1
grep -n "windowSoftInputMode\|android:theme" TherrMobile/android/app/src/main/AndroidManifest.xml 2>&1
grep -rn "Theme.EdgeToEdge" TherrMobile/android/app/src/main/res/values/styles.xml 2>&1
```

Confirm nothing regressed: `AppTheme` still inherits `Theme.EdgeToEdge`, `windowSoftInputMode` is still `adjustResize`, and `targetSdkVersion` matches what the Play listing expects. A change to any of these since the last release is worth a line in the report even when it's intentional — these three have each caused a layout regression that only appeared on device.

Also diff the manifest permissions against the last release. A **newly added permission** triggers a fresh Play review and may require a declaration form:
```bash
git diff HEAD~1 -- TherrMobile/android/app/src/main/AndroidManifest.xml 2>&1
```
Widen the range as needed to reach the previous release commit.

---

## Step 4: Code quality gates

Run these in parallel from the repo root:

```bash
npm run locales:check 2>&1
npm run pr:tsc-baseline:mobile 2>&1
npm run pr:test:unit:mobile 2>&1
npm --prefix TherrMobile run lint 2>&1
```

### P9 — Locale parity (BLOCKER)

`locales:check` covers `TherrMobile/main/locales` against `en-us`, `es`, `fr-ca`. A missing key renders a raw key string to a non-English user in a shipped build with no way to hotfix. Run `/i18n-sync` to scaffold gaps; with `--fix`, do that automatically and re-run.

### P10 — TypeScript baseline (BLOCKER)

`pr:tsc-baseline:mobile` compares error identities against `TherrMobile/.tsc-baseline` and fails only on signatures not already recorded. Plain `tsc --noEmit` reports ~104 errors inherited from the RN 0.83 upgrade and is **not** the gate. A new signature means this release introduces a type error — fix it. **Never** run `./_bin/check-mobile-tsc-baseline.sh --update` to clear a release blocker.

### P11 — Jest suite (BLOCKER)

A full green run. Pay attention to *mass* failures across unrelated suites — that signature almost always means a native module is being reached at import time without a mock, which is also a runtime crash risk on an unrebuilt device. `/mobile-dep-guard` diagnoses it.

### P12 — Lint (BLOCKER)

Zero errors. With `--fix`, run `npm --prefix TherrMobile run lint:fix` first, then re-check.

---

## Step 5: Runtime sanity checks

### P13 — Feature flags and environment (WARN)

```bash
grep -n "featureFlags" -A 30 TherrMobile/env-config.js 2>&1
```

Confirm the flag set matches the brand being shipped — a flag enabling a tab whose screens aren't in this variant renders an empty or crashing route. `main/utilities/validateFeatureFlags.ts` has a test suite (`__tests__/utilities/validateFeatureFlags.test.ts`); if it passed in P11, the shape is valid, but shape validity is not intent. Report the enabled set so the user can eyeball it.

Also confirm production API hosts are what you expect (`api.therr.com`, `websocket-service.therr.com`) and that no dev override was left in place. `main/utilities/getConfig.ts` selects on `__DEV__`, so a release build should never reach a `localhost` or `10.0.2.2` host — a hardcoded dev URL outside that selector is a **BLOCKER**.

### P14 — Backend compatibility of new API calls (WARN)

If mobile code in this release calls an endpoint or reads a response field added on `general` since the last backend deploy, the app ships before the API supports it. List endpoints referenced by files changed since the last release tag and confirm each exists in `therr-api-gateway/src/`:

```bash
git diff --name-only <last-release-ref> -- TherrMobile/main 2>&1
```

Report anything you cannot confirm rather than guessing — this is a judgment call the user should make, and the deploy-order requirement (backend first) belongs in the follow-ups from Step 6.

---

## Step 6: Verdict and follow-ups

### Record post-release manual steps

Anything a human must do after the build uploads — Play Console declaration forms for a new permission, a Search Console or listing update, a backend deploy that must land first, a `.env`/EAS secret rotation — goes into `docs/WORK_IN_PROGRESS.md` immediately before the `<!-- skill-followups:end -->` marker:

```
- [ ] (YYYY-MM-DD, /mobile-release-preflight) <action> — <why>
```

Read the file first and match on action text so items aren't duplicated. Skip entirely if there are none.

### Report

```
## Mobile Release Preflight — <brand> / <platform>

VERDICT: NO-GO  (2 blockers)

Release identity
  Brand:        habits          (brandConfig.ts: BrandVariations.HABITS)
  Branch:       niche/HABITS-general
  Package:      com.therr.habits
  Version:      versionCode 445 → versionName 3.12.6
  Tree:         clean

### Blockers
  [P6] patch drift — patches/react-native+0.83.6.patch vs installed 0.84.0.
       Regenerate before building; the patch removes the deprecated Android 15
       status-bar color references the Play pre-launch report flags.
       cd TherrMobile && npx patch-package react-native
  [P9] locale parity — 3 keys missing in fr-ca (main/locales/fr-ca/...).
       Run /i18n-sync, or re-run this skill with --fix.

### Warnings
  [P5] fr-CA changelog missing for versionCode 445 — will fall back to default.txt.
  [P13] featureFlags enables `groups` tab; confirm intended for habits.

### Passed
  P1 identity · P2 clean tree · P3 secrets · P4 version bump · P7 deprecated APIs
  P8 native config · P10 tsc baseline · P11 Jest (<N> suites) · P12 lint · P14 API calls

### Post-release follow-ups (added to docs/WORK_IN_PROGRESS.md)
  - Backend deploy of general→stage→main must land before this build is promoted
    from internal to production (uses POST /v1/habits/pacts/digest).
```

**GO** requires zero blockers. Warnings do not block, but list every one — the user decides. Never soften a blocker into a warning to reach GO.

---

## Rules

- **Never bump a version number yourself.** Report the required bump; the value is the user's call and it must be a deliberate, committed change.
- **Never regenerate a patch automatically** — it requires editing installed sources and a native rebuild to verify.
- **Never update the mobile tsc baseline** to clear a blocker.
- **Never run `./_bin/switch-brand.sh` without asking** — it rewrites `brandConfig.ts` and kills Metro. Report the command instead.
- **Never start an EAS or Gradle build from this skill.** This is a gate, not a build runner.
- If the user overrides a blocker and ships anyway, say so plainly once, record it in the follow-ups, and do not repeat the objection.
