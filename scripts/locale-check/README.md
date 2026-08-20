# locale-check

Validates the monorepo's locale dictionaries in two phases:

1. **Key parity** — every locale has the same keys as its base locale (`en-us`).
   Prevents silent translation drift, where a new key is added to
   `en-us/dictionary.json` and forgotten in `es/` or `fr-ca/`.
2. **Referenced-key existence** — every key passed to `translate()` in the
   package's source resolves to a string in the base dictionary.

Phase 2 exists because phase 1 structurally cannot catch it: a key that is absent
from *all* locales is in perfect parity. It still ships broken —
`configureTranslator` returns the key path itself when it resolves nothing, so the
user reads `errorMessages.habitGoals.nameRequired` where a sentence belongs.

Zero runtime dependencies (Node builtins only), so this can run in CI before
`npm install` completes.

## Usage

From the repo root:

```bash
npm run locales:check                           # check all configured packages
node scripts/locale-check/index.js              # same thing
node scripts/locale-check/index.js --target=TherrMobile
node scripts/locale-check/index.js --verbose    # print every offending key, not just the first 10
node scripts/locale-check/index.js --warn-as-error
```

Exit codes:

| Code | Meaning                                                                        |
|-----:|--------------------------------------------------------------------------------|
| `0`  | All checked packages pass both phases.                                         |
| `1`  | A non-base locale is missing keys, or source references an undefined key.      |
| `2`  | Configuration error (bad config file, missing base dictionary or `srcDir`).    |

## What it checks

For each entry in `package-targets.json`:

1. Loads `<baseDir>/<baseLocale>/dictionary.json` as the source of truth.
2. Walks the JSON recursively and collects every leaf key path
   (e.g. `notifications.connectionRequestAccepted.title`).
3. For every other locale listed in `expectedLocales`, loads its
   `dictionary.json` and collects the same set.
4. Walks `<srcDir>` for `.ts`/`.tsx` files (skipping `node_modules/` and
   `locales/`) and collects every key passed to a `translate()` call, in both
   shapes used here: `translate('a.b.c')` and `translate(locale, 'a.b.c')`.
5. Reports:
   - **ERROR** — keys in base locale missing from the other locale.
   - **ERROR** — keys referenced by `translate()` that do not resolve to a string
     in the base dictionary, unless listed in `referenced-keys-baseline.json`.
   - **WARN** — keys in the other locale that are not in base (stale / typo).
   - **WARN** — locale directories present on disk but not listed in
     `expectedLocales` (likely a forgotten wiring-up step).
   - **WARN** — baseline entries that now resolve and should be deleted.

The `translate()` matcher is deliberately narrow. A key assembled at runtime
cannot be checked statically, and treating every dotted string literal as a
dictionary path produces false positives that make the gate untrustworthy —
so a dynamic key is simply not covered rather than wrongly flagged.

## Configuration

`package-targets.json` declares one entry per locale-bearing package:

```json
{
  "name": "TherrMobile",
  "srcDir": "TherrMobile/main",
  "baseDir": "TherrMobile/main/locales",
  "baseLocale": "en-us",
  "expectedLocales": ["en-us", "es", "fr-ca"]
}
```

If a package intentionally ships only English (e.g. the admin dashboard), list
only `en-us` and the parity check is a no-op for that package. To add a new
locale to an existing package, add the locale folder on disk and update
`expectedLocales` in the same PR — the script will then enforce parity going
forward.

## Scope and known limitations

Neither phase checks:

- That key *values* are actually translated (a duplicated English string in
  `es/dictionary.json` is valid JSON and valid key-parity). Preventing
  untranslated values requires human review or an external TMS.
- That `{{placeholder}}` and `{userName}`-style interpolation tokens match
  across locales. Still unimplemented.
- Keys referenced through anything other than a literal `translate()` argument
  — a key built at runtime, or read through a differently-named wrapper.
- The specific bug class documented in root `CLAUDE.md` where frontend code
  hardcodes English strings and matches them against *translated* server
  output (see `TherrMobile/main/routes/Notifications/Notification.tsx`
  `getHighlightValues`). That is a structural issue, not a dictionary parity
  issue; the long-term fix is to replace string matching with structured
  message metadata from the server.

## The referenced-key baseline

`referenced-keys-baseline.json` lists the misses that predated phase 2. Each entry
is a real bug that renders a raw dotted key in the UI; they are exempted rather
than fixed because they span four packages that deploy on different branches.

It is a **one-way ratchet**. Entries may be deleted — by defining the key in every
locale for that package — and never added: a new miss fails the check. An entry
that starts resolving is reported as a warning telling you to delete it, so the
baseline cannot quietly accumulate dead weight.

## CI integration

This script is intended to run in CI as an early gate (before install completes
is fine — it has no deps). See `_bin/cicd/` for where to wire it in.

Locally, consider adding to `_bin/pre-commit.sh` if the runtime (~<1s)
is acceptable.
