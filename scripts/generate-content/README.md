# generate-content

CLI scripts that fetch production data and emit/save editorial guide posts
rendered at `/guides/:slug` on therr-client-web.

Driven by the `/generate-content` Claude skill (see
`.claude/skills/generate-content/SKILL.md`). The scripts handle DB access and
file I/O; the LLM does the prose drafting in between.

## Scripts

| Script | Purpose |
| --- | --- |
| `query-top-spaces.ts`     | Rank spaces in a city/category by visit count for **list** posts |
| `query-activity-stats.ts` | Aggregate activity (hour/day/category) for **data** posts |
| `save-post.ts`            | Validate and write a draft post to `therr-client-web/src/content/guides/` |

All scripts read DB credentials from `.env` (same vars as `import-spaces`). All
log to stderr and emit JSON to stdout.

## Output location

Posts land at `therr-client-web/src/content/guides/<slug>.json`, plus an
auto-regenerated `index.json` manifest the Guides index page reads.

## Schema

See `utils/contentSchema.ts` for the `IPost` type and `validatePost` runtime
checks. Posts have a `status: 'draft' | 'published'` flag — drafts are written
to disk but the frontend filters them out of public listings.
