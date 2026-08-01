<!-- Cap: 2,500 chars. Agent maintains via memory-write instructions. -->
# Working Memory

## Active Threads

## Environment Notes
- When a change touches both shared/backend code (`therr-services/**`,
  `therr-public-library/**`, migrations, root config) and niche-only code
  (`TherrMobile/**`, brand-scoped web UI, brand assets/locales), always open
  TWO separate PRs: one targeting `general`, one targeting the niche branch
  (e.g. `niche/HABITS-general`). Never one mixed PR — niche branches have no
  CI path to `main`, so shared code merged there is dead code. Keep each
  commit landable on a single branch so the split is a clean cherry-pick.

## Pending Decisions
