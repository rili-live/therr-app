---
name: seo-audit
description: Audit SSR routes in therr-client-web for required SEO elements — OG tags, geo.position meta, hreflang for all 3 locales, sitemap inclusion, and LocalBusiness JSON-LD on space pages. Priority #1 in GROWTH_STRATEGY.md; silent regressions here kill organic indexing for weeks before Search Console surfaces them.
user-invocable: true
allowed-tools: Bash(curl*), Bash(git diff*), Bash(git status*), Bash(grep*), Bash(find *), Read, Grep, Glob
argument-hint: [audit|changed|route <path>] [--host <url>] [--fix]
---

# SEO Audit

Validate that SSR-rendered routes in `therr-client-web` ship with the SEO metadata the growth strategy depends on. The web client server (`therr-client-web/src/server-client.tsx`) generates meta tags, hreflang links, sitemaps, and JSON-LD per route — any regression here silently kills indexing.

## What "correct SEO" means for this codebase

| Element | Required on | How to verify |
|---------|-------------|---------------|
| `<title>` | every route | non-empty, route-specific (not the default `Therr` fallback) |
| `<meta name="description">` | every route | non-empty, route-specific |
| `og:title`, `og:description`, `og:image`, `og:url`, `og:type` | every route | all five present; og:image resolves to 200 |
| Twitter card (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`) | every route | all four present |
| `<link rel="alternate" hreflang>` | every route | `en-US`, `es-MX`, `fr-CA`, and `x-default` — all four required |
| `<meta name="geo.position">` + `<meta name="geo.placename">` | space pages, city pages | lat/lon format `lat;lon`; placename non-empty |
| `LocalBusiness` JSON-LD | space pages (`/spaces/:id/:slug`) | valid JSON inside `<script type="application/ld+json">`; required fields: `@context`, `@type`, `name`, `address`, `geo` |
| Sitemap inclusion | public static/space/event/group/guide routes | route appears in the corresponding sitemap endpoint below |

## Sitemap endpoints

Served from `therr-client-web/src/server-client.tsx`. Hit these against a running server:

| URL | Covers |
|-----|--------|
| `/sitemap.xml` | Index of all sub-sitemaps |
| `/sitemap-static.xml` | `/`, `/locations`, `/locations/cities`, `/locations/categories`, `/locations/{category}`, `/locations/city/{citySlug}` |
| `/sitemap-city-categories.xml` | `/locations/city/{citySlug}/{categorySlug}` combinations |
| `/sitemap-spaces-N.xml` | Paginated space detail pages |
| `/sitemap-events-N.xml` | Paginated event detail pages |
| `/sitemap-groups-N.xml` | Paginated public group/forum pages |
| `/sitemap-guides.xml` | Editorial guides generated via `/generate-content` |

## Mode Selection

| Argument | Mode |
|----------|------|
| `audit` or _(no args)_ | Run the full suite against a list of representative routes |
| `changed` | Run against routes whose files appear in `git diff HEAD` |
| `route <path>` | Run against a single route path (e.g. `/spaces/abc/joes-pizza`) |

## Common flags

| Flag | Meaning |
|------|---------|
| `--host <url>` | Base URL (default `http://localhost:7070`). Use a running SSR instance, not the dev-only webpack server |
| `--fix` | For missing-hreflang or missing-JSON-LD issues, print the exact code block to add and which file it belongs in — this skill does not edit source files directly |

---

## Mode 1: Audit

### Step 1: Resolve the route list

Default representative set (adjust based on what exists today):
- `/` (home)
- `/locations` (category index)
- `/locations/restaurants` (category landing)
- `/locations/city/chicago-il` (city landing)
- `/locations/city/chicago-il/restaurants` (city+category)
- A recent space: pick any id/slug from the spaces sitemap
- A recent editorial guide: pick any slug from `/sitemap-guides.xml`

### Step 2: Fetch each route

For each route:
```bash
curl -s -L -o /tmp/seo-audit.html -w "%{http_code}" "$HOST$ROUTE"
```

Abort the route if HTTP status ≠ 200. Do not audit a 404 or redirect.

### Step 3: Run checks

Use `grep`/`awk` on the saved HTML. Each check produces ✓ / ✗ with the offending snippet.

- `<title>` present and not equal to the generic fallback
- `<meta name="description"` present and non-empty
- `og:title`, `og:description`, `og:image`, `og:url`, `og:type` — all five tags present
- `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image` — all four present
- hreflang links: count `rel="alternate"` entries — **must be ≥ 4** (en-US, es-MX, fr-CA, x-default)
- For `/spaces/*` and `/locations/city/*` routes: `geo.position` and `geo.placename` meta tags present; `geo.position` content matches `-?\d+\.\d+;-?\d+\.\d+`
- For `/spaces/*` routes: a `<script type="application/ld+json">` block exists; parse the JSON and confirm `@type === "LocalBusiness"`, required fields present

### Step 4: Sitemap inclusion

Fetch the relevant sitemap(s) and verify each audited URL appears as a `<loc>`:
- Space routes → scan `/sitemap-spaces-1.xml` ... `/sitemap-spaces-N.xml`
- City/category routes → `/sitemap-static.xml` and `/sitemap-city-categories.xml`
- Guides → `/sitemap-guides.xml`

Do not walk every paginated sitemap if N is large — use a HEAD request on `/sitemap.xml` to get the index, then search the most recent page first (new content is typically on the last page).

### Step 5: Report

**All clean:**
```
✓ SEO audit passed — 7 route(s) checked
  All required meta, hreflang, geo, JSON-LD, and sitemap inclusion present.
```

**Issues:**
```
⚠ SEO audit — 3 issue(s) across 7 routes

/spaces/abc/joes-pizza
  ✗ Missing LocalBusiness JSON-LD block
  ✗ hreflang count = 2 (need 4: en-US, es-MX, fr-CA, x-default)

/locations/city/chicago-il/restaurants
  ✗ Not included in /sitemap-city-categories.xml

Fix suggestions (use --fix to see the exact code blocks):
  - server-client.tsx renderSpaceRoute(): add LocalBusiness JSON-LD alongside og tags
  - Confirm chicago-il is in CITIES config and that category slug is in the known list
```

---

## Mode 2: Changed

Run `git diff --name-only HEAD` and `git status --short`. If any of these paths changed, map them to routes:

| Changed file | Route(s) to audit |
|--------------|-------------------|
| `src/routes/ViewSpace.tsx` | one space route (pick any id from sitemap) |
| `src/routes/ListSpaces.tsx` or `/locations*` | `/locations`, `/locations/restaurants`, `/locations/city/chicago-il` |
| `src/server-client.tsx` | home + one of each category above (server renders all routes) |
| `src/content/guides/**` | `/sitemap-guides.xml` + one guide route |

If no mapped files changed, print `✓ no SEO-affecting changes detected` and exit.

---

## Mode 3: Route <path>

Audit just the one given route with the full Step 3–4 checks.

---

## Step 6: Persist post-deploy follow-ups to the WIP tracker

If the audit detected sitemap-membership changes, new routes, or missing
hreflang/JSON-LD that were fixed in this run, the user typically also
needs to **re-submit the sitemap to Google Search Console** after deploy
(SEO indexing is the #1 priority in `docs/GROWTH_STRATEGY.md` and silent
regressions there cost weeks of organic traffic).

Append a checkbox line to `docs/WORK_IN_PROGRESS.md` inside the marked
region:

```
<!-- skill-followups:start -->
- [ ] (YYYY-MM-DD, /seo-audit) Re-submit sitemap to Google Search Console
  after the next deploy — <route(s) added/changed>.
<!-- skill-followups:end -->
```

Read the file, locate the start marker, and insert before the end marker.
Skip if an identical line is already there. Skip the entire step if the
audit passed with no route/sitemap changes.

If `docs/WORK_IN_PROGRESS.md` does not exist, surface the item in the
report and skip the file edit.

---

## Rules

- **Never edit `server-client.tsx` from this skill.** Use `--fix` to print the fix and let the developer apply it — SSR meta generation is dense and easy to regress.
- Always audit against a built + served instance, never against the raw webpack dev server (which often skips SSR).
- Do not fabricate "correct" values — if a route is missing a field, report that it's missing, not what it should contain.
- If `curl` fails (server not running), print: "SSR server not reachable at `$HOST`. Start it with `npm run start:web` (or similar) and retry."
- Keep output tight. List issues once per route, not per tag family.
