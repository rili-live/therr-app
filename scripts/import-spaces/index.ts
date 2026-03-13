#!/usr/bin/env node
/**
 * CLI tool to bulk-import spaces from OpenStreetMap into the Therr database.
 *
 * Usage:
 *   npx ts-node scripts/import-spaces --source osm --city chicago --category restaurant --dry-run
 *   npx ts-node scripts/import-spaces --source osm --city all --category all
 *
 * Requires .env at project root with DB_HOST_MAIN_WRITE, DB_USER_MAIN_WRITE, etc.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Pool } from 'pg';
import { CITIES, BATCH_SIZE, IMPORT_USER_ID, OSM_CATEGORY_MAP } from './config';
import { fetchOsmData } from './sources/osm';
import { mapOsmToSpace, ISpaceInsertParams } from './transforms/mapToSpace';
import { findDuplicates, deduplicateWithinBatch } from './utils/deduplicate';
import { validateSpace } from './utils/validate';

// Load .env from scripts/import-spaces/ first, fall back to root .env
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ── Help ─────────────────────────────────────────────────────────────────────
function printHelp() {
  const cityList = Object.keys(CITIES).join(', ');
  const categoryList = Object.keys(OSM_CATEGORY_MAP).join(', ');

  console.log(`
Import Spaces CLI — Bulk-import business listings from OpenStreetMap into Therr.

Usage:
  npx ts-node scripts/import-spaces [options]

Options:
  --source <name>      Data source (default: osm)
                       Available: osm
  --city <name>        Target city (default: chicago)
                       Available: ${cityList}, all
  --category <name>    Business category (default: restaurant)
                       Available: ${categoryList}
  --limit <n>          Max total spaces to insert (default: no limit)
  --user-id <uuid>     Owner user ID for created spaces
                       (default: ${IMPORT_USER_ID})
  --dry-run            Preview results without inserting into database
  --skip-dedup         Skip duplicate checking against existing DB records
  --help, -h           Show this help message

Examples:
  npx ts-node scripts/import-spaces --source osm --city chicago --category restaurant --dry-run
  npx ts-node scripts/import-spaces --city all --category all --limit 500
  npx ts-node scripts/import-spaces --city seattle --category cafe --skip-dedup --limit 100

Environment:
  Reads DB credentials from scripts/import-spaces/.env (preferred) or root .env.
  Required vars: DB_HOST_MAIN_WRITE, DB_USER_MAIN_WRITE, DB_PASSWORD_MAIN_WRITE,
                 DB_PORT_MAIN_WRITE, MAPS_SERVICE_DATABASE
`);
}

interface ICliArgs {
  source: string;
  city: string;
  category: string;
  dryRun: boolean;
  skipDedup: boolean;
  limit: number;
  userId: string;
}

// ── CLI arg parsing ──────────────────────────────────────────────────────────
function parseArgs(): ICliArgs {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') {
      printHelp();
      process.exit(0);
    } else if (args[i] === '--dry-run') {
      parsed.dryRun = 'true';
    } else if (args[i] === '--skip-dedup') {
      parsed.skipDedup = 'true';
    } else if (args[i].startsWith('--') && i + 1 < args.length) {
      parsed[args[i].replace('--', '')] = args[i + 1];
      i++;
    }
  }

  return {
    source: parsed.source || 'osm',
    city: parsed.city || 'chicago',
    category: parsed.category || 'restaurant',
    dryRun: parsed.dryRun === 'true',
    skipDedup: parsed.skipDedup === 'true',
    limit: parsed.limit ? parseInt(parsed.limit, 10) : 0, // 0 = no limit
    userId: parsed['user-id'] || IMPORT_USER_ID,
  };
}

// ── DB connection ────────────────────────────────────────────────────────────
function createDbPool(): Pool {
  return new Pool({
    host: process.env.DB_HOST_MAIN_WRITE,
    user: process.env.DB_USER_MAIN_WRITE,
    password: process.env.DB_PASSWORD_MAIN_WRITE,
    database: process.env.MAPS_SERVICE_DATABASE,
    port: Number(process.env.DB_PORT_MAIN_WRITE) || 5432,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });
}

// ── Insert spaces ────────────────────────────────────────────────────────────
async function insertSpaces(db: Pool, spaces: ISpaceInsertParams[]): Promise<number> {
  let inserted = 0;

  for (let i = 0; i < spaces.length; i += BATCH_SIZE) {
    const batch = spaces.slice(i, i + BATCH_SIZE);

    for (const space of batch) {
      try {
        const result = await db.query(
          `INSERT INTO main.spaces
            ("fromUserId", locale, "isPublic", message, "notificationMsg",
             "mediaIds", "mentionsIds", "hashTags", "maxViews",
             latitude, longitude, radius, "polygonCoords", "maxProximity",
             "doesRequireProximityToView", "isMatureContent", "isModeratorApproved",
             "isForSale", "isHirable", "isPromotional", "isExclusiveToGroups",
             category, "areaType", valuation, region,
             "addressReadable", "addressStreetAddress", "addressRegion", "addressLocality", "postalCode",
             "phoneNumber", "websiteUrl", "isPointOfInterest", "openingHours",
             geom, "geomCenter")
          VALUES
            ($1, $2, $3, $4, $5,
             $6, $7, $8, $9,
             $10::float8, $11::float8, $12::float8, $13::jsonb, $14::float8,
             $15, $16, $17,
             $18, $19, $20, $21,
             $22, $23, $24, $25,
             $26, $27, $28, $29, $30::integer,
             $31, $32, $33, $34::jsonb,
             ST_SetSRID(ST_Buffer(ST_MakePoint($11::float8, $10::float8)::geography, $35::float8)::geometry, 4326),
             ST_SetSRID(ST_MakePoint($11::float8, $10::float8), 4326))
          ON CONFLICT DO NOTHING
          RETURNING id`,
          [
            space.fromUserId, space.locale, space.isPublic, space.message, space.notificationMsg,
            space.mediaIds, space.mentionsIds, space.hashTags, space.maxViews,
            space.latitude, space.longitude, space.radius, space.polygonCoords, space.maxProximity,
            space.doesRequireProximityToView, space.isMatureContent, space.isModeratorApproved,
            space.isForSale, space.isHirable, space.isPromotional, space.isExclusiveToGroups,
            space.category, space.areaType, space.valuation, space.region,
            space.addressReadable, space.addressStreetAddress, space.addressRegion, space.addressLocality, space.postalCode,
            space.phoneNumber, space.websiteUrl, space.isPointOfInterest, space.openingHours,
            space.radius, // $35: separate param for ST_Buffer to avoid type ambiguity
          ],
        );
        if (result.rowCount && result.rowCount > 0) {
          inserted++;
        }
      } catch (err: any) {
        // Log and continue — overlapping geometries or other constraints may cause failures
        if (err.message?.includes('no_area_overlaps') || err.message?.includes('exclude')) {
          // Geometry overlap — expected for nearby businesses
        } else {
          console.error(`  Failed to insert "${space.notificationMsg}": ${err.message}`);
        }
      }
    }

    console.log(`  Batch progress: ${Math.min(i + BATCH_SIZE, spaces.length)}/${spaces.length} processed, ${inserted} inserted`);
  }

  return inserted;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();
  console.log(`\nImport Spaces CLI`);
  console.log(`  Source:   ${args.source}`);
  console.log(`  City:     ${args.city}`);
  console.log(`  Category: ${args.category}`);
  console.log(`  Dry run:  ${args.dryRun}`);
  console.log(`  Limit:    ${args.limit || 'none'}`);
  console.log('');

  if (args.source !== 'osm') {
    console.error('Only "osm" source is currently supported.');
    process.exit(1);
  }

  const cityKeys = args.city === 'all' ? Object.keys(CITIES) : [args.city];
  const invalidCities = cityKeys.filter((k) => !CITIES[k]);
  if (invalidCities.length > 0) {
    console.error(`Unknown city: ${invalidCities.join(', ')}. Valid: ${Object.keys(CITIES).join(', ')}`);
    process.exit(1);
  }

  let db: Pool | null = null;
  if (!args.dryRun) {
    db = createDbPool();
    // Test connection
    try {
      await db.query('SELECT 1');
      console.log('Database connection established.\n');
    } catch (err: any) {
      console.error(`Database connection failed: ${err.message}`);
      console.error('Make sure .env is configured with DB_HOST_MAIN_WRITE, DB_USER_MAIN_WRITE, etc.');
      process.exit(1);
    }
  }

  let totalFetched = 0;
  let totalInserted = 0;
  let totalSkippedValidation = 0;
  let totalSkippedDuplicate = 0;
  let remaining = args.limit || Infinity;

  for (const cityKey of cityKeys) {
    if (remaining <= 0) break;
    const city = CITIES[cityKey];
    console.log(`\n── ${city.name}, ${city.regionCode} ──────────────────────────`);

    // Fetch from OSM
    const osmElements = await fetchOsmData(city, args.category);
    totalFetched += osmElements.length;

    // Transform to space params
    let spaces: ISpaceInsertParams[] = osmElements
      .map((el) => mapOsmToSpace(el, city, args.userId))
      .filter((s): s is ISpaceInsertParams => s !== null);

    // Validate
    const validSpaces: ISpaceInsertParams[] = [];
    for (const space of spaces) {
      const validation = validateSpace(space);
      if (validation.valid) {
        validSpaces.push(space);
      } else {
        totalSkippedValidation++;
      }
    }
    spaces = validSpaces;

    // Deduplicate within batch
    spaces = deduplicateWithinBatch(spaces);

    console.log(`  Transformed: ${spaces.length} valid spaces (${osmElements.length - spaces.length} filtered)`);

    // Apply limit
    if (remaining < spaces.length) {
      console.log(`  Limiting to ${remaining} spaces (--limit)`);
      spaces = spaces.slice(0, remaining);
    }

    if (args.dryRun) {
      // Print sample
      console.log('\n  Sample (first 5):');
      spaces.slice(0, 5).forEach((s) => {
        console.log(`    - ${s.notificationMsg} (${s.category}) @ ${s.latitude.toFixed(4)}, ${s.longitude.toFixed(4)}`);
        console.log(`      ${s.addressReadable}`);
        if (s.phoneNumber) console.log(`      Phone: ${s.phoneNumber}`);
        if (s.websiteUrl) console.log(`      Web: ${s.websiteUrl}`);
      });
      totalInserted += spaces.length;
      remaining -= spaces.length;
      continue;
    }

    // Deduplicate against DB
    if (!args.skipDedup && db) {
      console.log('  Checking for duplicates in database...');
      const duplicates = await findDuplicates(db, spaces);
      if (duplicates.size > 0) {
        console.log(`  Found ${duplicates.size} duplicates, skipping.`);
        totalSkippedDuplicate += duplicates.size;
        spaces = spaces.filter((_, idx) => !duplicates.has(idx));
      }
    }

    // Insert
    if (db && spaces.length > 0) {
      console.log(`  Inserting ${spaces.length} spaces...`);
      const inserted = await insertSpaces(db, spaces);
      totalInserted += inserted;
      remaining -= inserted;
      console.log(`  Inserted: ${inserted}`);
    }
  }

  // Summary
  console.log('\n══════════════════════════════════════');
  console.log(`Total fetched from OSM:   ${totalFetched}`);
  console.log(`Skipped (validation):     ${totalSkippedValidation}`);
  console.log(`Skipped (duplicate):      ${totalSkippedDuplicate}`);
  console.log(`${args.dryRun ? 'Would insert' : 'Inserted'}:              ${totalInserted}`);
  console.log('══════════════════════════════════════\n');

  if (db) {
    await db.end();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
