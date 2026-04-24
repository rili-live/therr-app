---
name: db-migration-scaffold
description: Generate Knex migration files in the correct service and schema per docs/NICHE_APP_DATABASE_GUIDELINES.md. Enforces schema isolation (main.* core, habits.* / <niche>.* for niche features), correct naming convention, and up/down symmetry. Prevents the highest-cost mistake class in the backend — putting niche-specific tables on the main schema.
user-invocable: true
allowed-tools: Bash(git status*), Bash(find *), Bash(date*), Bash(ls *), Read, Write, Edit, Grep
argument-hint: [scaffold --service <svc> --schema <schema> --table <name> [--feature <niche>]] | [lint] | [explain]
---

# DB Migration Scaffold

Generate Knex migrations that follow the conventions in `docs/NICHE_APP_DATABASE_GUIDELINES.md`. The highest-cost mistake in this backend is adding a niche-specific table to `main.*`, or adding niche columns to a shared table — both pollute all brand variants with another brand's feature and are painful to undo once data lands.

## Migration locations

| Service | Migrations dir |
|---------|---------------|
| `users-service` | `therr-services/users-service/src/store/migrations/` |
| `maps-service` | `therr-services/maps-service/src/store/migrations/` |
| `messages-service` | `therr-services/messages-service/src/store/migrations/` |
| `reactions-service` | `therr-services/reactions-service/src/store/migrations/` |
| `push-notifications-service` | `therr-services/push-notifications-service/src/store/migrations/` |
| `_template` | `therr-services/_template/src/store/migrations/` (reference only — do not write here) |

## File naming convention

Observed from the repo: `YYYYMMDDHHMMSS_<schema>.<table>_<change>.js`

Examples (real):
- `20260415000001_main.users_coinRecharge.js`
- `20260126000009_habits.pact_activities.js`
- `20260318000001_main.performance_indexes.js`
- `20211204165013_main.spaces.js`

Pattern breakdown:
- Timestamp: `YYYYMMDDHHMMSS` — use current UTC time.
- Schema: `main` for core, `habits` for HABITS niche features, etc. Only `<schema>.` — not the service name.
- Table/change: dot-separated when modifying a single table, underscore-suffixed for change description.

## Schema isolation rules (enforced)

From `docs/NICHE_APP_DATABASE_GUIDELINES.md`:

| Case | Correct placement |
|------|-------------------|
| New feature domain used only by a niche app (e.g. HABITS pacts, streaks) | **New schema** (e.g. `habits`) |
| Feature shared across all brands (e.g. reactions, notifications) | `main` |
| 1–2 columns added to `main.users` that all brands will use | `main` with default values |
| Complex relationship tables for a niche feature | **New schema** |
| Foreign key to core users table | Put the FK in the niche schema; reference `main.users(id)` |

**Blocked by default:** scaffolding a table in `main.*` when `--feature <niche>` is specified. Requires `--force` to override with a comment explaining why the feature genuinely belongs in shared space.

## Mode Selection

| Argument | Mode |
|----------|------|
| `scaffold` | Generate a new migration file |
| `lint` | Scan existing migrations for convention violations |
| `explain` | Print the isolation rules with a concrete example for the user's case |

## `scaffold` flags

| Flag | Required | Meaning |
|------|----------|---------|
| `--service <svc>` | yes | One of: `users-service`, `maps-service`, `messages-service`, `reactions-service`, `push-notifications-service` |
| `--schema <schema>` | yes | `main`, `habits`, or another niche schema name |
| `--table <name>` | yes | Table name (snake_case or camelCase to match repo norms — check neighboring migrations for which this service uses) |
| `--change <desc>` | no | Change descriptor suffix (`create`, `add_column`, `add_index`, etc). Default `create` |
| `--feature <niche>` | no | If set (e.g. `habits`, `teem`), applies the niche-isolation check |
| `--force` | no | Bypass the `main.*` + niche feature block with explicit override |

---

## Mode 1: Scaffold

### Step 1: Validate inputs

- Confirm the service directory exists under `therr-services/`.
- Confirm the migrations directory exists (it should, per the table above).
- If `--feature <niche>` is set AND `--schema == main` AND `--force` is NOT set → **refuse and explain**. Suggest `--schema <feature>` instead.
- Look at the most recent 5 migrations in the service's dir to infer table-naming style (snake_case vs camelCase). Match that style.

### Step 2: Compute the timestamp and filename

```bash
date -u +%Y%m%d%H%M%S
```

Filename: `<timestamp>_<schema>.<table>_<change>.js`.

Confirm no existing file has the same timestamp. If it does, increment by 1 second.

### Step 3: Generate the migration

For **creating a new schema** (first-ever niche migration):

```javascript
exports.up = function(knex) {
    return knex.raw('CREATE SCHEMA IF NOT EXISTS <schema>');
};

exports.down = function(knex) {
    return knex.raw('DROP SCHEMA IF EXISTS <schema> CASCADE');
};
```

For **creating a table in an existing schema**:

```javascript
exports.up = function(knex) {
    return knex.schema.withSchema('<schema>').createTable('<table>', (table) => {
        table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
        // TODO: add columns
        table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
    return knex.schema.withSchema('<schema>').dropTableIfExists('<table>');
};
```

For **add_column** on an existing table, read the latest migration touching that table and follow its style (`alterTable`, correct schema, matching column naming). Surface the reference migration to the user.

For **add_index**, use `knex.schema.withSchema('<schema>').alterTable('<table>', ...)` with `.index([...])` and ensure the `down` is symmetric via `.dropIndex([...])`.

### Step 4: Cross-reference FKs

If the new table references users, confirm the reference uses `main.users(id)` (not `users(id)`). Knex syntax:

```javascript
table.uuid('userId').notNullable().references('id').inTable('main.users').onDelete('CASCADE');
```

If the new table references another niche table, reference it in its own schema: `'<schema>.<table>'`.

### Step 5: Report

```
Created therr-services/<svc>/src/store/migrations/<timestamp>_<schema>.<table>_<change>.js

  Schema:      habits (niche — HABITS only ✓)
  Table:       pact_activities
  Change:      create
  FK to users: main.users(id) ✓

Reference migration (style match):
  therr-services/<svc>/src/store/migrations/20260126000009_habits.pact_activities.js

Next steps:
  1. Fill in TODO columns
  2. Run the migration locally: npm run migrate:latest --prefix therr-services/<svc>
  3. Verify rollback: npm run migrate:rollback --prefix therr-services/<svc>
  4. Verify the down migration is symmetric (drops what up creates)
```

---

## Mode 2: Lint

Scan every `.js` file in the six service migrations dirs. Report violations:

- **Filename format**: does it match `^\d{14}_[a-z]+\.[A-Za-z_]+.*\.js$`?
- **Schema mismatch**: does the filename schema prefix match the `withSchema('...')` or `CREATE SCHEMA` inside the file?
- **Missing `down`**: does every migration export a non-empty `down` that undoes `up`?
- **Niche table on main**: any migration whose filename starts with `main.` but whose `up` references `habits.*` or another niche schema — and vice versa.
- **Non-main table without schema prefix**: `createTable('pact_activities', ...)` without `.withSchema('habits')` would put it on the default schema; flag it.

Output a concise list per violation type.

---

## Mode 3: Explain

Given optional context (args or just current branch + recent diffs), print a short decision tree for the user:

```
Feature: HABITS pact activity logging

  Is this used only by the HABITS app?  yes
  → Use schema: habits
  → Reference main.users where needed
  → File: <timestamp>_habits.pact_activities_create.js

  If instead this were a new notification type used by all brands:
  → Use schema: main
  → File: <timestamp>_main.notifications_<descriptor>.js
```

Always link to `docs/NICHE_APP_DATABASE_GUIDELINES.md` as the authoritative reference.

---

## Rules

- **Never run migrations from this skill.** Scaffolding ≠ execution. The developer runs migrations in their environment.
- **Never use `--force` automatically.** If the user's combination of `--schema main --feature <niche>` looks wrong, refuse and explain — don't silently override.
- Do not invent column definitions beyond `id`, `createdAt`, `updatedAt`. The developer knows the feature; you don't.
- Do not modify migrations that already exist on any branch — they're append-only in practice. If the user wants to change a table, generate a new migration.
- Match the service's existing naming convention (snake_case vs camelCase columns) — inconsistency across a service is a code smell.
- This skill does not commit. It creates the file, leaves it staged or unstaged per git's default.
