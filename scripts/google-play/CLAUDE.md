# Google Play MCP — working notes

Read `README.md` first for setup. This file is the subset that is not inferable
from the code.

## The one thing to remember

**Google Play is three APIs.** Installs and acquisition are in the **Cloud
Storage reports bucket**. The Play Developer *Reporting* API is vitals only —
crash rate, ANR, memory — and has no business metrics at all. If you find
yourself hunting for an installs metric set, stop; you are on the wrong surface.
Android Publisher is only for track/release state.

## Where the numbers for a growth question come from

| Question | Tool |
|---|---|
| How many installed? | `play_installs` |
| Where did they come from? | `play_acquisition` with `dimension="traffic_source"` |
| Did the store listing convert? | `play_acquisition` — visitors vs acquisitions |
| Did they stay? | `play_retention` |
| When did users actually get this release? | `play_releases` — **not** git merge dates |
| Is the uninstall rate a product problem or a crash problem? | `play_vitals` `crashrate` against the same window |

## Two apps, not comparable

- `com.therr.habits` — Friends With Habits (the active consumer bet, default)
- `app.therrmobile` — Therr flagship. **Not** `com.therr.mobile`; the
  conventional-looking guess returns zero rows, not an error.

`Settings.app()` refuses to guess when neither an app nor a `default_app` is
given, for the same reason the GA4 tooling filters on stream name: silently
folding the two products together produces a report that is wrong in the
flattering direction.

## Release attribution

Git merge dates **lead** the date users received the code, sometimes by a week —
merge, CI build, upload, then a staged rollout over days. Any correlation of a
metric against merge dates overstates how quickly a change took effect. Use
`play_releases` for track state, and Play Console → Releases for historical
rollout dates; the API exposes no per-release publish timestamp.

## Verified against the real bucket

`gs://pubsite_prod_6296484018560789304`. Retention (`retained_installers`) and
`buyers_7d` do **not** exist in this account — `UNAVAILABLE_KINDS` explains that
rather than returning an empty report. `total_store_performance` and
`ratings_v2` exist and are undocumented by Google.

Legitimately empty at current scale, not bugs: `traffic_source` collapses to
`"Other"` below Google's privacy threshold, and `play_vitals` returns no rows
because vitals are suppressed below a minimum user count (Habits ~15 active
devices, Therr ~117).

## Failure modes worth recognising

- **Empty report, `objects_not_found` populated** → wrong package name, or Play
  has not generated that month. Run `play_list_report_files`.
- **Empty report, `objects_read` populated** → the window missed the rows. Play
  lags 2–3 days.
- **403 on vitals/releases but the bucket works** → one of two traps, and
  `describe_failure` tells them apart. `ACCESS_TOKEN_SCOPE_INSUFFICIENT` is the
  ADC scope trap: re-run `gcloud auth application-default login` with the three
  scopes spelled out. `SERVICE_DISABLED` / "requires a quota project" is the
  quota-project trap: set `quota_project` in settings.yaml and
  `gcloud services enable` the API. Neither is a Play Console permissions
  problem, though both read exactly like one. A *plain* 403 with both already
  set is the Play Console invitation.
- **400 quoting a regex at you from vitals** → the metric-set resource name is
  camelCase (`apps/{pkg}/crashRateMetricSet`) and is not derivable from the
  lowercase client method name. Both spellings live in `VITALS_SETS`.
- **Garbage or empty rows with the object clearly present** → a UTF-16 decode
  regression. `tests/test_gcs_reports.py::DecodeTests` guards this.

## Conventions

- `settings.yaml` is gitignored; `settings.example.yaml` is the committed shape.
- Never call `edits().commit()` in `publisher.py`. This tool is read-only by
  construction; the ephemeral edit exists only because Play has no read-only
  track endpoint, and it is always deleted in a `finally`.
- Report tools return provenance (`objects_read` / `objects_not_found` /
  partial-month warnings) rather than bare rows. An assistant cannot distinguish
  "no installs" from "wrong package" from row counts alone, and confidently
  wrong growth analysis is the failure this prevents.

## Branch

`scripts/**` is shared tooling → must land on **`general`**. Committed to a
`niche/*` branch it is dead code with no CI path to `main`.
