<!-- Cap: 2,500 chars. Agent maintains via memory-write instructions. -->
# Working Memory

## Active Threads
- (2026-11-05) PR #3173 (habits landing positioning): verify HabitShare/Habitica table cells before merge;
  Play listing + Ads copy still say "no waitlist"/"limited number" — run /aso-listing, /ad-creative.
- (2026-11-05) Trialling Leapd (AI ad automation) on Meta -> habits.therr.com/coaches. Baseline + read plan
  in PAID_ACQUISITION_PLAYBOOK.md decision log. Leapd-owned Meta acct (no Pixel); v1 27 clicks vs 0 GA4 /coaches sessions; v2 w/ UTMs 11-05. Read via prod-db.

## Environment Notes
- Prod DB: use the prod-db skill (scripts/prod-query, read-only); never hand-roll pg scripts.

## Pending Decisions
- (2026-10-28) FwH: whether to run the wk-4 retention query on pacts with an accepted partner, and the
  proposed ~4-wk release freeze to read one cohort. Awaiting user. (/invite/null + Test Lab GA fixed in #3153.)
