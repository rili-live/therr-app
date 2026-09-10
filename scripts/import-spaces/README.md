# Import Spaces CLI

Bulk-import business listings from OpenStreetMap into the Therr database, then enrich those listings by crawling their websites for images, contact details, and metadata.

## Which script do I want?

| Goal | Script |
|------|--------|
| See what's missing and what's actionable | `stats` |
| Add businesses from OSM | `index` (the importer) |
| Attach a photo | `source-images` |
| Find a website / business email | `source-emails-websites` |
| Fill menu, order, reservation, phone, hours, cuisine | `enrich-metadata` |

**Start with `stats`.** It separates *missing* from *actionable*: a space with no
image and no website can't be helped by `source-images`, so counting it in that
backlog is misleading.

```bash
npx ts-node scripts/import-spaces/stats
npx ts-node scripts/import-spaces/stats --by-city
```

## Setup

1. Create a `.env` file in this directory (`scripts/import-spaces/.env`):

```env
DB_HOST_MAIN_WRITE=<your-db-host>
DB_USER_MAIN_WRITE=<your-db-user>
DB_PASSWORD_MAIN_WRITE=<your-db-password>
DB_PORT_MAIN_WRITE=5432
MAPS_SERVICE_DATABASE=<your-db-name>

# Required for source-images script (GCS upload)
MAPS_SERVICE_GOOGLE_CREDENTIALS_BASE64=<base64-encoded-gcs-credentials>
BUCKET_PUBLIC_USER_DATA=<gcs-bucket-name>
```

If no local `.env` is found, the script falls back to the root `.env`.

2. Ensure dependencies are installed (run from project root):

```bash
npm install
```

## Usage

### 1. Import Spaces (from OSM)

```bash
npx ts-node scripts/import-spaces [options]
```

Run `--help` for full details:

```bash
npx ts-node scripts/import-spaces --help
```

#### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--source <name>` | Data source | `osm` |
| `--city <name>` | Target city | `chicago` |
| `--category <name>` | Business category | `restaurant` |
| `--limit <n>` | Max total spaces to insert | no limit |
| `--user-id <uuid>` | Owner user ID for created spaces | `568bf5d2-...` |
| `--dry-run` | Preview without inserting | off |
| `--skip-dedup` | Skip duplicate check against DB | off |

#### Cities

Run any script with `--help` for the current list — it is generated from
`CITIES` in `config.ts`, so it never goes stale. At time of writing: `chicago`,
`naperville`, `detroit`, `los-angeles`, `seattle`, `portland`, `eugene`,
`indianapolis`, `new-york`, `miami`, `san-antonio`, `houston`, `el-paso`,
`dallas`, `phoenix`, `philadelphia`, `san-francisco`, `denver`, `atlanta`,
`boise`, `huntsville`, `spokane`, `salt-lake-city`, `richmond`, `chattanooga`,
`des-moines`, `greenville`, `fort-collins`, `bozeman`, `mexico-city`,
`guadalajara`, `monterrey`, `montreal`, `quebec-city`, `gatineau`, `all`

#### Categories

`restaurant`, `cafe`, `bar`, `shop`, `hotel`, `gym`, `all`

#### Examples

Preview Chicago restaurants:

```bash
npx ts-node scripts/import-spaces --city chicago --category restaurant --dry-run
```

Import 100 cafes across all cities:

```bash
npx ts-node scripts/import-spaces --city all --category cafe --limit 100 --skip-dedup
```

Import everything (first run, no dedup needed):

```bash
npx ts-node scripts/import-spaces --city all --category all --skip-dedup
```

### 2. Source Images

Crawl websites of imported spaces to find and attach representative images. This script targets spaces that have a `websiteUrl` but no images (`mediaIds` is empty or NULL, and `medias IS NULL`).

```bash
npx ts-node scripts/import-spaces/source-images [options]
```

Run `--help` for full details:

```bash
npx ts-node scripts/import-spaces/source-images --help
```

#### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--city <name>` | Filter by addressLocality | `all` |
| `--category <name>` | Filter by Therr category string (e.g. `categories.restaurant/food`) | `all` |
| `--limit <n>` | Max spaces to process | no limit |
| `--delay <ms>` | Delay between requests in ms | `2000` |
| `--user-id <uuid>` | Override fromUserId for media records | `568bf5d2-...` |
| `--deep` | On pages with no usable image, also try `/about`, `/menu`, `/gallery` | off |
| `--dry-run` | Crawl and validate without uploading/updating | off |
| `--no-skip-processed` | Re-process spaces even if previously attempted | off |
| `--retry-failed` | Clear the `no-image-found` list first, then run | off |

#### Image Extraction Strategy

Candidates are collected in priority order, and each is downloaded and
dimension-checked until one passes — so a broad candidate list costs nothing
when the first choice is good and rescues pages where it isn't.

1. **schema.org JSON-LD `image`** — the business's own declared photo
2. **`og:image`** meta tag — social preview image, intentionally chosen by the business
3. **`twitter:image`** meta tag — fallback social card image
4. **`<link rel="image_src">`** — legacy hint still emitted by older CMSs
5. **Largest `<img>` in page body** — including `srcset` and lazy-load attributes (`data-src`, `data-lazy-src`, `data-original`)
6. **CSS `background-image`** — hero images on site builders often have no `<img>` tag at all
7. **`apple-touch-icon`** — weak last resort; usually a logo, but a logo beats a blank card

With `--deep`, a page that yields nothing is retried against `/about`, `/menu`,
`/gallery`, `/photos`, and `/our-story`.

All images must be at least 200x200 pixels. Supported formats: JPEG, PNG, WebP.

#### Examples

Dry run — preview which images would be sourced for Eugene spaces:

```bash
npx ts-node scripts/import-spaces/source-images --city eugene --dry-run --limit 5
```

Source images for 10 restaurant spaces:

```bash
npx ts-node scripts/import-spaces/source-images --category "categories.restaurant/food" --limit 10
```

Source images for all spaces (with slower rate limiting):

```bash
npx ts-node scripts/import-spaces/source-images --delay 3000
```

Revisit spaces that failed under an older, weaker extractor:

```bash
npx ts-node scripts/import-spaces/source-images --retry-failed --deep --limit 200
```

#### Idempotency

The script targets spaces where `mediaIds` is empty/NULL AND `medias IS NULL`,
and additionally excludes any space already listed in `image-found.json` or
`no-image-found.json`. Safe to re-run.

That exclusion happens **in SQL, before `LIMIT` is applied**, so `--limit 50`
means "50 spaces I have not tried yet". (It used to filter in JS after the
query, which meant a capped run sampled 50 rows at random from the whole
eligible set — mostly already-processed ones — and then did almost nothing.
That looked identical to the script being broken.)

`--dry-run` downloads and validates candidates, skipping only the GCS upload and
DB write, so its counts match what a real run would save. Reporting raw
candidate counts over-stated the yield, because most candidates fail the
200x200 check.

> **`--retry-failed` is how you benefit from extraction improvements.** Once a
> space is in `no-image-found.json` it is skipped forever, even after the
> crawler learns new tricks. Clearing that list re-opens those spaces.
> It only deletes local tracking state, never database rows.

#### Environment

Requires GCS credentials in addition to the standard DB credentials:
- `MAPS_SERVICE_GOOGLE_CREDENTIALS_BASE64` — base64-encoded GCS service account JSON
- `BUCKET_PUBLIC_USER_DATA` — GCS bucket name for public user media

### 3. Source Emails & Websites

Find business email addresses by crawling websites, and discover websites for spaces that don't have one via web search. Business emails enable future outreach to encourage businesses to claim and manage their own spaces.

```bash
npx ts-node scripts/import-spaces/source-emails-websites [options]
```

Run `--help` for full details:

```bash
npx ts-node scripts/import-spaces/source-emails-websites --help
```

#### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--city <name>` | Filter by addressLocality | `all` |
| `--category <name>` | Filter by Therr category string | `all` |
| `--mode <mode>` | What to find: `email`, `website`, or `both` | `both` |
| `--limit <n>` | Max spaces to process | no limit |
| `--delay <ms>` | Delay between requests in ms | `2000` |
| `--user-id <uuid>` | Override fromUserId for media records | `568bf5d2-...` |
| `--source-images` | Also source images for spaces with a website but no media | off |
| `--dry-run` | Crawl and log without updating | off |

#### Modes

- **`email`**: Crawls existing `websiteUrl` for email addresses (mailto links, contact pages, plaintext patterns)
- **`website`**: Searches the web (DuckDuckGo) to discover websites for spaces that lack one. Only saves when confidence is high (business name matches domain/page title).
- **`both`**: Runs email extraction first, then website discovery

#### Email Extraction Strategy

Emails are extracted in priority order:

1. **schema.org JSON-LD `email`** — declared by the business itself
2. **`mailto:` links** on the homepage
3. **Plaintext email patterns** in the page body
4. **Contact/About page** — if no emails found on the homepage, follows `/contact`, `/about` links and repeats

Emails are filtered to reject noreply addresses, social media domains, and false positives. Emails matching the website's own domain are ranked highest.

#### Website Discovery

Uses DuckDuckGo HTML search with the business name + city + region. Confidence checks:

1. The search result domain or title must match the business name (fuzzy word matching)
2. The actual page `<title>` is fetched to double-check the match

Only high-confidence matches are saved to avoid associating wrong websites with spaces.

#### Examples

Preview email extraction for Eugene spaces:

```bash
npx ts-node scripts/import-spaces/source-emails-websites --mode email --city eugene --dry-run --limit 5
```

Find websites for spaces without one:

```bash
npx ts-node scripts/import-spaces/source-emails-websites --mode website --city chicago --limit 20
```

Full pipeline — emails, websites, and images:

```bash
npx ts-node scripts/import-spaces/source-emails-websites --mode both --source-images --limit 100
```

#### Idempotency

- Email mode targets spaces where `businessEmail IS NULL` and `websiteUrl` exists
- Website mode targets spaces where `websiteUrl IS NULL` or empty

Already-processed spaces are excluded in SQL before `LIMIT` is applied, same as
`source-images`. Safe to re-run.

#### Environment

Standard DB credentials required. If `--source-images` is used, GCS credentials are also needed:
- `MAPS_SERVICE_GOOGLE_CREDENTIALS_BASE64` — base64-encoded GCS service account JSON
- `BUCKET_PUBLIC_USER_DATA` — GCS bucket name for public user media

### 4. Enrich Metadata

Fill in the fields that make a listing feel complete: menu / order / reservation
links, phone, opening hours, and cuisine.

```bash
npx ts-node scripts/import-spaces/enrich-metadata [options]
```

#### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--city <name>` | Filter by addressLocality | `all` |
| `--category <name>` | Filter by Therr category string | `all` |
| `--fields <list>` | Comma-separated: `phone,menu,order,reservation,price,cuisine,hours` | all |
| `--limit <n>` | Max spaces to process | `50` |
| `--delay <ms>` | Delay between requests in ms | `2000` |
| `--dry-run` | Crawl and log without updating | off |

#### Extraction Strategy

Primary source is the page's schema.org JSON-LD `LocalBusiness` / `Restaurant`
node, which carries `telephone`, `menu`, `priceRange`, `servesCuisine`,
`openingHoursSpecification`, and `potentialAction` (Order/Reserve) in one parse.
Sites built on Squarespace, Wix, Shopify, Toast, Square, BentoBox, and WordPress
SEO plugins all publish it.

When JSON-LD is absent, it falls back to link heuristics:

- **Order URL** — links to Toast, DoorDash, Uber Eats, Grubhub, ChowNow, Slice, Olo, Square, Clover, and friends, or anchor text like "Order Online"
- **Reservation URL** — links to OpenTable, Resy, SevenRooms, Tock, Quandoo, or anchor text like "Book a Table"
- **Menu URL** — anchor text "Menu" or an href matching `/menu`
- **Phone** — `tel:` hrefs, then a conservative North American number pattern in page text

`openingHours` handles both schema shapes (the `"Mo-Fr 08:00-17:00"` string form
and structured `openingHoursSpecification` objects), normalizing both to the
same `{ schema, timezone, isConfirmed }` format `parseOsmHours` produces.

#### Safety

Only columns that are currently NULL/empty are written — an operator's or
business owner's own value is never overwritten. The `UPDATE` includes only the
fields actually found.

> `--fields price` is effectively inert today: `priceRange` is NOT NULL for every
> row in production (mostly the default `2`), so nothing matches the "missing"
> predicate. Left in place for when that column starts out empty.

#### Examples

```bash
# Preview what would be filled in
npx ts-node scripts/import-spaces/enrich-metadata --dry-run --limit 10

# Order and reservation links for Chicago
npx ts-node scripts/import-spaces/enrich-metadata --city chicago --fields order,reservation --limit 50

# Cuisine only, across restaurants
npx ts-node scripts/import-spaces/enrich-metadata --fields cuisine --category "categories.restaurant/food" --limit 100
```

### 5. Stats

Coverage report and actionable backlog. No writes, no crawling — safe to run any time.

```bash
npx ts-node scripts/import-spaces/stats
npx ts-node scripts/import-spaces/stats --by-city
npx ts-node scripts/import-spaces/stats --city chicago
```

## Data Source

Data comes from the [OpenStreetMap Overpass API](https://overpass-api.de/) (free, no API key required). OSM data is licensed under [ODbL](https://opendatacommons.org/licenses/odbl/).

The script queries OSM by city bounding box and amenity/shop/tourism tags, then maps the results to Therr's space schema including:

- Name, address, city, state, postal code
- Phone number, business email, website URL
- Opening hours (converted to Therr JSON format)
- Category mapping (OSM amenity tags -> Therr categories)
- Geospatial data (PostGIS geometry)

## Architecture

```
scripts/import-spaces/
├── index.ts                  # Import entry point — CLI arg parsing, DB insert
├── source-images.ts          # Source images entry point — crawl, upload, update
├── source-emails-websites.ts # Source emails/websites — email extraction, web search
├── enrich-metadata.ts        # Menu/order/reservation/phone/hours/cuisine enrichment
├── stats.ts                  # Coverage report + actionable backlog
├── config.ts                 # City bounding boxes, category mappings
├── sources/
│   ├── osm.ts                # Overpass API fetcher (with 429 retry)
│   ├── jsonLd.ts             # schema.org JSON-LD business-node extraction
│   ├── crawl.ts              # Website crawling + image extraction
│   ├── crawlEmails.ts        # Website crawling + email extraction
│   └── searchWeb.ts          # Bing/DuckDuckGo search for business websites
├── transforms/
│   ├── mapToSpace.ts         # OSM element -> Therr space params
│   ├── parseHours.ts         # OSM opening_hours -> Therr JSON
│   └── parseSchemaHours.ts   # schema.org hours -> Therr JSON (same output shape)
├── utils/
│   ├── deduplicate.ts        # Name + proximity matching
│   ├── validate.ts           # Schema validation before insert
│   ├── db.ts                 # Shared Postgres pool factory
│   ├── httpFetch.ts          # Shared HTML fetch (UA rotation, retry, redirects)
│   ├── processedSpaces.ts    # Per-type processed-ID tracking + SQL exclusion
│   ├── sourceImage.ts        # Shared crawl -> validate -> upload -> DB pipeline
│   ├── gcs.ts                # GCS upload helper
│   └── imageValidation.ts    # Image download + dimension validation
├── data/processed/           # Local tracking JSON (gitignored)
├── tsconfig.json
├── .env                      # Local DB + GCS credentials (gitignored)
└── README.md
```

### Processed-spaces tracking

`data/processed/*.json` records which spaces have been attempted per lookup type
(`image-found`, `no-image-found`, `no-website-found`, …). These are **local to
your machine** and gitignored, so counts differ per environment.

Two consequences worth knowing:

- A space in a `no-*-found` file is skipped forever. After improving extraction,
  clear the relevant file (`source-images --retry-failed`) or those spaces never
  get another chance.
- Deleting the whole `data/processed/` directory is safe — the scripts fall back
  to the database predicates and simply re-attempt everything.

## Error Handling

- **Overpass API 429/503/504**: Retries up to 3 times with exponential backoff (10s, 20s, 40s)
- **DB constraint violations**: Logged and skipped (e.g., overlapping geometries)
- **Invalid data**: Filtered out during validation step

## Adding Cities

Add a new entry to `CITIES` in `config.ts` with the city name, state, and bounding box coordinates (south, west, north, east). Use [bboxfinder.com](http://bboxfinder.com/) to find coordinates.

## Adding Categories

1. Add OSM tags to `OSM_CATEGORY_MAP` in `config.ts`
2. Add the tag-to-Therr-category mapping in `OSM_TO_THERR_CATEGORY`
