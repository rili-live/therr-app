# Niche App Database Guidelines

This document outlines database patterns and best practices for adding features to support niche app variants while maintaining compatibility with the core Therr application.

## Core Principle: Shared Database, Three Data Archetypes

All brand variants share the same PostgreSQL database infrastructure and **single user identity** (one `main.users.id` per email regardless of which app the person signs into). To prevent cross-app data pollution, every shared data domain falls into exactly one of three archetypes. The archetype determines storage, enforcement, defaulting, and indexing — uniformly.

> **Every new migration MUST declare its archetype in a header comment.** Reviewers reject PRs that omit it.

### The three archetypes

| Archetype | Definition | Storage | Enforcement | Default for existing rows |
|-----------|------------|---------|-------------|---------------------------|
| **Identity-shared** | One row per human regardless of brand. The data is about the person, not the app they used. | `main.*`, **no brand column** | None at row level. Brand only used when UX is conditional on enrollment (`brandVariations @> '["habits"]'`). | n/a — no schema change needed |
| **Brand-scoped** | Same row shape, must be partitioned per brand so a user signed into multiple apps does not see leaked data. | `main.*` with `brandVariation TEXT NOT NULL DEFAULT 'therr'` column + composite index `(userId, brandVariation, ...)` | `BrandScopedStore` base class in each service's `src/store/` directory. Handlers cannot omit brand because the store method signatures require it. | Backfill `'therr'` in the same migration that adds the column (every row created before this work was created by the original Therr app) |
| **Brand-only / niche** | Only exists for one brand. | Dedicated `<niche>.*` schema (e.g. `habits.*`), FK to `main.users(id)`. | Schema name is the boundary; no row-level filter needed. | n/a — only ever populated by the niche app |

### Archetype examples

| Archetype | Examples |
|-----------|----------|
| Identity-shared | `main.users`, OAuth links, email/SMS verification, password resets, base profile, `main.userConnections` (a friendship is person-to-person, not app-to-app), `main.moments`, `main.spaces`, `main.events`, `main.momentReactions`, `main.spaceReactions`, `main.eventReactions` (Therr-only by data flow today — see note below) |
| Brand-scoped | `main.notifications`, `main.directMessages`, `main.userAchievements`, `main.forums`, `main.forumMessages`, `main.userDeviceTokens` |
| Brand-only / niche | All `habits.*` tables (pacts, streaks, checkins, proofs), any future `teem.*`, etc. |

> **Note on the content tables (moments / spaces / events / *Reactions):** These were originally classified Brand-scoped in the Phase 4 plan. In April 2026 we audited the niche apps and confirmed neither Habits nor Teem reads or writes these tables — Habits builds its check-in / pact / streak data in `habits.*` and only references `maps-service/src/handlers/moments.ts` as a *design pattern*. Adding `brandVariation` to these tables would have been a useless column on the largest tables in the system (every row stamped `'therr'` forever, every read filtered against a single-value column).
>
> If a future niche app launches a moments-style location feed (or a Teem-flavored "spaces" concept), revisit this classification: add the column, backfill `'therr'`, and bring the relevant `*Store` under `BrandScopedStore` at that time. Until then they stay Identity-shared and the cost of the brand column is deferred.

### When to use schema isolation (Brand-only archetype)

| Scenario | Recommendation |
|----------|----------------|
| New feature domain (habits, streaks, pacts) | Create new `<niche>.*` schema |
| Adding 1-2 columns to `main.users` for a niche feature | Extend `main.users` (with defaults) |
| Complex relationship tables for one brand only | Create in new schema |
| Temporary/experimental features | Create in new schema |
| Core functionality used by all brands | Add to `main.*` (identity-shared) |
| Same-shape data that must partition per brand | Add to `main.*` with `brandVariation` column (brand-scoped — see below) |

### Benefits of schema isolation (when it applies)

| Benefit | Description |
|---------|-------------|
| No breaking changes | Existing queries on `main.*` tables unaffected |
| Clear ownership | Easy to identify which tables belong to which feature |
| Simpler migrations | Can develop/test independently |
| Clean rollback | Drop entire schema if feature is removed |
| Query performance | Indexes optimized for specific use cases |

## Migration Patterns

### Creating a New Schema

```javascript
// migrations/20250125000001_habits.schema.js
exports.up = function(knex) {
    return knex.raw('CREATE SCHEMA IF NOT EXISTS habits');
};

exports.down = function(knex) {
    return knex.raw('DROP SCHEMA IF EXISTS habits CASCADE');
};
```

### Creating Tables in New Schema

Every migration must declare its archetype in a header comment so reviewers can verify enforcement and indexing match the framework above.

```javascript
// migrations/20250125000002_habits.habit_goals.js
//
// Archetype: Brand-only (habits schema)
exports.up = function(knex) {
    return knex.schema.withSchema('habits').createTable('habit_goals', (table) => {
        table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
        table.string('name', 255).notNullable();
        table.text('description');
        table.string('category', 50);
        table.string('frequencyType', 20).notNullable().defaultTo('daily');
        table.integer('frequencyCount').defaultTo(1);
        table.uuid('createdByUserId').notNullable()
            .references('id').inTable('main.users')
            .onUpdate('CASCADE').onDelete('CASCADE');
        table.boolean('isTemplate').defaultTo(false);
        table.boolean('isPublic').defaultTo(false);
        table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
    return knex.schema.withSchema('habits').dropTableIfExists('habit_goals');
};
```

### Adding Columns to Existing Tables (Safe Pattern)

When extending `main.users` or other core tables:

```javascript
// migrations/20250125000010_main.users_habits.js
exports.up = function(knex) {
    return knex.schema.withSchema('main').alterTable('users', (table) => {
        // All columns MUST have defaults or be nullable
        table.string('settingsTimezone', 50);  // nullable
        table.time('settingsPreferredReminderTime');  // nullable
        table.boolean('settingsPushHabitReminders').defaultTo(true);
        table.boolean('settingsPushPartnerActivity').defaultTo(true);
        table.boolean('settingsPushStreakAlerts').defaultTo(true);
        table.integer('currentLongestStreak').defaultTo(0);
        table.integer('allTimeLongestStreak').defaultTo(0);
        table.integer('totalHabitsCompleted').defaultTo(0);
    });
};

exports.down = function(knex) {
    return knex.schema.withSchema('main').alterTable('users', (table) => {
        table.dropColumn('settingsTimezone');
        table.dropColumn('settingsPreferredReminderTime');
        table.dropColumn('settingsPushHabitReminders');
        table.dropColumn('settingsPushPartnerActivity');
        table.dropColumn('settingsPushStreakAlerts');
        table.dropColumn('currentLongestStreak');
        table.dropColumn('allTimeLongestStreak');
        table.dropColumn('totalHabitsCompleted');
    });
};
```

**Rules for Safe Column Addition:**
1. Always provide DEFAULT values or allow NULL
2. Never add NOT NULL without a default
3. Avoid UNIQUE constraints on new columns (unless truly required)
4. Add indexes in separate migrations if needed

## Table Naming Conventions

### Schema-Qualified Names

Store table name constants with schema prefix:

```typescript
// therr-services/users-service/src/store/tableNames.ts

// Core tables (main schema)
export const USERS_TABLE_NAME = 'main.users';
export const USER_CONNECTIONS_TABLE_NAME = 'main.userConnections';

// Habits tables (habits schema)
export const HABIT_GOALS_TABLE_NAME = 'habits.habit_goals';
export const PACTS_TABLE_NAME = 'habits.pacts';
export const PACT_MEMBERS_TABLE_NAME = 'habits.pact_members';
export const HABIT_CHECKINS_TABLE_NAME = 'habits.habit_checkins';
export const STREAKS_TABLE_NAME = 'habits.streaks';
```

### Migration File Naming

Format: `YYYYMMDDHHMMSS_<schema>.<table>.js`

Examples:
```
20250125143000_habits.schema.js          # Create schema
20250125143001_habits.habit_goals.js     # Create table
20250125143002_habits.pacts.js           # Create table
20250125143010_main.users_habits.js      # Alter existing table
```

## Foreign Key Patterns

### Referencing Core Tables from New Schema

```sql
-- In habits.pacts table
creatorUserId UUID NOT NULL
    REFERENCES main.users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
```

### Cascading Behavior Guidelines

| Relationship | ON DELETE | ON UPDATE | Reason |
|--------------|-----------|-----------|--------|
| User ownership | CASCADE | CASCADE | Delete user data when user deleted |
| Reference only | SET NULL | CASCADE | Keep record, clear reference |
| Audit/history | NO ACTION | CASCADE | Preserve history |

### Cross-Schema Joins

```typescript
// In HabitCheckinsStore.ts
const getCheckinsWithUser = () => {
    return knex('habits.habit_checkins as c')
        .join('main.users as u', 'c.userId', 'u.id')
        .select([
            'c.*',
            'u.userName',
            'u.firstName',
            'u.lastName',
        ]);
};
```

## Indexing Strategy

### Index New Tables Appropriately

```javascript
// In migration
table.uuid('userId').notNullable().index();  // Common query column
table.timestamp('createdAt').notNullable().index();  // Time-series queries

// Composite indexes for common query patterns
knex.raw(`
    CREATE INDEX idx_checkins_user_date
    ON habits.habit_checkins(userId, scheduledDate DESC)
`);

// Partial indexes for filtered queries
knex.raw(`
    CREATE INDEX idx_pacts_active
    ON habits.pacts(status)
    WHERE status = 'active'
`);
```

### Avoid Over-Indexing

Only index columns that are:
- Used in WHERE clauses frequently
- Used in JOIN conditions
- Used in ORDER BY with LIMIT

## Soft Delete Patterns

### Using isEnabled/isActive Flags

```sql
-- Table definition
isActive BOOLEAN DEFAULT true

-- Query pattern
SELECT * FROM habits.pacts WHERE isActive = true AND userId = $1
```

### Using Status Columns

```sql
-- Table definition
status VARCHAR(20) DEFAULT 'active'  -- 'active', 'completed', 'abandoned', 'deleted'

-- Query pattern (exclude deleted)
SELECT * FROM habits.pacts WHERE status != 'deleted' AND userId = $1
```

### Timestamp-Based Soft Delete

```sql
-- Table definition
deletedAt TIMESTAMP  -- NULL = not deleted

-- Query pattern
SELECT * FROM habits.pacts WHERE deletedAt IS NULL AND userId = $1
```

## JSONB Usage Guidelines

### When to Use JSONB

| Use Case | Example |
|----------|---------|
| Flexible metadata | `proofMetadata JSONB` |
| Array of simple values | `targetDaysPerWeek INTEGER[]` or `JSONB` |
| Nested configuration | `consequenceDetails JSONB` |
| Audit/change tracking | `changeHistory JSONB` |

### When NOT to Use JSONB

| Avoid | Use Instead |
|-------|-------------|
| Frequently queried fields | Proper columns with indexes |
| Relational data | Separate normalized table |
| Fields needed in WHERE | Regular columns |

### JSONB with Indexes

```sql
-- GIN index for containment queries
CREATE INDEX idx_goals_interests ON habits.habit_goals USING GIN(interestsKeys);

-- Query
SELECT * FROM habits.habit_goals WHERE interestsKeys @> '["fitness"]'
```

## Brand-Scoped Tables and the BrandScopedStore Pattern

> **Earlier versions of this guide said "Do NOT add `brandVariation` columns to shared tables."**
> That guidance was wrong for the **Brand-scoped** archetype and has been replaced. Identity-shared and brand-only archetypes still avoid the column — see the table at the top of this doc.

### Why brand-scoped tables exist

A single user signed into multiple apps with the same identity must NOT see data from another app. Twelve+ shared tables in `main.*` carry per-app rows (notifications, DMs, content, achievements, reactions, push tokens, etc.). Without a brand discriminator, a query like `SELECT * FROM main.notifications WHERE userId = ?` returns Therr **and** Habits notifications together. Application-layer filtering alone is too easy to forget — the WIP auth branch (merged 2026-04-25) made identity context reliably available everywhere, so the data layer can now enforce isolation.

### Adding a brand column to a shared table

```javascript
// migrations/20260601000001_main.notifications.brandVariation.js
//
// Archetype: Brand-scoped
// Adds brandVariation discriminator + composite index per
// docs/NICHE_APP_DATABASE_GUIDELINES.md ("Brand-scoped" archetype).
exports.up = async (knex) => {
    await knex.schema.withSchema('main').alterTable('notifications', (table) => {
        // NOT NULL with default — every existing row was created by the original Therr app.
        table.string('brandVariation', 50).notNullable().defaultTo('therr');
    });
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_notifications_user_brand_unread
        ON main.notifications ("userId", "brandVariation", "isUnread")
    `);
};

exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS main.idx_notifications_user_brand_unread');
    await knex.schema.withSchema('main').alterTable('notifications', (table) => {
        table.dropColumn('brandVariation');
    });
};
```

Then add the table name to `eslint-config/brand-scoped-tables.js` (the ESLint rule auto-flags any direct string-literal reference outside the sanctioned store).

### Routing queries through BrandScopedStore

Every brand-scoped table has a corresponding `*Store.ts` that extends `BrandScopedStore` (a thin abstract base in each service's `src/store/` directory). Handlers pull `brandVariation` from `getBrandContext(req.headers)` (in `therr-js-utilities/http`) and pass it as the first argument to every store method:

```typescript
// handlers/notifications.ts
import { getBrandContext } from 'therr-js-utilities/http';

const searchNotifications = (req, res) => {
    const { brandVariation } = getBrandContext(req.headers);
    return Store.notifications.searchNotifications(brandVariation, req['x-userid'], req.query);
};

// store/NotificationsStore.ts
import BrandScopedStore from './BrandScopedStore';
import { NOTIFICATIONS_TABLE_NAME } from './tableNames';

export default class NotificationsStore extends BrandScopedStore {
    constructor(db) {
        // 'enforce' once shadow mode reports zero misses for one full release cycle.
        super(db, NOTIFICATIONS_TABLE_NAME, 'shadow');
    }

    searchNotifications(brand, userId, conditions) {
        const qb = this.scopedQuery(brand)
            .select('*')
            .where('userId', '=', userId);
        return this.db.read.query(qb.toString()).then((r) => r.rows);
    }
}
```

Forgetting to pass `brand` is a TypeScript error. Forgetting to use the store at all (e.g. handwritten raw SQL referencing `'main.notifications'`) is an ESLint error.

### Shadow vs enforce mode

The base class accepts a third constructor argument: `'shadow'` (default) or `'enforce'`.

- **`'shadow'`**: missing or unknown brand logs a warning but does not throw. Use during the rollout for one full release cycle so production logs surface any handler that forgot to pass brand.
- **`'enforce'`**: missing or unknown brand throws `MissingBrandContextError`. Flip after shadow mode is clean.

### When to use brand-conditional logic in a handler instead

Some flows are genuinely brand-conditional even when the data is identity-shared (e.g. achievements list filtering). Continue to do that with `getBrandContext` at the handler level — the BrandScopedStore pattern is only required for tables in the **Brand-scoped** archetype.

```typescript
import { getBrandContext } from 'therr-js-utilities/http';
import { BrandVariations } from 'therr-js-utilities/constants';

const getAchievements = async (req, res) => {
    const { brandVariation } = getBrandContext(req.headers);

    // userAchievements is a brand-scoped table — store enforces the filter automatically.
    const achievements = await Store.userAchievements.getByUserId(brandVariation, req['x-userid']);

    return res.json({ achievements });
};
```

## Migration Coordination

### Deployment Order

When adding a new feature schema:

1. **Deploy migrations first** (create schema + tables)
2. **Deploy backend services** (new handlers use new tables)
3. **Deploy frontend** (UI can now call new endpoints)

### Rollback Safety

Always ensure migrations can be rolled back:

```javascript
exports.down = function(knex) {
    // Must reverse ALL changes made in up()
    return knex.schema.withSchema('habits').dropTableIfExists('habit_goals');
};
```

### Testing Migrations Locally

```bash
# Run all pending migrations
npm run migrations:run

# Rollback last batch
npm run migrations:rollback

# Check migration status
npm run migrations:status
```

## Example: Complete Schema for Habits Feature

```
habits schema
├── habit_goals          (habit templates, user-created habits)
├── pacts                (accountability partnerships)
├── pact_members         (membership with per-user stats)
├── habit_checkins       (daily completion records)
├── streaks              (streak state per user/habit)
├── streak_history       (event log for analytics)
├── proofs               (media verification records)
└── pact_activities      (activity feed events)

main schema (extended)
└── users                (+ timezone, reminder prefs, streak counters)
```

### Relationship Diagram

```
main.users
    │
    ├──< habits.habit_goals (createdByUserId)
    │       │
    │       ├──< habits.pacts (habitGoalId)
    │       │       │
    │       │       └──< habits.pact_members (pactId)
    │       │       └──< habits.pact_activities (pactId)
    │       │
    │       ├──< habits.habit_checkins (habitGoalId)
    │       │       │
    │       │       └──< habits.proofs (checkinId)
    │       │
    │       └──< habits.streaks (habitGoalId)
    │               │
    │               └──< habits.streak_history (streakId)
    │
    └──< habits.pacts (creatorUserId, partnerUserId)
```

## Related Documentation

- [MULTI_BRAND_ARCHITECTURE.md](./MULTI_BRAND_ARCHITECTURE.md) - Brand variation system
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- Service-specific CLAUDE.md files for migration patterns
