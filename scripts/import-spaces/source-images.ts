#!/usr/bin/env node
/**
 * CLI tool to source images for imported spaces by crawling their websiteUrl.
 *
 * Usage:
 *   npx ts-node scripts/import-spaces/source-images --city eugene --dry-run --limit 5
 *   npx ts-node scripts/import-spaces/source-images --city all --category restaurant
 *
 * Requires .env at project root or scripts/import-spaces/.env with DB + GCS credentials.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Pool } from 'pg';
import { CITIES, IMPORT_USER_ID } from './config';
import {
  ProcessedType,
  markProcessed,
  filterProcessedSpaces,
  getProcessedStats,
} from './utils/processedSpaces';
import { assertDbConnection, createDbPool } from './utils/db';
import { sourceImageForSpace } from './utils/sourceImage';

// Load .env from scripts/import-spaces/ first, fall back to root .env
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ── Help ─────────────────────────────────────────────────────────────────────
function printHelp() {
  const cityList = Object.keys(CITIES).join(', ');
  console.log(`
Source Images CLI — Crawl websites and attach images to imported spaces.

Usage:
  npx ts-node scripts/import-spaces/source-images [options]

Options:
  --city <name>        Filter by addressLocality (default: all)
                       Available: ${cityList}, all
  --category <name>    Filter by Therr category string (default: all)
                       e.g. "categories.restaurant/food", "categories.bar/drinks"
  --limit <n>          Max spaces to process (default: no limit)
  --delay <ms>         Delay between requests in ms (default: 2000)
  --user-id <uuid>     Override fromUserId for media records
                       (default: ${IMPORT_USER_ID})
  --dry-run            Crawl and log results without uploading/updating
  --no-skip-processed  Re-process spaces even if previously attempted
  --help, -h           Show this help message

Examples:
  npx ts-node scripts/import-spaces/source-images --city eugene --dry-run --limit 5
  npx ts-node scripts/import-spaces/source-images --city all --category restaurant --limit 50
`);
}

interface ICliArgs {
  city: string;
  category: string;
  dryRun: boolean;
  limit: number;
  delay: number;
  userId: string;
  noSkipProcessed: boolean;
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
    } else if (args[i] === '--no-skip-processed') {
      parsed.noSkipProcessed = 'true';
    } else if (args[i].startsWith('--') && i + 1 < args.length) {
      parsed[args[i].replace('--', '')] = args[i + 1];
      i++;
    }
  }

  return {
    city: parsed.city || 'all',
    category: parsed.category || 'all',
    dryRun: parsed.dryRun === 'true',
    limit: parsed.limit ? parseInt(parsed.limit, 10) : 0,
    delay: parsed.delay ? parseInt(parsed.delay, 10) : 2000,
    userId: parsed['user-id'] || IMPORT_USER_ID,
    noSkipProcessed: parsed.noSkipProcessed === 'true',
  };
}

interface ISpaceRow {
  id: string;
  notificationMsg: string;
  category: string;
  hashTags: string;
  websiteUrl: string;
  fromUserId: string;
}

// ── Query spaces needing images ──────────────────────────────────────────────
async function querySpaces(db: Pool, args: ICliArgs): Promise<ISpaceRow[]> {
  const conditions = [
    `("mediaIds" = '' OR "mediaIds" IS NULL)`,
    'medias IS NULL',
    `"websiteUrl" != ''`,
    `"websiteUrl" IS NOT NULL`,
  ];
  const params: (string | number)[] = [];
  let paramIdx = 1;

  if (args.city !== 'all') {
    const cityConfig = CITIES[args.city];
    if (cityConfig) {
      conditions.push(`"addressLocality" ILIKE $${paramIdx}`);
      params.push(`%${cityConfig.name}%`);
      paramIdx++;
    }
  }

  if (args.category !== 'all') {
    conditions.push(`category = $${paramIdx}`);
    params.push(args.category);
    paramIdx++;
  }

  let query = `SELECT id, "notificationMsg", category, "hashTags", "websiteUrl", "fromUserId"
    FROM main.spaces
    WHERE ${conditions.join(' AND ')}
    ORDER BY RANDOM()`;

  if (args.limit > 0) {
    query += ` LIMIT $${paramIdx}`;
    params.push(args.limit);
  }

  const result = await db.query(query, params);
  return result.rows;
}

// ── Sleep helper ─────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();
  console.log('\nSource Images CLI');
  console.log(`  City:     ${args.city}`);
  console.log(`  Category: ${args.category}`);
  console.log(`  Dry run:  ${args.dryRun}`);
  console.log(`  Limit:    ${args.limit || 'none'}`);
  console.log(`  Delay:    ${args.delay}ms`);
  console.log('');

  const db = createDbPool();
  await assertDbConnection(db);
  console.log('');

  let spaces = await querySpaces(db, args);

  if (!args.noSkipProcessed) {
    const { filtered, skippedCount } = filterProcessedSpaces(spaces, [
      ProcessedType.NO_IMAGE_FOUND,
      ProcessedType.IMAGE_FOUND,
    ]);
    if (skippedCount > 0) {
      console.log(`Skipping ${skippedCount} previously processed space(s) for image lookup.`);
    }
    spaces = filtered;
  }

  console.log(`Found ${spaces.length} spaces needing images.\n`);

  if (spaces.length === 0) {
    await db.end();
    return;
  }

  // Counters
  let updated = 0;
  let dryRunFound = 0;
  let skippedNoImage = 0;
  let skippedTooSmall = 0;
  let errors = 0;

  for (let i = 0; i < spaces.length; i++) {
    const space = spaces[i];
    const progress = `[${i + 1}/${spaces.length}]`;

    try {
      const userId = space.fromUserId || args.userId;
      const outcome = await sourceImageForSpace(
        db,
        space,
        space.websiteUrl,
        userId,
        { dryRun: args.dryRun, progress },
      );

      switch (outcome.status) {
        case 'no-candidates': {
          console.log(`${progress} SKIP (no image found): ${space.notificationMsg} — ${space.websiteUrl}`);
          if (!args.dryRun) {
            markProcessed(ProcessedType.NO_IMAGE_FOUND, space.id, space.notificationMsg);
          }
          skippedNoImage++;
          break;
        }
        case 'dry-run': {
          console.log(`${progress} DRY RUN — ${outcome.candidateCount} candidate(s) for: ${space.notificationMsg}`);
          dryRunFound++;
          break;
        }
        case 'no-valid-image': {
          console.log(`${progress}  SKIP (all candidates invalid/too small): ${space.notificationMsg}`);
          markProcessed(ProcessedType.NO_IMAGE_FOUND, space.id, space.notificationMsg);
          skippedTooSmall++;
          break;
        }
        case 'uploaded': {
          markProcessed(ProcessedType.IMAGE_FOUND, space.id, space.notificationMsg);
          updated++;
          break;
        }
        case 'skipped-has-media': {
          // Space already has media — nothing to do.
          break;
        }
        default: {
          // exhaustive
          break;
        }
      }
    } catch (err: any) {
      console.error(`${progress} ERROR: ${space.notificationMsg} — ${err.message}`);
      errors++;
    }

    if (i < spaces.length - 1) await sleep(args.delay);
  }

  // Summary
  console.log('\n══════════════════════════════════════');
  console.log(`Total spaces processed:   ${spaces.length}`);
  if (args.dryRun) {
    console.log(`Candidates found:         ${dryRunFound}`);
  } else {
    console.log(`Updated:                  ${updated}`);
  }
  console.log(`Skipped (no image):       ${skippedNoImage}`);
  console.log(`Skipped (too small):      ${skippedTooSmall}`);
  console.log(`Errors:                   ${errors}`);
  console.log('══════════════════════════════════════\n');

  // Show processed-spaces tracking stats
  const stats = getProcessedStats();
  const hasStats = Object.values(stats).some((v) => v > 0);
  if (hasStats) {
    console.log('Processed-spaces tracking:');
    for (const [type, count] of Object.entries(stats)) {
      if (count > 0) console.log(`  ${type}: ${count}`);
    }
    console.log('');
  }

  await db.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
