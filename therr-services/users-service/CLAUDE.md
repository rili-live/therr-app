# Claude Code Instructions - Users Service

## Service Overview

- **Port**: 7771
- **Database**: `therr_dev_users`
- **Purpose**: Accounts, profiles, connections, notifications, achievements, payments, campaigns

## Key Domains

- **Auth**: Registration, login, OAuth (Google, Apple, Facebook), password reset
- **Users**: Profiles, settings, user search
- **Connections**: Friend requests, user relationships
- **Groups**: User group management
- **Notifications**: In-app notification storage and retrieval
- **Achievements**: Gamification and user rewards
- **Payments**: Stripe integration, subscriptions
- **Campaigns**: Marketing campaign management
- **Social Sync**: Social media integrations
- **Habits** (HABITS app): Habit goals, pacts, check-ins, streaks

## Directory Structure

```
src/
├── handlers/       # Business logic (auth, users, campaigns, payments, etc.)
├── routes/         # Express routers
├── store/          # Data access (*Store.ts files)
├── api/            # External service integrations
│   ├── email/      # AWS SES email templates
│   ├── facebook/   # Facebook API integration
│   ├── stripe.ts   # Stripe payments
│   └── twilio.ts   # SMS
└── utilities/      # Helper functions
```

## Key Patterns

### Store Pattern
All database access goes through `*Store.ts` classes in `src/store/`:
- `UsersStore`, `UserConnectionsStore`, `UserGroupsStore`, etc.
- Use raw SQL with Knex query builder
- Separate read/write pools (see `connection.ts`)

### Email Templates
Email sending is in `src/api/email/`:
- Template files for different email types
- Uses AWS SES via `@aws-sdk/client-sesv2`
- Brand-aware (different templates per app variant)

### External Integrations
- Stripe for payments (`src/api/stripe.ts`)
- Twilio for SMS (`src/api/twilio.ts`)
- OAuth providers (`src/api/oauth2.ts`)

## Database Tables

### main schema
Key tables: `users`, `userConnections`, `userGroups`, `notifications`, `userAchievements`, `subscribers`, `campaigns`

### habits schema (HABITS app)
- `habit_goals` - Habit templates and user-created goals
- `pacts` - Accountability partnerships
- `pact_members` - Membership with per-user stats
- `habit_checkins` - Daily completion records
- `streaks` - Streak state per user/habit
- `streak_history` - Event log for analytics

## Related Services

- Makes HTTP calls to: reactions-service (for user metrics)
- Called by: api-gateway (all endpoints), other services for user data

## Code Quality

Before completing code changes, run linting and fix all errors:

```bash
npx eslint src/**/*.ts --fix   # Auto-fix issues
npx eslint src/**/*.ts         # Verify no errors remain
```

See root `CLAUDE.md` for full code quality requirements.
