---
name: prod-db
description: Query the PRODUCTION database read-only — users-service (main.users, main."userAcquisition", main."emailMarketingSubscribers", habits.*) or maps-service (main.spaces) — through scripts/prod-query with the credentials in scripts/import-spaces/.env. Use whenever a question needs real production numbers or rows — "check prod", "look in the prod DB", "how many users/signups/pacts/check-ins", waitlist signups, campaign or UTM attribution, verifying a deploy or backfill landed, sanity-checking a GA4 figure against the database. Never hand-roll a throwaway pg script against prod; this runner is forced read-only and masks emails.
allowed-tools: Bash(node scripts/prod-query/index.js*), Bash(npm run db:query*), Bash(npm run report:retention*), Read, Grep
argument-hint: [question or SQL]
---

# Production database (read-only)

```bash
node scripts/prod-query/index.js --sql 'SELECT COUNT(*) FROM main.users'          # users-service (default)
node scripts/prod-query/index.js --db maps --sql 'SELECT COUNT(*) FROM main.spaces'
node scripts/prod-query/index.js --file /path/in/scratchpad/q.sql --json
```

Credentials come from `scripts/import-spaces/.env` (git-ignored; default `--env-file`). It only holds
the WRITE host, so the runner forces the session read-only three ways (connection option, session
characteristic, `BEGIN READ ONLY … ROLLBACK`) and refuses multi-statement input. A write fails in
Postgres with "cannot execute … in a read-only transaction" — that is the guard working, not a bug
to route around. **Never** connect any other way, and never print the `.env` values.

`--db` reads `<SERVICE>_SERVICE_DATABASE` from the .env. Only `users` and `maps` are in it today;
`reactions` / `messages` fail with a "Missing in …" error naming the variable the founder would add.

## Before writing SQL

1. **Use the canned report if it already answers it.** Retention, activation, check-in curve, paired
   vs unpaired, pact outcomes, invite→join, push by state:
   `npm run report:retention -- --env-file scripts/import-spaces/.env --allow-write-credentials`.
2. **Discover the schema, don't guess it.** Table names drift from store names (the subscribers store
   writes `main."emailMarketingSubscribers"`, not `subscribers`):
   ```sql
   SELECT table_schema, table_name FROM information_schema.tables WHERE table_name ILIKE '%term%'
   SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'main' AND table_name = 'userAcquisition' ORDER BY ordinal_position
   ```
3. **Quote camelCase.** `main.*` is camelCase and must be double-quoted (`main."userAcquisition"`,
   `"createdAt"`); `habits.*` is snake_case. Wrap the whole `--sql` in single quotes so the double
   quotes survive the shell; write a `'` inside it as `'\''`, or put long queries in a scratchpad file.
4. **Exclude internal accounts** for any user-level number. Copy `COHORT_SQL` from
   `scripts/retention-report/index.js` (habits brand via `"brandVariations" @> …`, minus superusers,
   bots, `test.local`). Internal accounts once held 132 of 244 completed check-ins — an unfiltered
   count is not a product number. The founder's own address also shows up as test rows (e.g. the one
   coach-waitlist row created 2021, updated 2026-10-06).
5. **Brand-scoped tables need a `"brandVariation"` predicate** (see `eslint-config/brand-scoped-tables.js`).
6. **Dates:** timestamps are `timestamptz`; bucket in Pacific to match GA4
   (`("createdAt" AT TIME ZONE 'America/Los_Angeles')::date`). `DATE` columns print as plain dates.

## Tables that answer the common questions

| Question | Where |
|---|---|
| Signups, brand enrollment, last login | `main.users` (`"brandVariations"` jsonb, `"createdAt"`, `"lastLoginAt"`) |
| Which campaign/UTM brought a registered user | `main."userAcquisition"` (`utmSource/Medium/Campaign/Content/Term`, `referrer`, `landingPath`, `surface`) — written at **registration only** |
| Email lists, iOS waitlist, coach waitlist | `main."emailMarketingSubscribers"` (`"isSubscribedToIosWaitlist"`, `"isSubscribedToCoachesWaitlist"`, `"coachesWaitlistDetails"` jsonb) — **carries no attribution** |
| Pacts, check-ins, partners, referrals, purchases | `habits.*` (`\dt habits.*` equivalent via information_schema) |
| Push sends / dedup | `main."notificationQueue"` |
| Spaces, claims | `--db maps`, `main.spaces` |

## Reporting

- Emails print masked (`j***@gmail.com`; domain kept because it segments lists). Pass `--show-pii`
  only when the founder asks for the actual addresses, and never paste unmasked addresses into
  docs, commits, issues or memory.
- Report aggregates with their denominators and the filter applied ("3 of 41 habits users,
  internal excluded"). Say when a number is too small to read.
- When a DB number and a GA4 number disagree, say which is which: GA4 counts sessions/events in
  property `549794383` (web) or `267810693` (app); the DB counts rows that reached the server.

## Known failures

- `relation "main.userAcquisition" does not exist` → unquoted camelCase. Quote it.
- `cannot execute … in a read-only transaction` → you wrote a write. This tool never writes; a data
  fix goes through a migration or a reviewed script with the founder's go-ahead.
- `One statement per run` → combine with a CTE, or run twice.
