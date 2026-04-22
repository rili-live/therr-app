# locale-check

Validates that every locale dictionary in the monorepo has the same set of keys
as its base locale (`en-us`). Prevents silent translation drift — the case
where a new key is added to `en-us/dictionary.json` and forgotten in
`es/dictionary.json` or `fr-ca/dictionary.json`.

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

| Code | Meaning                                                           |
|-----:|-------------------------------------------------------------------|
| `0`  | All checked packages have matching keys across locales.           |
| `1`  | At least one non-base locale is missing keys present in the base. |
| `2`  | Configuration error (bad config file, missing base dictionary).   |

## What it checks

For each entry in `package-targets.json`:

1. Loads `<baseDir>/<baseLocale>/dictionary.json` as the source of truth.
2. Walks the JSON recursively and collects every leaf key path
   (e.g. `notifications.connectionRequestAccepted.title`).
3. For every other locale listed in `expectedLocales`, loads its
   `dictionary.json` and collects the same set.
4. Reports:
   - **ERROR** — keys in base locale missing from the other locale.
   - **WARN** — keys in the other locale that are not in base (stale / typo).
   - **WARN** — locale directories present on disk but not listed in
     `expectedLocales` (likely a forgotten wiring-up step).

## Configuration

`package-targets.json` declares one entry per locale-bearing package:

```json
{
  "name": "TherrMobile",
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

Phase 1 (this script) only checks **key parity**. It does **not** check:

- That key *values* are actually translated (a duplicated English string in
  `es/dictionary.json` is valid JSON and valid key-parity). Preventing
  untranslated values requires human review or an external TMS.
- That `{{placeholder}}` and `{userName}`-style interpolation tokens match
  across locales. This is a planned Phase 2 enhancement.
- That strings referenced in source code (via `t('...')`, `translator(...)`,
  `useTranslation`, etc.) actually exist in the base dictionary. Planned for
  Phase 2.
- The specific bug class documented in root `CLAUDE.md` where frontend code
  hardcodes English strings and matches them against *translated* server
  output (see `TherrMobile/main/routes/Notifications/Notification.tsx`
  `getHighlightValues`). That is a structural issue, not a dictionary parity
  issue; the long-term fix is to replace string matching with structured
  message metadata from the server.

## CI integration

This script is intended to run in CI as an early gate (before install completes
is fine — it has no deps). See `_bin/cicd/` for where to wire it in.

Locally, consider adding to `_bin/pre-commit.sh` if the runtime (~<1s)
is acceptable.
