---
name: i18n-sync
description: Verify translation dictionaries are in parity across all locales for a package, and flag hardcoded locale strings in code that matches against translated text. Enforces the CLAUDE.md rule "never add a key to one dictionary without adding it to all others".
user-invocable: true
allowed-tools: Bash(git diff*), Bash(git status*), Bash(jq*), Bash(find *), Bash(diff*), Read, Glob, Grep, Edit
argument-hint: [check|scaffold|--package <name>] [--fix-stubs] [--changed-only]
---

# i18n Sync

Enforce translation dictionary parity across locales. The codebase supports **3 locales** (`en-us`, `es`, `fr-ca`) in every i18n-capable package. CLAUDE.md mandates: "never add a key to one dictionary without adding it to all others in that package." This skill catches divergence and optionally scaffolds missing keys.

## Locale Dictionary Map

| Package | Dictionary paths |
|---------|------------------|
| `therr-client-web` (frontend) | `therr-client-web/src/locales/{en-us,es,fr-ca}/dictionary.json` |
| `TherrMobile` (frontend) | `TherrMobile/main/locales/{en-us,es,fr-ca}/dictionary.json` |
| `therr-services/users-service` (backend — in-app notifications) | `therr-services/users-service/src/locales/{en-us,es,fr-ca}/dictionary.json` |
| `therr-services/push-notifications-service` (backend — push) | `therr-services/push-notifications-service/src/locales/{en-us,es,fr-ca}/dictionary.json` |

Note: push-notifications-service may only ship `en-us` and `fr-ca` today — check before reporting `es` as missing.

## Mode Selection

| Argument | Mode |
|----------|------|
| `check` or _(no argument)_ | Compare dictionaries, report missing/extra keys per package |
| `scaffold` | Insert stub entries (copied from `en-us`, prefixed with `[ES]` / `[FR]`) for missing keys |
| `--package <name>` | Limit to a single package (see map above) |
| `--changed-only` | Only check packages whose `dictionary.json` files appear in `git diff HEAD` |
| `--fix-stubs` | With `check`: also audit translated values that still contain the `[ES]`/`[FR]` stub prefix |

---

## Mode 1: Check (default)

### Step 1: Select packages

- `--package <name>` → just that package.
- `--changed-only` → `git diff --name-only HEAD` and any `git status --short` paths, filter to paths containing `/locales/` and `dictionary.json`; derive packages.
- Default → all four packages in the map.

### Step 2: For each package, diff the key sets

Use `jq` to extract keys (including nested) from each locale's `dictionary.json`:

```bash
jq -r 'paths(scalars) | map(tostring) | join(".")' <file> | sort
```

Use `en-us` as the source of truth. For each other locale in the package:
- **Missing in locale** = keys present in `en-us` but absent in the other locale.
- **Extra in locale** = keys present in the other locale but absent in `en-us` (may indicate a renamed key or a stale entry).

### Step 3: Hardcoded locale-match audit

Check `TherrMobile/main/routes/Notifications/Notification.tsx` — specifically `getHighlightValues()` — for string literals that look like English notification text. If a new key was added to `therr-services/users-service/src/locales/en-us/dictionary.json` that maps to a notification the client highlights, the matcher needs **all three locale variants** of the substring, not just English.

Grep pattern to find candidate sites:
```bash
grep -n "'you'\|'your '\|'invited'\|'accepted'" TherrMobile/main/routes/Notifications/Notification.tsx
```

Flag every hardcoded English phrase and remind the developer to mirror it in `es` and `fr-ca` using the translated values from the backend locale dictionaries.

### Step 4: Report

**If all packages are in parity:**
```
✓ i18n sync passed — 4 package(s), 12 dictionaries, all in parity
```

**If divergence is detected:**
```
⚠ i18n drift detected

therr-client-web
  Missing in es/dictionary.json (2):
    onboarding.welcome.title
    onboarding.welcome.body
  Missing in fr-ca/dictionary.json (1):
    onboarding.welcome.body
  Extra in es/dictionary.json (1):
    onboarding.old_title  ← possible stale key or rename

TherrMobile
  ✓ in parity

therr-services/users-service
  Missing in fr-ca/dictionary.json (3):
    notifications.pactInvite.title
    notifications.pactInvite.body
    notifications.pactInvite.cta

Hardcoded English matches in TherrMobile/main/routes/Notifications/Notification.tsx:
  Line 142: "'invited you'" — needs es ("te invitó") and fr-ca ("t'a invité") variants
  See therr-services/users-service/src/locales/<locale>/dictionary.json for translated values.

Fix: run `/i18n-sync scaffold` to stub missing keys, then replace stubs with real translations.
```

---

## Mode 2: Scaffold

Use after `check` reports missing keys. For each missing key in a locale:
1. Read the value from that package's `en-us/dictionary.json`.
2. Insert the key at the same path in the target locale with a prefixed stub: `"[ES] <english value>"` or `"[FR] <english value>"`.
3. Preserve JSON structure, key order (best effort), and trailing newline.

Use `Edit` with `replace_all: false` to add each key in context, or rewrite the file with `Write` if multiple keys need insertion in structured locations. Do NOT insert into push-notifications-service `es/` if it doesn't exist — report that as a structural decision needing human input.

After scaffolding, print:
```
Scaffolded 5 stub translations. Replace [ES] / [FR] prefixes with real translations before merging.
Stubs written:
  therr-client-web/src/locales/es/dictionary.json: 2 keys
  therr-client-web/src/locales/fr-ca/dictionary.json: 1 key
  therr-services/users-service/src/locales/fr-ca/dictionary.json: 3 keys - 1 existing = 2 keys
```

---

## Mode 3: --fix-stubs audit (additive)

When run with `--fix-stubs`, additionally scan for values that still start with `[ES]` or `[FR]` — these are untranslated stubs from a previous scaffold. Report them so they can be translated before release.

---

## Rules

- **Never translate values yourself.** You do not know the target languages well enough to produce production translations. Always stub with a clearly-marked prefix and defer to a human or translation service.
- Treat `en-us` as canonical. If keys are only in `es` or `fr-ca`, surface them as drift — do not add them to `en-us` automatically.
- Do not touch generated files or `index.ts` exports unless the dictionary format requires it.
- On push-notifications-service, confirm which locales actually exist before reporting missing ones — the service may legitimately ship fewer locales than the others.
- This skill only reads and (in `scaffold` mode) writes dictionary JSON. It does not commit.
