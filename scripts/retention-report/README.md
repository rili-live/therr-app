# Friends with Habits retention report

A read-only, aggregate-only report on the users-service database that answers the questions the
2026-10-28 retention review was built on, so they can be re-read weekly instead of re-derived by hand.

```bash
npm run report:retention -- --env-file <path-to-.env>            # read replica (DB_*_MAIN_READ)
npm run report:retention -- --env-file scripts/import-spaces/.env --allow-write-credentials
npm run report:retention -- --json                                # machine-readable
npm run report:retention -- --include-internal                    # reconcile with an unfiltered figure
```

| Section | Question |
|---|---|
| 1. Activation | How many accounts; how many older than 35 days never completed a check-in |
| 2. Check-in curve | Users checking in by days since *their own* first check-in, with an `eligible` denominator |
| 3. Paired vs unpaired | Do users whose partner joined keep checking in past week 1 and week 4 |
| 4. Pact outcomes | Pacts by status; renewals per expired pact |
| 5. Invite → join | Median minutes to join, share within 24h, invites still pending |
| 6. Push by state | Habits pushes queued/sent/failed/skipped/opened by the recipient's state at send time |

**Who is counted:** accounts enrolled in the habits brand, minus superusers, bots and `test.local`
accounts (`COHORT_SQL` in `index.js`). Section 1 prints how many were excluded. `--include-internal`
turns the exclusion off, which is only useful for reconciling with a number computed without it —
on 2026-10-29, 14 internal accounts held 132 of 244 completed check-ins and 15 of 16 recorded push opens.

**Safety:** the connection starts with `default_transaction_read_only=on`, the session is set read-only,
and the queries run inside `BEGIN READ ONLY … ROLLBACK`. WRITE credentials are refused unless
`--allow-write-credentials` is passed, and even then the session cannot write. Results are aggregates;
`assertNoPii` refuses to print identity-looking columns or email-looking values.

Tests: `node scripts/retention-report/tests/retention-report.test.js` (in `npm run test:harness`, which CI runs).
