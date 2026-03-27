---
name: find-space-contacts
description: Find business emails and websites for imported spaces by researching each business on the web, or use automated enrichment/import via manage-space CLI.
disable-model-invocation: true
user-invocable: true
allowed-tools: WebSearch, WebFetch, Bash(npx ts-node scripts/import-spaces/query-spaces*), Bash(npx ts-node scripts/import-spaces/update-space-contact*), Bash(npx ts-node scripts/import-spaces/manage-space*)
argument-hint: [--enrich] [--auto] [--import --category name] [--mode email|website|both] [--city name] [--limit n]
---

# Find Space Contacts

You are a business researcher. Your job is to find accurate business email addresses and websites for spaces in the Therr database.

## Mode Selection

This skill supports three modes based on the arguments provided:

| Arguments | Mode | Description |
|-----------|------|-------------|
| `--auto` | **Automated enrichment** | Run `manage-space --enrich-existing` to auto-find websites, emails, images, descriptions, hours, and phone numbers for existing spaces |
| `--import --category <name>` | **Import + enrich** | Run `manage-space` to import new spaces from OpenStreetMap and auto-enrich them |
| `--enrich` or _(default)_ | **Manual research** | Human-in-the-loop research using WebSearch/WebFetch for higher accuracy |

**How to choose:**
- Use `--auto` for bulk enrichment when speed matters more than perfect accuracy
- Use `--import` when adding new spaces for a city/category
- Use `--enrich` (or no mode flag) for targeted, high-accuracy manual research (e.g., finding emails for outreach)

---

## Mode 1: Automated Enrichment (`--auto`)

When user passes `--auto`, run the manage-space script in `--enrich-existing` mode. Map the user's arguments as follows:

| User passes | Translate to |
|-------------|-------------|
| `--auto` | `--enrich-existing` |
| `--city <name>` | `--city <name>` (pass through) |
| `--limit <n>` | `--limit <n>` (pass through) |
| `--id <uuid>` | `--id <uuid>` (pass through, implies --enrich-existing) |

Example: `/find-space-contacts --auto --city detroit --limit 50` becomes:

```
npx ts-node scripts/import-spaces/manage-space --enrich-existing --city detroit --limit 50
```

The script automatically:
1. Queries existing spaces missing website, email, or image
2. Searches for business websites (using Bing + DuckDuckGo fallback)
3. Crawls websites for emails, descriptions, opening hours, and phone numbers
4. Sources and uploads images from business websites

After the script completes, report the summary it prints (websites, emails, images, descriptions, hours, phones found, and errors).

### Available options for automated mode
- `--city <name>` — Target city (default: all). Available cities are listed in the script help.
- `--limit <n>` — Max spaces to process
- `--delay <ms>` — Delay between web requests in ms (default: 2000)
- `--dry-run` — Preview without making database changes
- `--id <uuid>` — Enrich a single space by ID

---

## Mode 2: Import + Enrich (`--import`)

When user passes `--import`, run manage-space in its default import mode (no `--enrich-existing`). Map arguments:

| User passes | Translate to |
|-------------|-------------|
| `--import` | _(omit — import is the default mode)_ |
| `--category <name>` | `--category <name>` (required) |
| `--city <name>` | `--city <name>` (pass through) |
| `--limit <n>` | `--limit <n>` (pass through) |

Example: `/find-space-contacts --import --city chicago --category cafe --limit 10` becomes:

```
npx ts-node scripts/import-spaces/manage-space --city chicago --category cafe --limit 10
```

This will:
1. Fetch business data from OpenStreetMap for the city/category
2. Deduplicate against existing database spaces
3. Insert new spaces
4. Auto-enrich newly imported spaces with website, email, image, etc.

### Available cities and categories
Run `npx ts-node scripts/import-spaces/manage-space --help` to see the current list of supported cities and categories.

---

## Mode 3: Manual Research (`--enrich` or default)

### Step 1: Query spaces needing enrichment

Run the query script to get a batch of spaces. **Important:** Strip skill-only flags (`--enrich`, `--auto`, `--import`) before passing arguments to `query-spaces`. The script only accepts `--mode`, `--city`, `--category`, and `--limit`.

Map the user's arguments:

| User passes | Translate to |
|-------------|-------------|
| `--enrich` | _(strip — not a query-spaces flag)_ |
| `--city <name>` | `--city <name>` (pass through) |
| `--category <name>` | `--category <name>` (pass through, use `all` if not specified) |
| `--limit <n>` | `--limit <n>` (pass through) |
| `--mode <mode>` | `--mode <mode>` (pass through, default: `both`) |

Example: `/find-space-contacts --enrich --city detroit --limit 10` becomes:

```
npx ts-node scripts/import-spaces/query-spaces --city detroit --limit 10
```

Default arguments if none provided: `--mode both --limit 5`

The script outputs JSON to stdout with space details (id, name, category, address, existing websiteUrl/businessEmail). **It handles all database credentials internally — you will never see or need env vars.**

### Step 2: Research each space

For each space in the results, use `WebSearch` and `WebFetch` to find the business's:
- **Official website** (if missing)
- **Business email address** (if missing)

#### Pre-filtering

Before researching, triage the batch:
- **Skip large national/international chains** (Taco Bell, McDonald's, Marriott, Starbucks, Corner Bakery, etc.) — they don't have individual location emails useful for outreach.
- **Prioritize independent businesses** and local chains — these are most likely to have findable, actionable contact info.

#### Research strategy — work in parallel

**Batch your searches.** Launch WebSearch and WebFetch calls for multiple businesses simultaneously rather than one at a time. For a batch of 10, aim for 2-3 parallel rounds max.

**Round 1 — Initial discovery (parallel):**
- For spaces **with a website**: `WebFetch` the website directly, asking for email addresses, mailto: links, and contact info in the page/footer/schema markup.
- For spaces **without a website**: `WebSearch` for `"Business Name" city state email contact` to find both website and email.

**Round 2 — Follow-up (parallel):**
- If a website was found but no email: `WebFetch` the `/contact` or `/about` page.
- If search results mentioned an email but you need to verify: `WebFetch` the source.
- If a WebFetch returned emails in schema/structured data: those are high confidence, no follow-up needed.

**Round 3 — Stragglers (if needed):**
- For remaining spaces without email: try one more targeted search or check business directories.
- If still nothing: mark as skipped. Don't over-invest.

#### Confidence assessment

- **High**: Business name matches, address matches, email domain matches website domain, or email found in website schema markup
- **Medium**: Business name matches, website looks right, email found in directory listings
- **Low**: Ambiguous match — skip this space

**Only proceed with high or medium confidence matches.**

#### What NOT to do
- Do not guess or fabricate email addresses
- Do not use personal email addresses found on review sites
- Do not associate a website with the wrong business location (e.g., a chain's corporate site for a local franchise, unless that's the only website)
- Do not use social media profile URLs as the website — find the actual business domain

### Step 3: Update each space

For each space where you found contact info with sufficient confidence, run the update script:

```
npx ts-node scripts/import-spaces/update-space-contact --id <space-uuid> [--email "found@email.com"] [--website "https://found-website.com"] [--source-image] [--closed]
```

- Only pass `--email` if you found a business email
- Only pass `--website` if the space didn't have one and you found it
- Add `--source-image` if the space has no media and you found/confirmed a website
- Add `--closed` if web research indicates the business is permanently closed or defunct (sets `isPublic=false`)

The script updates the database and returns a JSON result confirming what was changed.

### Step 4: Report results

After processing all spaces, give a summary table:

| Metric | Count |
|--------|-------|
| Spaces processed | N |
| Chains skipped | N |
| Emails found | N |
| Websites found | N |
| Images sourced | N |
| Marked closed | N |

Then list each updated space with what was changed, and any spaces skipped with the reason (low confidence, chain, no info found, etc.).

## Important rules

- **Accuracy over quantity**: It's better to skip a space than to save wrong data. We will use these emails to contact businesses.
- **Verify before saving**: Always fetch the candidate website and check that it matches the business before calling the update script.
- **One business at a time**: Research each business individually. Don't batch-assume.
- **Respect rate limits**: Pause briefly between web fetches to be a good citizen.
- **No secrets**: You never need database credentials, API keys, or .env files. The scripts handle all of that.
