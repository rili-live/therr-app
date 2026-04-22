---
name: claim-funnel-analyzer
description: Measure the B2B claim funnel end-to-end (email sent → space page view → claim initiated → claim approved → paid subscription) against the Green/Yellow/Red thresholds in docs/GROWTH_STRATEGY.md. Reads from users-service and maps-service DBs; identifies the biggest drop-off and recommends the next highest-leverage action for a solo dev.
disable-model-invocation: true
user-invocable: true
allowed-tools: Bash(psql*), Bash(aws ses*), Read, Grep
argument-hint: [report|stage <stage-name>] [--window 30d|7d|all] [--city <name>]
---

# Claim Funnel Analyzer

Turn the Go/No-Go criteria documented in `docs/GROWTH_STRATEGY.md` into a one-command dashboard. The funnel is:

```
1. Email sent      (userMetrics: space.marketing.unclaimedEmailSent)
2. Space page view (userMetrics: space.user.visit + space.user.impression)
3. Claim initiated (maps.spaces.isClaimPending = true + requestedByUserId set)
4. Claim approved  (maps.spaces.fromUserId != SUPER_ADMIN_ID after claim)
5. Paid subscription (users.inviteCodes redemption OR stripe webhook event)
```

Key tables and columns to source from (verify at runtime — schema drifts):

| Stage | Database | Table / metric |
|-------|----------|----------------|
| Sent | `USERS_SERVICE_DATABASE` | `main."userMetrics"` where `name = 'space.marketing.unclaimedEmailSent'` |
| Page view | `USERS_SERVICE_DATABASE` | `main."userMetrics"` where `name IN ('space.user.visit', 'space.user.impression')` |
| Bounced | `USERS_SERVICE_DATABASE` | `main."blacklistedEmails"` |
| Claim init | `MAPS_SERVICE_DATABASE` | `main.spaces` where `"isClaimPending" = true` AND `"requestedByUserId" IS NOT NULL` |
| Claim approved | `MAPS_SERVICE_DATABASE` | `main.spaces` where `"fromUserId" != SUPER_ADMIN_ID` on a space that was imported |
| Subscription | `USERS_SERVICE_DATABASE` | `main."inviteCodes"` where `redemptionType IN ('basic-subscription', 'advanced-subscription', 'pro-subscription')` — check the users-service store for the current source of truth |

## Thresholds (from `docs/GROWTH_STRATEGY.md` Go/No-Go)

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| Email bounce rate | < 2% | 2–5% | > 5% |
| Open rate (if tracked) | ≥ 5% | 2–5% | < 2% |
| Claim initiations per email sent | ≥ 1% | 0.1–1% | 0% after 1000 sent |
| First paid subscription within 90 days | any | delayed past 90d | none after 180d + ≥5 claims |
| Search Console impressions / month (60d after sitemap submit) | ≥ 500 | 100–500 | 0 after 90d |

## Mode Selection

| Argument | Mode |
|----------|------|
| `report` or _(no args)_ | Full funnel snapshot against thresholds |
| `stage <stage-name>` | Drill into one stage: `sent`, `viewed`, `claim-init`, `claim-approved`, `subscribed` |

## Common flags

| Flag | Meaning |
|------|---------|
| `--window 30d\|7d\|all` | Time window (default `30d`) |
| `--city <name>` | Filter all queries to a single city (joins on `addressLocality`) |

---

## Mode 1: Report (default)

### Step 1: Run each stage query

For `--window 30d`, apply `"createdAt" > NOW() - INTERVAL '30 days'` on every query. For `all`, omit the constraint.

```sql
-- 1. Sent
SELECT COUNT(*) FROM main."userMetrics"
WHERE name = 'space.marketing.unclaimedEmailSent'
  AND "createdAt" > NOW() - INTERVAL '30 days';

-- 2. Page views on spaces that received an email
-- (join userMetrics to itself by dimensions->>'spaceId')
WITH sent_spaces AS (
  SELECT DISTINCT dimensions->>'spaceId' AS space_id
  FROM main."userMetrics"
  WHERE name = 'space.marketing.unclaimedEmailSent'
    AND "createdAt" > NOW() - INTERVAL '30 days'
)
SELECT COUNT(DISTINCT dimensions->>'spaceId') AS viewed_space_count
FROM main."userMetrics" m
JOIN sent_spaces s ON m.dimensions->>'spaceId' = s.space_id
WHERE m.name IN ('space.user.visit', 'space.user.impression')
  AND m."createdAt" > NOW() - INTERVAL '30 days';

-- 3. Claim initiations — run against MAPS_SERVICE_DATABASE
SELECT COUNT(*) FROM main.spaces
WHERE "isClaimPending" = true
  AND "requestedByUserId" IS NOT NULL
  AND "updatedAt" > NOW() - INTERVAL '30 days';

-- 4. Claim approvals — a heuristic: spaces where fromUserId != SUPER_ADMIN_ID
-- and "isClaimPending" is no longer pending. The exact column may differ; check
-- maps-service/src/store/SpacesStore.ts for the canonical query.
SELECT COUNT(*) FROM main.spaces
WHERE "fromUserId" != $SUPER_ADMIN_ID
  AND "updatedAt" > NOW() - INTERVAL '30 days'
  AND "requestedByUserId" IS NOT NULL;

-- 5. Paid subscriptions redeemed in window
SELECT COUNT(*), "redemptionType"
FROM main."inviteCodes"
WHERE "redemptionType" IN ('basic-subscription', 'advanced-subscription', 'pro-subscription')
  AND "redeemedAt" IS NOT NULL
  AND "redeemedAt" > NOW() - INTERVAL '30 days'
GROUP BY "redemptionType";

-- Bounce rate denominator
SELECT COUNT(*) FROM main."blacklistedEmails"
WHERE "createdAt" > NOW() - INTERVAL '30 days';
```

Run maps queries and users queries against their respective databases (env vars `MAPS_SERVICE_DATABASE` and `USERS_SERVICE_DATABASE` as used by `scripts/import-spaces/send-unclaimed-emails.ts`).

### Step 2: Compute conversions

For each stage, compute the conversion against the previous stage:
- View rate = `viewed / sent`
- Claim init rate = `claim_init / sent` (primary KPI per GROWTH_STRATEGY)
- Claim approval rate = `claim_approved / claim_init`
- Paid conversion rate = `subscribed / claim_approved`
- Bounce rate = `bounced / sent` (derived from blacklist growth in window)

### Step 3: Report against thresholds

```
Claim Funnel — last 30 days
(filter: city=all)

  Stage                     Count    Conv    Threshold status
  ─────────────────────────────────────────────────────────────
  Emails sent               427      —       —
  Email bounces             12       2.8%    🟢 Green (<5%)
  Space page views          88       20.6%   —
  Claim initiations         4        0.9%    🟡 Yellow (0.1–1%)
  Claims approved           2        50.0%   —
  Paid subscriptions        0        0%      🔴 Red (0 paid after 90d)

Biggest drop-off: page view → claim initiation (20.6% → 0.9%)
  80 visitors saw the space page but only 4 clicked "Claim".

Recommended next action:
  The claim CTA visibility is the blocker. Check therr-client-web/src/routes/ViewSpace.tsx
  — the banner/CTA copy that was added per GROWTH_STRATEGY section "Claim Flow UX".
  Consider A/B testing banner colors or adding a "see who's searching for this" proof element.

Supporting links:
  - docs/GROWTH_STRATEGY.md §Go/No-Go Criteria (90 Days)
  - therr-client-web/src/routes/ViewSpace.tsx (claim banner)
```

Traffic-light colors are literal `🟢 🟡 🔴` in the terminal output so the signal is scannable at a glance.

### Step 4: Highlight the biggest leverage point

For each stage-to-stage conversion, compare against the corresponding threshold. The stage with the worst ratio vs. threshold is the biggest leverage point. Recommend:

| Blocker | Recommended action |
|---------|-------------------|
| Low send volume | Run `/outreach-campaign send --city <densest-city>` |
| High bounce rate | Re-enrich `businessEmail` via `source-emails-websites.ts`; check SES reputation |
| Low view rate | Email subject/body copy in `send-unclaimed-emails.ts:buildEmailHtml` |
| Low claim init | Claim CTA on `ViewSpace.tsx`; see `GROWTH_STRATEGY.md` §Claim Flow UX |
| Low approval | Manual approval backlog — check admin dashboard claim queue |
| Low paid conversion | Value prop on pricing cards / dashboard onboarding |

---

## Mode 2: Stage drill-down

If `stage sent` — print by city, by category, by day-of-week, to help the user decide where to run the next batch.
If `stage viewed` — top viewed unclaimed spaces in window (likely candidates for follow-up outreach).
If `stage claim-init` — list the space IDs and business names that initiated claims; useful for an operator who does manual approval.
If `stage claim-approved` — list approved claims with time-to-approval so the operator sees their own latency.
If `stage subscribed` — tier breakdown and any spaces that converted, so the user sees which businesses validated the value prop.

---

## Rules

- **Never assume a schema column exists.** If a query fails (missing column), fall back to `information_schema.columns` to discover what's there and adjust. Report the divergence so the dashboard gets fixed over time.
- **Do not write anything to the database.** Read-only.
- If `psql` credentials aren't in the environment, fail gracefully with instructions on which env vars are needed (`DB_HOST_MAIN_READ`, etc. — consult `scripts/import-spaces/utils/db.ts`).
- Do not fabricate numbers. If a stage's query fails or returns NULL, show `—` and move on.
- Always print the time window and city filter in the report header so a screenshot is self-describing.
- This skill is the scoreboard, not the coach — suggest actions, but don't run them. Pair with `/outreach-campaign` for the acquisition side.
