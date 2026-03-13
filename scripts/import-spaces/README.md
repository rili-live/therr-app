# Import Spaces CLI

Bulk-import business listings from OpenStreetMap into the Therr database.

## Setup

1. Create a `.env` file in this directory (`scripts/import-spaces/.env`):

```env
DB_HOST_MAIN_WRITE=<your-db-host>
DB_USER_MAIN_WRITE=<your-db-user>
DB_PASSWORD_MAIN_WRITE=<your-db-password>
DB_PORT_MAIN_WRITE=5432
MAPS_SERVICE_DATABASE=<your-db-name>
```

If no local `.env` is found, the script falls back to the root `.env`.

2. Ensure dependencies are installed (run from project root):

```bash
npm install
```

## Usage

```bash
npx ts-node scripts/import-spaces [options]
```

Run `--help` for full details:

```bash
npx ts-node scripts/import-spaces --help
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--source <name>` | Data source | `osm` |
| `--city <name>` | Target city | `chicago` |
| `--category <name>` | Business category | `restaurant` |
| `--limit <n>` | Max total spaces to insert | no limit |
| `--user-id <uuid>` | Owner user ID for created spaces | `568bf5d2-...` |
| `--dry-run` | Preview without inserting | off |
| `--skip-dedup` | Skip duplicate check against DB | off |

### Cities

`chicago`, `los-angeles`, `seattle`, `portland`, `eugene`, `all`

### Categories

`restaurant`, `cafe`, `bar`, `shop`, `hotel`, `gym`, `all`

## Examples

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
├── index.ts                 # Entry point, CLI arg parsing, DB insert
├── config.ts                # City bounding boxes, category mappings
├── sources/
│   └── osm.ts               # Overpass API fetcher (with 429 retry)
├── transforms/
│   ├── mapToSpace.ts         # OSM element -> Therr space params
│   └── parseHours.ts         # OSM opening_hours -> Therr JSON
├── utils/
│   ├── deduplicate.ts        # Name + proximity matching
│   └── validate.ts           # Schema validation before insert
├── tsconfig.json
├── .env                      # Local DB credentials (gitignored)
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
