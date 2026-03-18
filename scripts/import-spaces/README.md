# Import Spaces CLI

Bulk-import business listings from OpenStreetMap into the Therr database, and source images for imported spaces by crawling their websites.

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

`chicago`, `los-angeles`, `seattle`, `portland`, `eugene`, `mexico-city`, `guadalajara`, `monterrey`, `montreal`, `quebec-city`, `gatineau`, `all`

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
| `--dry-run` | Crawl and log without uploading/updating | off |

#### Image Extraction Strategy

Images are selected in priority order:

1. **`og:image`** meta tag — social preview image, intentionally chosen by the business
2. **`twitter:image`** meta tag — fallback social card image
3. **Largest `<img>` in page body** — filtered to exclude tracking pixels, ads, icons, SVGs, and GIFs
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

#### Idempotency

The script only targets spaces where `mediaIds` is empty/NULL AND `medias IS NULL`, so already-processed spaces are never re-processed. Safe to re-run.

#### Environment

Requires GCS credentials in addition to the standard DB credentials:
- `MAPS_SERVICE_GOOGLE_CREDENTIALS_BASE64` — base64-encoded GCS service account JSON
- `BUCKET_PUBLIC_USER_DATA` — GCS bucket name for public user media

## Data Source

Data comes from the [OpenStreetMap Overpass API](https://overpass-api.de/) (free, no API key required). OSM data is licensed under [ODbL](https://opendatacommons.org/licenses/odbl/).

The script queries OSM by city bounding box and amenity/shop/tourism tags, then maps the results to Therr's space schema including:

- Name, address, city, state, postal code
- Phone number, website URL
- Opening hours (converted to Therr JSON format)
- Category mapping (OSM amenity tags -> Therr categories)
- Geospatial data (PostGIS geometry)

## Architecture

```
scripts/import-spaces/
├── index.ts                 # Import entry point — CLI arg parsing, DB insert
├── source-images.ts         # Source images entry point — crawl, upload, update
├── config.ts                # City bounding boxes, category mappings
├── sources/
│   ├── osm.ts               # Overpass API fetcher (with 429 retry)
│   └── crawl.ts             # Website crawling + image extraction
├── transforms/
│   ├── mapToSpace.ts         # OSM element -> Therr space params
│   └── parseHours.ts         # OSM opening_hours -> Therr JSON
├── utils/
│   ├── deduplicate.ts        # Name + proximity matching
│   ├── validate.ts           # Schema validation before insert
│   ├── gcs.ts               # GCS upload helper
│   └── imageValidation.ts   # Image download + dimension validation
├── tsconfig.json
├── .env                      # Local DB + GCS credentials (gitignored)
└── README.md
```

## Error Handling

- **Overpass API 429/503/504**: Retries up to 3 times with exponential backoff (10s, 20s, 40s)
- **DB constraint violations**: Logged and skipped (e.g., overlapping geometries)
- **Invalid data**: Filtered out during validation step

## Adding Cities

Add a new entry to `CITIES` in `config.ts` with the city name, state, and bounding box coordinates (south, west, north, east). Use [bboxfinder.com](http://bboxfinder.com/) to find coordinates.

## Adding Categories

1. Add OSM tags to `OSM_CATEGORY_MAP` in `config.ts`
2. Add the tag-to-Therr-category mapping in `OSM_TO_THERR_CATEGORY`
