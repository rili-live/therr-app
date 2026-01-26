# Niche App Database Guidelines

This document outlines database patterns and best practices for adding features to support niche app variants while maintaining compatibility with the core Therr application.

## Core Principle: Shared Database, Isolated Features

All brand variants share the same PostgreSQL database infrastructure. This enables:
- Single user identity across all apps (same email/password)
- Shared core data (users, connections, notifications)
- Efficient infrastructure management
- Cross-brand features when desired

However, brand-specific features should be **isolated** to prevent breaking existing functionality.

## Schema Isolation Pattern

### Use Separate Schemas for Brand-Specific Features

Instead of adding columns to existing `main.*` tables, create a new schema:

```sql
-- Good: Isolated schema
CREATE SCHEMA IF NOT EXISTS habits;

CREATE TABLE habits.pacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creatorUserId UUID NOT NULL REFERENCES main.users(id),
    -- habit-specific columns
);

-- Avoid: Polluting existing tables with brand-specific columns
-- ALTER TABLE main.userConnections ADD COLUMN pactType VARCHAR;  -- Don't do this
```

### Benefits of Schema Isolation

| Benefit | Description |
|---------|-------------|
| No breaking changes | Existing queries on `main.*` tables unaffected |
| Clear ownership | Easy to identify which tables belong to which feature |
| Simpler migrations | Can develop/test independently |
| Clean rollback | Drop entire schema if feature is removed |
| Query performance | Indexes optimized for specific use cases |

### When to Use Schema Isolation

| Scenario | Recommendation |
|----------|----------------|
| New feature domain (habits, streaks, pacts) | Create new schema |
| Adding 1-2 columns to users | Extend `main.users` (with defaults) |
| Complex relationship tables | Create in new schema |
| Temporary/experimental features | Create in new schema |
| Core functionality used by all brands | Add to `main.*` tables |

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

```javascript
// migrations/20250125000002_habits.habit_goals.js
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

## Brand-Conditional Queries

### Do NOT Add brand_id Columns

Since all brands share the database, avoid adding `brandVariation` columns to tables. Instead:

1. **Use application-layer filtering** based on request headers
2. **Use feature-specific tables** that only certain brands use
3. **Use user preferences** to determine feature access

### Example: Brand-Aware Query in Handler

```typescript
const getAchievements = async (req, res) => {
    const { brandVariation } = parseHeaders(req.headers);

    // Get achievements for user
    let achievements = await UserAchievementsStore.getByUserId(req.user.id);

    // Filter based on brand
    if (brandVariation !== BrandVariations.HABITS) {
        // Exclude habit-specific achievements for non-HABITS brands
        achievements = achievements.filter(a =>
            !a.achievementClass.startsWith('habit')
        );
    }

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
