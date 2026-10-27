---
name: db-migration-scaffold
description: Generate Knex migration files in the correct service and schema per docs/NICHE_APP_DATABASE_GUIDELINES.md. Enforces schema isolation (main.* core, habits.* / <niche>.* for niche features), correct naming convention, up/down symmetry, and non-blocking CREATE INDEX CONCURRENTLY builds on existing tables. Prevents the highest-cost mistake class in the backend — putting niche-specific tables on the main schema.
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
exports.up = async function(knex) {
    if (await knex.schema.withSchema('<schema>').hasTable('<table>')) {
        return;
    }
    await knex.schema.withSchema('<schema>').createTable('<table>', (table) => {
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

For **add_column** on an existing table, use raw SQL so the add and the drop carry their own
guards (Knex's `alterTable` builder emits neither):

```javascript
exports.up = function(knex) {
    return knex.raw(`
        ALTER TABLE <schema>."<table>"
        ADD COLUMN IF NOT EXISTS "<column>" <type> <default-or-null>
    `);
};

exports.down = function(knex) {
    return knex.raw('ALTER TABLE <schema>."<table>" DROP COLUMN IF EXISTS "<column>"');
};
```

Read the latest migration touching that table for column-naming style, and surface it to the user as the reference.

For **add_index** on an existing table, use raw SQL both ways, **always `CONCURRENTLY`** — never
`.index([...])` / `.dropIndex([...])` in an `alterTable` callback, which compile to unguarded,
blocking statements. See "Indexes are always built CONCURRENTLY" below for why every piece of
this template is required:

```javascript
// <Which query this index serves, and why it needs one.>
//
// Built CONCURRENTLY so the build does not block writes to <schema>."<table>" while it runs.
// CONCURRENTLY cannot run inside a transaction block (pg error 25001), and knex wraps every
// migration in one, so this file opts out — which means every statement below must be
// idempotent on its own.
exports.config = {
    transaction: false,
};

// A failed concurrent build leaves its index behind marked INVALID, and `IF NOT EXISTS` would
// then skip it on the retry. Drop an invalid one first — never a healthy one.
const dropInvalidIndex = async (knex, schema, indexName) => {
    const { rows } = await knex.raw(
        `SELECT 1
           FROM pg_class c
           JOIN pg_index i ON i.indexrelid = c.oid
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = ?
            AND c.relname = ?
            AND NOT i.indisvalid`,
        [schema, indexName],
    );

    if (rows.length) {
        await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS ${schema}.${indexName}`);
    }
};

exports.up = async (knex) => {
    await dropInvalidIndex(knex, '<schema>', '<idx_name>');
    await knex.raw(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS <idx_name>
        ON <schema>."<table>" ("<column>")
    `);
};

exports.down = async (knex) => {
    await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS <schema>.<idx_name>');
};
```

Reference migration (the canonical example in the repo):
`therr-services/users-service/src/store/migrations/20260727000000_main.userInterests.affinityScore.js`.

### Idempotency is a lint error, not a preference

`therr/require-idempotent-migration` fails the build on any migration dated `20260730000000`
or later whose DDL has no existence guard. A migration that dies partway through leaves the
schema half-changed with no `knex_migrations` row, so the next deploy re-runs it from the top
and fails on the half it already applied.

Never scaffold `createTableIfNotExists` as the fix for `createTable` — Knex warns against it
(it drops the follow-up ALTER statements it generates for some column types). Probe with
`hasTable` instead, as above. Full table of substitutions:
`docs/NICHE_APP_DATABASE_GUIDELINES.md` → "Idempotency (enforced by lint)".

### Indexes are always built CONCURRENTLY

**Every raw `CREATE INDEX` and `DROP INDEX` you scaffold uses `CONCURRENTLY`.**
`therr/require-concurrent-index` enforces this and the three obligations below on any migration
dated at or after `MIGRATION_CONCURRENT_INDEX_CUTOFF`. Scaffold it right the first time rather
than leaning on lint. Migrations run at deploy time against live
production tables: a plain `CREATE INDEX` holds a SHARE lock for the whole build, blocking every
INSERT/UPDATE/DELETE on the table, and a plain `DROP INDEX` takes ACCESS EXCLUSIVE, blocking
reads too. Local dev and CI tables are small, so nothing shows the stall until production.

`CONCURRENTLY` brings three obligations. Each fails at deploy time, not at lint time, so check
all three before handing the file back:

1. **`exports.config = { transaction: false }`.** `CONCURRENTLY` cannot run inside a
   transaction block (pg error 25001) and knex wraps every migration in one, so without the
   opt-out the migration fails on deploy. This applies to `down` too: use
   `DROP INDEX CONCURRENTLY IF EXISTS`, one index per statement.
2. **Every statement is individually idempotent.** Without the transaction, a failure partway
   leaves earlier statements applied and the file re-runs from the top. Any `ADD COLUMN`,
   backfill or constraint in the same file must carry its own guard. Prefer keeping an index
   migration to indexes only.
3. **Clear an INVALID index before creating it.** A concurrent build that fails (deadlock,
   cancelled session, a long transaction it could not wait out) leaves the index behind marked
   INVALID. On the retry, `IF NOT EXISTS` matches it and skips the build, so the migration
   "succeeds" with an index the planner never uses. The `dropInvalidIndex` helper in the
   template above handles this.

Further notes:

- **A brand-new table is the one exception.** Declare its indexes inside the `createTable`
  callback (`table.index([...])`, `table.unique([...])`). The table is empty and unread until
  the migration finishes, and Knex cannot emit `CONCURRENTLY` there anyway. If a new table
  needs an index the builder cannot express (an expression index), write it as raw SQL with
  `CONCURRENTLY` like any other.
- **Unique constraint on an existing table:** build `CREATE UNIQUE INDEX CONCURRENTLY IF NOT
  EXISTS` first, then attach it with `ADD CONSTRAINT <name> UNIQUE USING INDEX <idx>` inside a
  `DO $$ ... $$` block that checks `pg_constraint`. Do not use the usual
  `DROP CONSTRAINT IF EXISTS` first: on a re-run it drops the index you just built.
- A concurrent build waits for in-flight transactions on the table to finish. The migration
  connection has no statement timeout, so a long-running transaction delays the deploy instead
  of failing it. Mention this in the report for large, busy tables.
- **Never rewrite a deployed migration (one on `origin/main`) to add `CONCURRENTLY`.** It has
  already run, so the rewrite changes nothing. Converting a migration that is not yet on `main`
  is the author's call: it changes the file's transaction semantics. Keep the file name, so
  `knex_migrations` still sees the migration as unapplied.

### Step 4: Cross-reference FKs

If the new table references users, confirm the reference uses `main.users(id)` (not `users(id)`). Knex syntax:

```javascript
table.uuid('userId').notNullable().references('id').inTable('main.users').onDelete('CASCADE');
```

If the new table references another niche table, reference it in its own schema: `'<schema>.<table>'`.

### Step 4.5: Cross-repo consumer check (destructive changes on `main.*` only)

Two Cloud Functions in sibling repos query this database directly and are invisible to
this repo's lint, types, and CI. If the change **renames or drops** a column or table in
the `main` schema, grep them before scaffolding:

```bash
grep -rn "<tableOrColumn>" ~/Code/therr-messaging-automator/src/store \
                           ~/Code/therr-ai-automator/src/store
```

On a hit, do not scaffold a bare rename. Scaffold the expand half only (add the new
column), and report that the consumer repo must ship before the drop can be scaffolded.
If the sibling checkouts are not present locally, say so and flag the check as unverified
rather than assuming it's clean. Background: `docs/CROSS_REPO_INTEGRATION.md` §2.

### Step 5: Report

```
Created therr-services/<svc>/src/store/migrations/<timestamp>_<schema>.<table>_<change>.js

  Schema:      habits (niche — HABITS only ✓)
  Table:       pact_activities
  Change:      create
  FK to users: main.users(id) ✓
  Indexes:     declared in createTable ✓   (or, on an existing table:
               CONCURRENTLY + transaction:false + invalid-index cleanup ✓)

Reference migration (style match):
  therr-services/<svc>/src/store/migrations/20260126000009_habits.pact_activities.js

Next steps:
  1. Fill in TODO columns
  2. Run the migration locally: npm run migrate:latest --prefix therr-services/<svc>
  3. Verify rollback: npm run migrate:rollback --prefix therr-services/<svc>
  4. Verify the down migration is symmetric (drops what up creates)
```

After printing the report, append a post-deploy follow-up to
`docs/WORK_IN_PROGRESS.md` so the migration is not forgotten on the
production cutover. Locate the marked region and insert before the end
marker:

```
<!-- skill-followups:start -->
- [ ] (YYYY-MM-DD, /db-migration-scaffold) Run migration
  `<timestamp>_<schema>.<table>_<change>` on production after stage→main
  merge: `npm run migrations:run --prefix therr-services/<svc>`.
<!-- skill-followups:end -->
```

Skip if an identical line is already present (match on the migration
filename). Skip silently if `docs/WORK_IN_PROGRESS.md` does not exist.

---

## Mode 2: Lint

Scan every `.js` file in the six service migrations dirs. Report violations:

- **Filename format**: does it match `^\d{14}_[a-z]+\.[A-Za-z_]+.*\.js$`?
- **Schema mismatch**: does the filename schema prefix match the `withSchema('...')` or `CREATE SCHEMA` inside the file?
- **Missing `down`**: does every migration export a non-empty `down` that undoes `up`?
- **Non-idempotent DDL**: `npx eslint <migration-path>` from the service directory — `therr/require-idempotent-migration` reports unguarded creates and drops. Only migrations dated at or after the cutoff are in scope.
- **Blocking index DDL**: the same `npx eslint` run — `therr/require-concurrent-index` reports raw `CREATE INDEX` / `DROP INDEX` without `CONCURRENTLY`, builder index ops inside `alterTable`, `CONCURRENTLY` without `exports.config = { transaction: false }`, and concurrent creates with no invalid-index cleanup. Only migrations dated at or after its cutoff are in scope. Report only: never edit an already-deployed migration to fix this.
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
- **Expand/contract for anything the Cloud Functions read** (Step 4.5). A bare rename on a `main.*` table deploys green here and breaks a Cloud Function at its next scheduler firing, with no alert.
- Do not modify migrations that already exist on any branch — they're append-only in practice. If the user wants to change a table, generate a new migration.
- Match the service's existing naming convention (snake_case vs camelCase columns) — inconsistency across a service is a code smell.
- This skill does not commit. It creates the file, leaves it staged or unstaged per git's default.
