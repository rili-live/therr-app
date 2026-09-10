---
name: mobile-dep-guard
description: Verify the full wiring matrix when a TherrMobile dependency is added, upgraded, or removed — which package.json owns it, Metro resolution and singleton blocking, Babel and tsconfig aliases, Jest mocks and transform patterns, patch-package version drift, and whether a native rebuild or pod install is required. Catches the module-resolution failures that only surface at runtime on device.
user-invocable: true
allowed-tools: Bash(git*), Bash(npm*), Bash(npx*), Bash(node*), Bash(ls*), Read, Glob, Grep, Edit
argument-hint: [<package-name>] [--audit] [--dry-run]
---

# Mobile Dependency Guard

TherrMobile has its own `package.json` inside a monorepo whose root also has one, and Metro, Babel, TypeScript, and Jest each resolve modules by their own rules. A dependency wired into four of those five places builds fine and fails on device with `undefined is not a function`. Every entry in `TherrMobile/CLAUDE.md`'s "Common Debugging" list is a symptom of this.

Run this skill whenever a mobile dependency changes — added, upgraded, removed, or moved between package.json files — and after any `react-native` version bump.

**`<package-name>`**: audit one package specifically.
**`--audit`**: sweep the whole dependency wiring for drift, ignoring the diff. Use after a large upgrade.
**`--dry-run`**: report only, change nothing.

---

## Step 1: Identify what changed

```bash
git diff --name-only HEAD -- TherrMobile/package.json TherrMobile/package-lock.json package.json package-lock.json TherrMobile/patches TherrMobile/metro.config.js TherrMobile/babel.config.js TherrMobile/jest.config.js TherrMobile/tsconfig.json 2>&1
git diff HEAD -- TherrMobile/package.json package.json 2>&1
```

Extract the added / removed / version-changed package names. If a package name was given as an argument, use that instead. If nothing changed and `--audit` was not passed:

```
ℹ No mobile dependency changes detected. Pass a package name or --audit to sweep.
```
Stop.

For each package under review, classify it — the classification decides which checks apply:

| Class | How to tell | Checks |
|---|---|---|
| **Native** | ships `android/` or `ios/` dirs, or a `*.podspec` | W1–W7 |
| **Singleton-sensitive** | React, React Native, Redux, react-redux, @reduxjs/toolkit, axios, react-navigation, anything with a Context or global registry | W1, W2, W3, W6 |
| **Pure JS** | neither of the above | W1, W4, W5, W6 |

Check the class with:
```bash
ls TherrMobile/node_modules/<pkg>/ 2>&1 | head -20
node -e "const p=require('./TherrMobile/node_modules/<pkg>/package.json'); console.log(p.version, Object.keys(p).filter(k=>/react-native|codegen|exports|main|module/.test(k)).join(','))" 2>&1
```

---

## Step 2: Run the wiring checks

### W1 — Which package.json owns it

The rule is not "put everything in one place":

- **Anything mobile imports at runtime belongs in `TherrMobile/package.json`.** Metro's `nodeModulesPaths` reaches the root as a fallback, but a native package resolved from the root will not autolink.
- **React, `react-native`, `react-dom`, `redux`, `react-redux`, `@reduxjs/toolkit` must resolve to `TherrMobile/node_modules`.** `metro.config.js` explicitly *blocklists* the root copies (`blockList`) and pins each to the local one (`extraNodeModules`). A second copy means two Reacts, and hooks throw "Invalid hook call" or Redux silently reads a different store.
- **`axios` is the deliberate exception** — it is pinned to the *root* copy, forced through a single CJS file, because its `exports` map yields two singletons and interceptors then fire on only one of them.
- **Shared-library deps** (things `therr-react` / `therr-js-utilities` need) belong in the **root** `package.json`. Mobile consumes those libraries as compiled `lib/`.

Flag: a singleton-sensitive package added to root instead of `TherrMobile`; a native package added to root; a duplicate present in both.

Confirm the actual resolution rather than trusting the manifest:
```bash
npm --prefix TherrMobile ls <pkg> 2>&1 | head -20
npm ls <pkg> 2>&1 | head -20
```
Two entries at different versions for a singleton-sensitive package is a **blocker**.

### W2 — Metro (`TherrMobile/metro.config.js`)

For a new singleton-sensitive package, check whether it needs:
- an `extraNodeModules` entry pinning it to `TherrMobile/node_modules/<pkg>`,
- a `blockList` regex excluding the root copy,
- a `resolveRequest` branch, if the package's `exports` map splits CJS and ESM into separate files (the `axios` and `use-latest-callback` precedent).

The `exports`-split tell: `require` and `import`/`default` conditions point at different files. Check it:
```bash
node -e "const p=require('./TherrMobile/node_modules/<pkg>/package.json'); console.log(JSON.stringify(p.exports, null, 2))" 2>&1
```
If `require` and `default` resolve to different files **and** the package holds module-level state (a client instance, an interceptor list, a registry), it needs a `resolveRequest` pin. If it is stateless, it does not.

Also: a package that lives outside `TherrMobile/node_modules` and outside the root — e.g. nested under another package, as `expo-modules-core` is — needs an explicit `extraNodeModules` path, and a `watchFolders` entry if Metro must watch its sources.

### W3 — Babel (`TherrMobile/babel.config.js`)

Two invariants, both of which fail loudly and confusingly when broken:

- **`react-native-worklets/plugin` must remain last** in the plugins array. Any new plugin goes *before* it.
- **`babel-plugin-react-compiler` runs first**, in annotation mode — it only memoizes components whose body opens with a `"use memo"` directive. A new plugin inserted ahead of it changes what it sees.

If the package requires its own Babel plugin (Reanimated-style), place it accordingly and say so in the report. If the package needs a path alias, add it to the `module-resolver` `alias` map — but note that `resolvePath` there also redirects every `react-native` import to `resolver/react-native/` for deprecated prop-type shims; a package that imports `react-native` internals may need exclusion from that redirect.

If the package reads env vars, they must be added to the `react-native-dotenv` `allowlist` — `allowUndefined: false` means an unlisted var is a build error, not a silent undefined.

### W4 — TypeScript (`TherrMobile/tsconfig.json`)

Only needed for packages resolved through an alias rather than `node_modules`. The `paths` map covers `shared/*`, `therr-react/*`, `therr-styles/*`, `therr-js-utilities/*`. A new alias in Metro or Babel without the matching `paths` entry type-checks as `any` at best and errors at worst.

Note `"moduleResolution": "bundler"` with `"customConditions": ["react-native"]` — a package whose types only publish under a `node`/`browser` condition will not resolve its types here even though Metro bundles it fine. When that happens, the fix is a `paths` entry pointing at the type file, not loosening the compiler options.

### W5 — Jest (`TherrMobile/jest.config.js` + `__mocks__/`)

The check that saves the most time. A package that touches native code at import time throws under Jest and **fails every suite that transitively imports it**, which reads as an unrelated mass failure.

For a new native or native-adjacent package, verify:
- a `moduleNameMapper` entry pointing at a file in `TherrMobile/__mocks__/`,
- that the mock file exists and exports the surface the app actually uses,
- an anchored pattern (`'^<pkg>$'`) when the package name is a prefix of others — the existing entries use anchors deliberately,
- `transformIgnorePatterns` includes the package if it ships untranspiled ESM. The current pattern allow-lists `react-native*`, `@react-native*`, `@react-navigation`, `react-redux`, and `validator/es/lib/*`; anything else shipping ESM must be added or Jest fails on `import` syntax.

The four packages already mocked — `react-native-audio-api`, `react-native-haptic-feedback`, `react-native-keyboard-controller`, `react-native-edge-to-edge` — each earned their entry by breaking the suite. Assume a new JSI package will too.

Verify empirically rather than by inspection:
```bash
npm run pr:test:unit:mobile 2>&1 | tail -30
```

### W6 — patch-package (`TherrMobile/patches/`)

Patches are keyed by exact version: `<pkg>+<version>.patch`. When the package version moves, the patch **silently stops applying** (or fails `postinstall` loudly, depending on the drift). Cross-check every patch filename against the installed version:

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

Run it from the repo root. It prefers the installed version and falls back to the lockfile's resolved version, so it works before `npm install` too. **Do not compare against the range in `package.json`** — `react-native-tab-view` is declared `^3.3.0` and resolves to `3.5.2`, so a range comparison reports drift that isn't there.

Any `DRIFT` line is a blocker. `MISSING` means the patched package is no longer a dependency at all — the patch file is dead and should be deleted. For `react-native` specifically the patch is load-bearing for release: it neutralizes `StatusBarModule`'s references to the deprecated Android 15 status-bar color getter/setter, which the Play Console pre-launch report flags. **On a `react-native` bump the patch must be regenerated**, not carried forward — edit the installed `StatusBarModule.kt`, run `npx patch-package react-native` from `TherrMobile/`, and re-verify against the Play Console report.

### W7 — Native build requirements

A native package means the JS-only workflow is no longer sufficient. Determine and report which of these the user must do:

- **iOS**: `npm run ios:pod:install` (or `ios:clean` if the pod graph shifted). A native package added without a pod install fails at link time or, worse, resolves to a stale pod.
- **Android**: rebuild — `npm run android` is enough for autolinking; `npm run android:clean` first if the package ships native code that Gradle caches (`.cxx`, `build/generated/autolinking`).
- **New Architecture**: this app runs the new architecture. A package with no Fabric/TurboModule support, or an old `react-native.config.js` shape, will fail at build or fall back to the interop layer with degraded behavior. Check the package's own README/`package.json` `codegenConfig` and report the finding — do not attempt to shim it.
- **Metro cache**: after any resolution config change, the cache must be cleared or the old resolution persists. `./_bin/switch-brand.sh` does this as a side effect; otherwise `npm start -- --reset-cache`.

### W8 — Branch placement

`TherrMobile/package.json` may live on a `niche/*` branch. **Root `package.json` and `package-lock.json` may not** — per CLAUDE.md they must land on `general` to ever ship. If the change touches both, it must be split into two commits on two branches.

```bash
git branch --show-current 2>&1
git diff --cached --name-only 2>&1
```

Flag the violation and point at `/branch-guard`. Do not split the commit automatically.

---

## Step 3: Apply fixes (skip if `--dry-run`)

Fix mechanically-determined wiring gaps: a missing `moduleNameMapper` entry with a mock you can write from the package's actual usage in `main/**`, a missing `tsconfig` `paths` entry matching an existing Metro alias, a missing `transformIgnorePatterns` entry, a `dotenv` allowlist addition.

Do **not** auto-apply:
- Moving a dependency between package.json files (changes the lockfile and requires an install).
- Regenerating a patch (requires editing installed sources and a native rebuild).
- Adding a `resolveRequest` branch (the singleton diagnosis needs a human's read on whether the module holds state).

Report those with the exact command to run.

When writing a Jest mock, mirror the existing ones in `TherrMobile/__mocks__/` — export only what `main/**` actually imports, keep it a plain object/jest.fn surface, and add the one-line comment explaining *why* the mock exists, as the current entries in `jest.config.js` do. A mock without that comment gets deleted by someone six months from now.

---

## Step 4: Verify

```bash
npx eslint TherrMobile/metro.config.js TherrMobile/babel.config.js TherrMobile/jest.config.js --no-error-on-unmatched-pattern 2>&1
npm run pr:tsc-baseline:mobile 2>&1
npm run pr:test:unit:mobile 2>&1
```

A green Jest run is the strongest available signal that resolution is intact — it exercises `moduleNameMapper`, `transformIgnorePatterns`, and the mocks together. It does **not** exercise Metro. For a native or singleton-sensitive change, tell the user that a device/emulator run is still required, and that `/android-debug` will surface the resulting errors cheaply.

---

## Step 5: Report

```
## Mobile Dependency Guard

Packages reviewed: <pkg@version, ...>  (class: native | singleton-sensitive | pure JS)

### Blockers
  [W6] react-native patch drift — patches/react-native+0.83.6.patch vs installed 0.84.0.
       The patch neutralizes StatusBarModule's deprecated Android 15 color APIs; carrying
       it forward un-regenerated will fail the Play Console pre-launch report.
       Fix: cd TherrMobile && npx patch-package react-native  (after editing the installed
       StatusBarModule.kt), then re-run this skill.

### Wired automatically
  [W5] jest.config.js — added anchored moduleNameMapper for react-native-foo
       + __mocks__/react-native-foo.ts (getEnforcing at import time).

### Action required from you
  [W7] iOS: npm run ios:pod:install   — react-native-foo ships a podspec.
  [W7] Android: npm run android:clean && npm run android
  [W7] Metro: npm start -- --reset-cache  (resolution config changed)

### Verified clean
  W1 ownership · W2 Metro resolution · W3 Babel plugin order · W4 tsconfig paths · W8 branch

### Verification
  tsc baseline: ✓ no new signatures
  Jest:         ✓ <N> suites passed
  Note: Jest does not exercise Metro. A device run is still required for this change.
```

---

## Rules

- **Never run `npm install` in `TherrMobile` without `--legacy-peer-deps`** — the peer graph does not resolve otherwise. (Docker builds are the exception; they don't use it.)
- **Never remove a `blockList` entry or an `extraNodeModules` pin** to make something resolve. Those exist to prevent duplicate singletons; deleting one trades a build error for a runtime one.
- **Never regenerate a patch automatically.**
- **Never move `react-native-worklets/plugin` off the end** of the Babel plugins array.
- **Never update the mobile tsc baseline** to clear a failure.
- Report native build steps as instructions — do not attempt pod install or a Gradle build from this skill.
- Do not commit unless the user asks.
