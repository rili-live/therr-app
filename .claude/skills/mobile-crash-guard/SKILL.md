---
name: mobile-crash-guard
description: Audit changed TherrMobile files for the React Native failure classes that crash at runtime rather than at build time — native modules touched at import time, missing effect cleanup, unguarded navigation params and API responses, and system-bar/safe-area regressions. Fixes the safe ones, reports the rest, then verifies with the mobile tsc baseline and Jest.
user-invocable: true
allowed-tools: Bash(git*), Bash(npm*), Bash(npx*), Bash(./_bin/*), Read, Glob, Grep, Edit
argument-hint: [--all] [--dry-run] [--since <ref>]
---

# Mobile Crash Guard

TypeScript and ESLint catch almost nothing that actually crashes this app. The failures that reach users are runtime-only: a native module that throws at import time, a subscription that outlives its screen, a nav param that is undefined on a deep link, an API field that is null for a brand that doesn't populate it. This skill audits changed mobile code for exactly those classes.

Run it before finishing any change under `TherrMobile/**`. It complements `/quality-check` (lint + types) and `/android-debug` (post-hoc log triage) — this one runs *before* you build.

**`--all`**: audit the whole `TherrMobile/main` tree rather than just changed files. Slow — use for a periodic sweep, not per-change.
**`--since <ref>`**: diff against `<ref>` instead of the default.
**`--dry-run`**: report findings without editing anything.

---

## Step 1: Determine the file set

Default scope is mobile files changed versus the branch's upstream:

```bash
git branch --show-current 2>&1
git diff --name-only origin/general -- TherrMobile 2>&1
git status --short -- TherrMobile 2>&1
```

On a `niche/*` branch, diff against `origin/<current-niche-branch>` instead — on a niche branch the shared baseline is that branch's own remote, not `general`.

Union committed, staged, unstaged, and untracked paths. Keep `.ts`/`.tsx` under `TherrMobile/main/**`, plus `TherrMobile/android/**/*.kt` and `TherrMobile/ios/**` if native files changed. Drop deleted files.

If the set is empty and `--all` was not passed:
```
ℹ No changed TherrMobile files. Nothing to audit.
```
Stop.

Read each file in the set before flagging anything in it. Do not report a finding from a grep hit alone — every check below has legitimate exceptions, and a finding that turns out to be fine costs the user more than the check saved.

---

## Step 2: Run the checks

Findings are graded by what they cost when they fire:

- **CRASH** — takes down the app, a screen, or the whole Jest suite. Fix these.
- **SILENT** — no crash, wrong behavior. Wrong data, a leak, a permanently stale view. Fix these.
- **DEGRADE** — works, but janks, re-renders excessively, or misrenders on some devices. Report; fix only when the fix is local and obvious.

### C1 — Native module reached at import time (CRASH)

The single most expensive pattern in this codebase. A JSI/TurboModule package that resolves its native module at module scope throws when the native project hasn't been rebuilt, and under Jest it takes down **every suite that transitively imports the file** — not just the one under test. `react-native-audio-api`, `react-native-haptic-feedback`, `react-native-keyboard-controller`, and `react-native-edge-to-edge` each caused this and each now carries a mock in `TherrMobile/__mocks__/` wired through `jest.config.js`.

Flag a top-level `import` of a package that touches native code at import time — `TurboModuleRegistry.getEnforcing`, `NativeModules.X.something`, a JSI global, or a constructor call at module scope.

The sanctioned pattern is a lazy require inside `try`/`catch`, as in `main/utilities/rewardFeedback.ts`:

```typescript
let cached: any;
const getAudio = () => {
    if (cached !== undefined) { return cached; }
    try {
        // eslint-disable-next-line global-require
        cached = require('react-native-audio-api');
    } catch {
        cached = null; // degrade to a no-op, never a crash
    }
    return cached;
};
```

For each flagged import, check whether `jest.config.js` has a `moduleNameMapper` entry and a file under `__mocks__/`. If not, that is a second finding — see `/mobile-dep-guard`, which owns the full wiring matrix.

**Fix**: convert to lazy-require-in-try/catch when the call site can tolerate a null module (sounds, haptics, analytics, anything decorative). When it genuinely cannot (navigation, gesture handler), leave the import and report that a Jest mock is required instead.

### C2 — Effect subscriptions without cleanup (SILENT)

Every one of these returns an unsubscribe handle that must be called from the effect's cleanup:

- `navigation.addListener(...)` / `navigation.addListener('focus'|'blur'|'beforeRemove')`
- `AppState.addEventListener`
- `Keyboard.addListener`
- `Dimensions.addEventListener`
- `messaging().onMessage(...)` and other Firebase listeners
- socket.io handlers registered outside `socket-io-middleware.ts`
- `setInterval` / `setTimeout` retained across renders

Flag any of these inside `useEffect` whose callback does not return a cleanup that removes them, and any registered outside an effect entirely (module scope or render body — the latter re-registers on every render, which is the leak that compounds fastest).

Also flag an effect that calls `setState` after an `await` with no mounted/abort guard. On a screen the user can back out of mid-request this warns in dev and can write into a torn-down tree.

**Fix**: return the unsubscribe from the effect. For async, capture an `isMounted` flag or an `AbortController` and check it after the await.

### C3 — Unguarded navigation params (CRASH)

`route.params` is `undefined` when a screen is opened without params — from a push notification, a deep link, or a `navigate()` call written before a param was added. `const { spaceId } = route.params;` throws immediately.

Flag destructuring of `route.params` (or `props.route.params`) without `?.` or a default, and any `route.params.x.y` chain that assumes a nested object.

**Fix**: `const { spaceId } = route?.params ?? {};` then handle the missing case explicitly — the guard is only half the fix if the screen then renders with `undefined` where it needed an id.

### C4 — Unguarded API response access (CRASH / SILENT)

Mobile clients in the wild talk to whatever the API currently returns, including brand variations that don't populate a field. Flag `response.data.<a>.<b>` chains without optional chaining, `.map`/`.filter`/`.length` on a field that isn't guaranteed to be an array, and `JSON.parse` without a `try`.

Pay particular attention to fields added recently on the backend: a deployed app build predates them, and a *new* app build can equally predate a rollback.

**Fix**: optional chaining plus a concrete fallback (`?? []`, `?? {}`). Prefer a fallback that renders an empty state over one that renders `undefined`.

### C5 — System bars and safe area (SILENT)

Repo-specific invariants, all documented in `TherrMobile/CLAUDE.md`:

- **`StatusBar` imported from `react-native`** to set bar styling. Must be `SystemBars` from `react-native-edge-to-edge`, or the `BaseStatusBar` wrapper. Android targets API 36 where edge-to-edge is enforced.
- **Deprecated Android 15 window APIs** in changed Kotlin: `setStatusBarColor`, `getStatusBarColor`, `setNavigationBarColor`, `getNavigationBarColor`. These are no-ops under API 35+ and the Play Console pre-launch report flags any bytecode reference. This is a release blocker, not a style note.
- **`SafeAreaView` with explicit `edges`** on an authenticated screen. Those screens sit inside `Layout` (pads top) and `ButtonMenu` (pads bottom), so they want `edges={[]}`; setting edges double-pads. Explicit edges are correct only for pre-auth full-bleed screens or screens with no `ButtonMenu`.
- **`KeyboardAvoidingView` imported from `react-native`** instead of `react-native-keyboard-controller`. The built-in one misbehaves under `adjustResize` + edge-to-edge.
- **Bottom-anchored surfaces** (action sheets, footers) that hardcode bottom padding instead of using `bottomSafeAreaInset` from `main/styles/navigation/buttonMenu.ts`.

### C6 — Locale-blind text matching (SILENT)

Frontend code that pattern-matches against *translated* text silently fails for `es` and `fr-ca` users. Flag any comparison of a rendered/translated string against an English literal — `includes('liked your')`, a regex over a translated body, a `switch` on a display label.

The reference implementation is `getHighlightValues()` in `main/routes/Notifications/Notification.tsx`, which carries variants for all three locales. **Fix**: match on a stable key/enum instead; if the text really is the only signal, add the `es` and `fr-ca` variants and run `/i18n-sync`.

### C7 — List and render performance (DEGRADE)

- `FlatList`/`SectionList` with no `keyExtractor`, or a `keyExtractor` returning an index.
- `renderItem`, `ListHeaderComponent`, or `data` built inline in the render body — a new identity every render defeats the list's memoization.
- Style objects or arrays constructed inline in render rather than pulled from `main/styles/**`.
- A `VirtualizedList` nested inside a `ScrollView` of the same orientation — RN warns, and it renders every row eagerly.
- `Dimensions.get('window')` read at **module scope**. It freezes at first import, so rotation, split-screen, and foldables get stale numbers. Many existing files do this; flag it only in files this change touched, and prefer `useWindowDimensions()` in new code.

Report these. Only fix inline-arrow and missing-`keyExtractor` cases, which are local and safe.

### C8 — Storage and permission calls without failure paths (CRASH)

`AsyncStorage`, `SecureStorage` (`main/utilities/SecureStorage.ts`), and the permission helpers in `main/utilities/permissionsOrchestrator.ts` all reject in real conditions — full disk, keychain locked, permission revoked mid-session. Flag an `await` on any of them with no `catch`, and any code that treats a permission result as granted without checking it.

---

## Step 3: Apply fixes (skip if `--dry-run`)

Fix **CRASH** and **SILENT** findings. For **DEGRADE**, fix only the inline-arrow and `keyExtractor` cases from C7; report the rest.

Rules:
- Read the file before editing it.
- One finding, one minimal edit. Do not restyle, reorder imports, or "while I'm here" adjacent code.
- 4-space indent, `max-len` 160 (`eslint-config/base.js`).
- Preserve behavior for the non-failing path exactly. A guard added around a crash must not change what happens when the value is present.
- If a fix would change a screen's visible behavior in the failing case (e.g. an empty state where a crash used to be), say so in the report — that is a product decision the user may want to weigh in on.

---

## Step 4: Verify

Run these together from the repo root:

```bash
npx eslint <changed files> --fix --no-error-on-unmatched-pattern 2>&1
npm run pr:tsc-baseline:mobile 2>&1
npm run pr:test:unit:mobile 2>&1
```

`pr:tsc-baseline:mobile` is the mobile type gate — it compares error *identities* against `TherrMobile/.tsc-baseline` and fails only on signatures not already there. Plain `tsc` reports ~104 inherited errors and is not a pass/fail signal. **Never** run `./_bin/check-mobile-tsc-baseline.sh --update` to clear a failure; a new signature means this change introduced it.

If a C1 fix touched a file that suites import broadly (`App.tsx`, `Layout.tsx`, `main/utilities/**`), confirm the whole Jest run is green rather than a single suite — the failure mode being fixed is precisely one that spreads across suites.

### Consider a regression test

Add one under `TherrMobile/__tests__/**` when the fix is for a C2, C3, C4, or C6 finding and the module is testable without new native mocks — those are the classes that recur. Jest's `testRegex` only collects files under `__tests__/`, so a co-located test will never run. Match the existing layout (`__tests__/utilities/`, `__tests__/components/`, `__tests__/navigation/`). Skip the test when it would need a new native module mock; note the skip instead.

---

## Step 5: Report

```
## Mobile Crash Guard

Scope: <N> file(s) <changed vs origin/<ref> | full tree>

### Fixed
  [C3] main/routes/ViewSpace/index.tsx:44 — route.params destructured without guard;
       crashes when opened from a push notification.
  [C2] main/hooks/useProfileCompletion.ts:31 — navigation focus listener never removed.

### Reported (not fixed)
  [C7] main/routes/Areas/Nearby.tsx:88 — renderItem defined inline; re-created every
       render. Local fix, but the list also needs getItemLayout — worth a pass together.
  [C5] android/app/src/main/java/.../EdgeToEdgeModule.kt:52 — calls setNavigationBarColor.
       RELEASE BLOCKER: Play Console pre-launch flags this under API 35+.

### Verification
  ESLint:        ✓ 0 errors
  tsc baseline:  ✓ no new signatures
  Jest:          ✓ <N> suites passed
  Tests added:   __tests__/routes/ViewSpaceParams.test.tsx

### Clean
  <checks that found nothing, one line: "C1, C4, C6, C8 — no findings">
```

Lead the report with anything graded a release blocker. If everything is clean, say so in two lines — do not pad.

---

## Rules

- **Read before flagging.** Grep locates; it does not diagnose.
- **Do not touch files outside `TherrMobile/**`.** Backend or shared-library findings belong to `/quality-peer-review`; note them and move on.
- **Do not widen a fix into a refactor.** If a file needs restructuring, report it as a suggestion.
- **Do not update the tsc baseline.**
- **Respect branch rules.** `TherrMobile/**` may land on a `niche/*` branch, but if a fix pulls in a change under `therr-public-library/**` it must go to `general` as its own commit — run `/branch-guard` before committing.
- Do not commit unless the user asks; leave the working tree staged as-is.
