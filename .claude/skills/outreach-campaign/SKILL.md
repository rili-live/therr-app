---
name: outreach-campaign
description: Orchestrate B2B outreach email campaigns with preflight safety checks — SES bounce rate, blacklist freshness, dedupe counts, warm-up caps — then run throttled batches and report post-send metric deltas. Wraps scripts/import-spaces/send-unclaimed-emails.ts which per GROWTH_STRATEGY.md is the central activation lever for the 90-day revenue milestone.
disable-model-invocation: true
user-invocable: true
allowed-tools: Bash(npx ts-node scripts/import-spaces/*), Bash(psql*), Bash(aws ses*), Read, Grep
argument-hint: [preflight|send|status] [--city <name>] [--category <str>] [--limit <n>] [--delay <ms>] [--dry-run]
---

# Outreach Campaign Runner

`scripts/import-spaces/send-unclaimed-emails.ts` is the central B2B activation script. Running it correctly requires preflight checks that are easy to forget: SES reputation (bounce rate must stay under 5%), blacklist freshness, dedupe counts, warm-up cap ramp from 50/day. This skill wraps the full workflow so a single command is safe to run.

**Why this matters:** Per `docs/GROWTH_STRATEGY.md`, the 90-day validation target is *1 paid subscription*. A botched batch (deliverability hit from bounces) can cost weeks of SES reputation recovery.

## Mode Selection

| Argument | Mode |
|----------|------|
| `preflight` or _(no args)_ | Run all safety checks, print go/no-go, do NOT send |
| `send` | Run preflight, then if green, execute the throttled send |
| `status` | Print recent-campaign metrics (sends, bounces, claim initiations) without running anything |

## Common flags

| Flag | Meaning |
|------|---------|
| `--city <name>` | Target city (see `scripts/import-spaces/config.ts` for list) |
| `--category <str>` | Therr category string, e.g. `categories.restaurant/food` |
| `--limit <n>` | Max sends in this batch (default 50 — DO NOT exceed until warm) |
| `--delay <ms>` | Delay between sends (default 500ms) |
| `--dry-run` | Forwarded to the underlying script — queries but does not send or write metrics |

---

## Mode 1: Preflight (default)

Preflight must pass before any `send`. Each check produces a ✓ / ⚠ / ✗ line.

### Check 1 — SES sender reputation

Call the AWS SES v2 API if credentials are in the environment:
```bash
aws sesv2 get-account --region "$AWS_SES_REGION" 2>&1
```

Parse `SendingEnabled`, `ProductionAccessEnabled`, and the current 24-hour send/bounce/complaint rates. Thresholds:
- **Bounce rate ≥ 5%** → ✗ **block send**, print the rate and advise investigating `main.blacklistedEmails`.
- **Complaint rate ≥ 0.1%** → ✗ **block send**.
- **Sending not enabled** → ✗ **block send**, print SES status.

If `aws` CLI or credentials are absent, print ⚠ and ask the user to check the SES dashboard manually before continuing.

### Check 2 — Blacklist freshness

```sql
SELECT COUNT(*) AS total, MAX("createdAt") AS most_recent
FROM main."blacklistedEmails";
```

Run via `psql` against `USERS_SERVICE_DATABASE`. If `most_recent` is older than 14 days **and** the last batch sent > 100 emails (check via `userMetrics`), print ⚠ — bounce webhooks may be mis-wired. Do not auto-block, but surface the concern.

### Check 3 — Dedupe inventory

For the planned batch (respecting `--city` / `--category` / `--limit`), compute:
- **Candidates**: spaces matching the query in `send-unclaimed-emails.ts:queryUnclaimedSpaces`.
- **Already emailed**: rows in `main."userMetrics"` with `name = 'space.marketing.unclaimedEmailSent'` overlapping the candidate IDs.
- **Blacklisted**: businessEmails present in `main."blacklistedEmails"`.

Report:
```
  Candidates:       320
  Already emailed:  45
  Blacklisted:      12
  Will send:        50 (capped by --limit)
```

If `Will send == 0`, print ✗ and explain (no inventory, fully dedupe'd, or filter too narrow).

### Check 4 — Warm-up cap

Query the last 24 hours of `SPACE_UNCLAIMED_EMAIL_SENT` metrics:
```sql
SELECT COUNT(*) FROM main."userMetrics"
WHERE name = 'space.marketing.unclaimedEmailSent'
  AND "createdAt" > NOW() - INTERVAL '24 hours';
```

Warm-up ladder (SES reputation best practice):
| Last-24h sends | Safe next batch |
|----------------|-----------------|
| 0–50 | 50 |
| 51–200 | 100 |
| 201–1000 | 200 |
| 1001+ | 500 |

If the requested `--limit` exceeds the safe cap, print ⚠ and propose the safe cap. In `send` mode, cap the limit automatically and report the adjustment.

### Check 5 — Brief

Print a one-paragraph brief the user can confirm before sending:

```
Preflight passed ✓

  Target:    city=chicago category=all
  Will send: 50 spaces (limit), ~25s duration (500ms delay)
  SES:       bounce 1.2%, complaint 0.03%, sending enabled
  Inventory: 320 candidates, 45 already emailed, 50 to send
  Warm-up:   123 sent in last 24h, cap for next batch = 200

Next: /outreach-campaign send --city chicago --limit 50
```

---

## Mode 2: Send

1. Run **all preflight checks** (Mode 1). Abort on any ✗.
2. If any ⚠ remains, print them and require explicit confirmation from the user before proceeding.
3. Invoke the underlying script, streaming output:

```bash
npx ts-node scripts/import-spaces/send-unclaimed-emails \
  --city "$CITY" --category "$CATEGORY" --limit "$LIMIT" --delay "$DELAY"
```

4. After completion, run `status` (Mode 3) to show the post-send delta.

---

## Mode 3: Status

Query recent campaign performance from `users-service` DB. Always look at the last 30 days so the numbers reflect meaningful deliverability trends.

```sql
-- Sends in last 30d
SELECT COUNT(*) AS sent_30d
FROM main."userMetrics"
WHERE name = 'space.marketing.unclaimedEmailSent'
  AND "createdAt" > NOW() - INTERVAL '30 days';

-- Sends by city (top 10)
SELECT dimensions->>'city' AS city, COUNT(*) AS n
FROM main."userMetrics"
WHERE name = 'space.marketing.unclaimedEmailSent'
  AND "createdAt" > NOW() - INTERVAL '30 days'
GROUP BY 1 ORDER BY 2 DESC LIMIT 10;

-- Blacklist growth
SELECT COUNT(*) FILTER (WHERE "createdAt" > NOW() - INTERVAL '30 days') AS added_30d,
       COUNT(*) AS total
FROM main."blacklistedEmails";
```

Also surface the adjacent funnel stages by delegating to the `claim-funnel-analyzer` skill (if available) — outreach-campaign owns "sent", `claim-funnel-analyzer` owns the downstream conversion.

Report format:
```
Outreach status — last 30 days

  Sent:        427
  Bounced:     12 (blacklist growth)
  Top cities:  chicago (220), los-angeles (90), seattle (55)
  Bounce %:    2.8% — within the 5% ceiling

Next: run /claim-funnel-analyzer for downstream conversion.
```

---

## Rules

- **Never exceed the SES warm-up cap** without explicit user confirmation. Reputation damage is days-to-weeks to recover.
- **Always run preflight before send.** Do not allow a bare `send` without preflight passing.
- Only target one city per batch in the first 10 batches (while SES reputation is warming). Cross-city batches diffuse deliverability signal.
- Never fabricate bounce or inventory numbers — if a check can't run (missing creds, no DB access), report that clearly and stop instead of proceeding.
- This skill does **not** touch code. It only runs existing scripts and queries.
