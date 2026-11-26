<!-- Cap: 2,500 chars. Agent maintains via memory-write instructions. -->
# Working Memory

## Active Threads
- (2026-11-05) Play listing + Ads copy still say "no waitlist"/"limited number" — run /aso-listing, /ad-creative.
- (2026-11-11) Recommended pausing Leapd/Meta + Google Ads: the bottleneck is invite->join and wk-2 retention,
  not traffic (205 real accounts, 39 ever checked in, paired wk-4 0/22). Confirm whether paused.

## Environment Notes
- Prod DB: use the prod-db skill (scripts/prod-query, read-only); never hand-roll pg scripts.

## Pending Decisions
- (decided 2026-11-26) Open-pact handoff: prefer an active partner as host, else oldest requester; host must be
  active in 7d (requesting counts); former creator + partners get a push. Open: sign-of-life misses app opens.
