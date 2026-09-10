# Google Play MCP (`therr_play`)

Reads Google Play metrics for the two Therr apps and exposes them to Claude Code
as MCP tools, plus a `./therrplay` CLI for debugging outside a session.

Built because there is no other export path. The Play Console UI will not give
you install source or store-listing conversion as data, and the obvious-looking
API — the Play Developer *Reporting* API — does not carry them.

## Google Play is three APIs, not one

The metric you want decides which surface you are on. This is the fact that
makes Play tooling confusing, so it is stated first.

| Surface | Carries | Auth |
|---|---|---|
| **Cloud Storage reports bucket** (`pubsite_prod_*`) | Installs, uninstalls, **acquisition by traffic source**, store-listing conversion, ratings, crashes, reviews | Play Console user/service-account permission |
| **Play Developer Reporting API** | App vitals only — crash rate, ANR rate, slow start, memory, error clusters, anomalies | `playdeveloperreporting` scope |
| **Android Publisher API** | Track releases: which versionCode is live, rollout status and fraction, release notes | `androidpublisher` scope |

**The Reporting API has no installs and no acquisition data.** Its name suggests
otherwise and this costs everyone an hour. Business metrics are in the bucket.

## Setup

### 1. Install

```bash
cd scripts/google-play
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### 2. Configure

```bash
cp settings.example.yaml settings.yaml   # gitignored
```

Fill in `bucket`. Get the URI from **Play Console → Download reports → any
report → Copy Cloud Storage URI**. It looks like
`gs://pubsite_prod_6296484018560789304`. The copy button gives you a path *into*
the bucket; pasting it whole is fine, the first segment is taken.

> The reports bucket is **not in the `therr-app` Cloud project.** It lives in a
> Google-owned project attached to the developer account. `gsutil ls` will never
> list it, and access comes from Play Console permissions, not IAM on our
> project. Both facts send people debugging in the wrong console.

The app packages are already filled in. Note the flagship app's id is
`app.therrmobile` — **not** `com.therr.mobile`. A wrong package name returns zero
rows rather than an error, because a missing monthly report and a typo are
indistinguishable from the client side.

### 3. Authenticate — pick one

**Your own credentials (fastest).** Works today if your Google account already
has Play Console access. Two steps, both required:

```bash
gcloud auth application-default login \
  --scopes=https://www.googleapis.com/auth/cloud-platform,\
https://www.googleapis.com/auth/playdeveloperreporting,\
https://www.googleapis.com/auth/androidpublisher
```

```bash
gcloud services enable playdeveloperreporting.googleapis.com \
  androidpublisher.googleapis.com --project therr-app
```

The `--scopes` flag is not optional. Default ADC carries `cloud-platform` only,
which covers the bucket but neither Play scope — so the bucket tools work, the
vitals and release tools 403, and it reads like a Play Console permissions
problem when it is a scope problem on your laptop.

Then the *second* 403, which looks identical and is not: user credentials carry
no Cloud project, so the Play APIs bill them to gcloud's shared default client
project and refuse with `SERVICE_DISABLED` naming a project number you have
never seen. `quota_project: "therr-app"` in `settings.yaml` fixes it. Both traps
were hit setting this up; `describe_failure` tells the three 403s apart by hand.

**A service account (for anything scheduled).** Three steps, in two consoles,
and skipping any one produces the same 403:

1. Create the service account and download its JSON key (Cloud Console). Put it
   in `~/.therr/`, not the repo.
2. Enable **Google Play Android Developer API** and **Google Play Developer
   Reporting API** on that Cloud project.
3. Invite the service account's email under **Play Console → Users and
   permissions** with at least *View app information and download bulk reports*.
   This takes a few minutes to propagate, and nothing in Cloud Console hints
   that a separate product has to bless the account.

Then set `credentials_path` in `settings.yaml`.

### 4. Verify

```bash
./therrplay check
```

Prints the resolved config, then proves bucket access and Reporting API access
separately — so a partial failure tells you which of the three surfaces is
misconfigured instead of failing as one opaque error.

### 5. Register with Claude Code

Already done via the repo's `.mcp.json`. Claude Code prompts to approve a
project-scoped server the first time. To check it:

```bash
claude mcp list
```

## MCP tools

| Tool | Answers |
|---|---|
| `play_list_apps` | Does auth work, and what can these credentials see |
| `play_installs` | Daily installs / uninstalls / active devices, by overview, country, device, app_version, os_version, carrier, language |
| `play_acquisition` | **Where installs came from** — Play Store search vs Explore vs third-party referrers — and store-listing conversion rate |
| `play_retention` | Explains why Play retention is unavailable, and what to use instead |
| `play_ratings` | Daily average rating and counts |
| `play_crashes` | Daily crash counts from the bucket |
| `play_reviews` | Written reviews (bucket by default, `live=True` for the last week) |
| `play_releases` | Which versionCode is live on which track, and its rollout fraction |
| `play_vitals` | User-weighted crash rate, ANR rate, slow start, memory |
| `play_anomalies` | Anomalies Play's own detection flagged |
| `play_list_report_files` | Raw bucket listing — the diagnostic escape hatch |

## CLI

Same surface, with stack traces instead of JSON error strings:

```bash
./therrplay check
./therrplay ls stats/installs/
./therrplay installs --app habits --days 30
./therrplay acquisition --app habits --dimension traffic_source
./therrplay retention --app habits
./therrplay releases --app habits
./therrplay vitals --app habits --metric-set crashrate
```

## What this account's bucket actually contains

Verified against `gs://pubsite_prod_6296484018560789304`, which differs from
Google's documentation in three ways:

| Report | Status |
|---|---|
| `installs`, `ratings`, `crashes`, `store_performance` | Present, back to 2021 |
| `total_store_performance` | Present, undocumented — unique-user deduplicated |
| `ratings_v2` | Present, undocumented — newer ratings shape |
| `acquisition/retained_installers` | **Absent.** Google retired it; retention is Play Console UI only |
| `acquisition/buyers_7d` | **Absent** |

Note also the bucket prefix: newer developer accounts get `pubsite_prod_<digits>`,
not the `pubsite_prod_rev_<digits>` in Google's docs. Both are handled.

Two things return legitimately empty at this app's scale, and neither is a bug:

- **`traffic_source` collapses to a single `"Other"` row.** Google applies a
  privacy threshold; below it there is no channel breakdown. At a few hundred
  store visitors a month, that is where we are.
- **`play_vitals` returns no rows.** Vitals are suppressed below a minimum
  user count. Friends With Habits has ~15 active devices and Therr ~117; both
  are under it.

## Four things that will waste your time

1. **The CSVs are UTF-16.** Reading one as UTF-8 does not raise — it yields a
   header with a NUL between every character, every column lookup misses, and
   the report comes back empty. Handled in `gcs_reports._decode`, and pinned by
   tests, because this is the classic silent failure with these exports.
2. **The files are monthly; questions are not.** A 34-day window spans two
   objects. `fetch_report` enumerates and concatenates them, tolerating months
   Play has not generated.
3. **Play data lags 2–3 days and the current month's file is partial.** Every
   tool defaults its window to end 3 days ago for this reason, and flags a
   window that includes the current month. A range ending today reliably shows a
   decline that is not real.
4. **A wrong package name looks exactly like no data.** Both give zero rows.
   Every report returns `objects_read` and `objects_not_found` so the two can be
   told apart without guessing — run `play_list_report_files` to settle it.

## Tests

```bash
npm run test:google-play          # from the repo root
```

38 tests, no network. The fixtures encode as UTF-16 with a BOM on purpose.

## Branch

Everything under `scripts/**` is shared tooling and must land on **`general`**.
A `niche/*` branch has no CI path to `main`, so this committed anywhere else is
dead code. See the root `CLAUDE.md`.
