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
import { CITIES, IMPORT_USER_ID, OSM_CATEGORY_MAP } from './config';
import { fetchOsmData } from './sources/osm';
import { mapOsmToSpace, ISpaceInsertParams } from './transforms/mapToSpace';
import { findDuplicates, deduplicateWithinBatch } from './utils/deduplicate';
import { validateSpace } from './utils/validate';
import { assertDbConnection, createDbPool } from './utils/db';
import { insertSpacesBatch } from './utils/insertSpaces';

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
    await assertDbConnection(db);
  }

  let totalFetched = 0;
  let totalInserted = 0;
  let totalSkippedValidation = 0;
  let totalSkippedDuplicate = 0;
  let totalFailed = 0;
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
      const { inserted, skipped, failed } = await insertSpacesBatch(db, spaces);
      totalInserted += inserted;
      totalSkippedDuplicate += skipped;
      totalFailed += failed;
      remaining -= inserted;
      console.log(`  Inserted: ${inserted} (skipped ${skipped}, failed ${failed})`);
    }
  }

  // Summary
  console.log('\n══════════════════════════════════════');
  console.log(`Total fetched from OSM:   ${totalFetched}`);
  console.log(`Skipped (validation):     ${totalSkippedValidation}`);
  console.log(`Skipped (duplicate):      ${totalSkippedDuplicate}`);
  console.log(`Failed (DB errors):       ${totalFailed}`);
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
