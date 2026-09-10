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
  processedIdsArray,
  resetProcessed,
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
  --deep               On pages with no usable image, also try /about, /menu,
                       /gallery before giving up (slower, higher yield)
  --dry-run            Crawl and log results without uploading/updating
                       (still downloads + validates, so counts match a real run)
  --no-skip-processed  Re-process spaces even if previously attempted
  --retry-failed       Clear the no-image-found list first, then run. Use after
                       improving extraction to revisit past failures.
  --help, -h           Show this help message

Examples:
  npx ts-node scripts/import-spaces/source-images --city eugene --dry-run --limit 5
  npx ts-node scripts/import-spaces/source-images --city all --category restaurant --limit 50
  npx ts-node scripts/import-spaces/source-images --retry-failed --deep --limit 100
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
  deep: boolean;
  retryFailed: boolean;
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
    } else if (args[i] === '--deep') {
      parsed.deep = 'true';
    } else if (args[i] === '--retry-failed') {
      parsed.retryFailed = 'true';
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
    deep: parsed.deep === 'true',
    retryFailed: parsed.retryFailed === 'true',
  };
}

interface ISpaceRow {
  id: string;
  notificationMsg: string;
  category: string;
  hashTags: string;
  websiteUrl: string;
  fromUserId: string;
  mediaIds: string | null;
  medias: unknown;
}

// ── Query spaces needing images ──────────────────────────────────────────────
type QueryParam = string | number | string[];

/**
 * Build the shared WHERE clause for "needs an image and has a website to try".
 */
function buildConditions(args: ICliArgs): { where: string; params: QueryParam[] } {
  const conditions = [
    '("mediaIds" = \'\' OR "mediaIds" IS NULL)',
    'medias IS NULL',
    '"websiteUrl" != \'\'',
    '"websiteUrl" IS NOT NULL',
  ];
  const params: QueryParam[] = [];

  if (args.city !== 'all') {
    const cityConfig = CITIES[args.city];
    if (cityConfig) {
      params.push(`%${cityConfig.name}%`);
      conditions.push(`"addressLocality" ILIKE $${params.length}`);
    }
  }

  if (args.category !== 'all') {
    params.push(args.category);
    conditions.push(`category = $${params.length}`);
  }

  // Exclude already-attempted spaces in SQL, before LIMIT is applied, so
  // `--limit N` yields N spaces we have not tried rather than N random rows
  // that are mostly already done.
  if (!args.noSkipProcessed) {
    const processedIds = processedIdsArray([
      ProcessedType.NO_IMAGE_FOUND,
      ProcessedType.IMAGE_FOUND,
    ]);
    if (processedIds.length > 0) {
      params.push(processedIds);
      conditions.push(`id != ALL($${params.length}::uuid[])`);
    }
  }

  return { where: conditions.join(' AND '), params };
}

async function querySpaces(db: Pool, args: ICliArgs): Promise<ISpaceRow[]> {
  const { where, params } = buildConditions(args);

  let query = `SELECT id, "notificationMsg", category, "hashTags", "websiteUrl", "fromUserId",
      "mediaIds", medias
    FROM main.spaces
    WHERE ${where}
    ORDER BY RANDOM()`;

  if (args.limit > 0) {
    params.push(args.limit);
    query += ` LIMIT $${params.length}`;
  }

  const result = await db.query(query, params);
  return result.rows;
}

/**
 * Total spaces still eligible, ignoring --limit, so a capped run can report
 * how much backlog remains behind it.
 */
async function countEligible(db: Pool, args: ICliArgs): Promise<number> {
  const { where, params } = buildConditions(args);
  const result = await db.query(`SELECT COUNT(*)::int AS n FROM main.spaces WHERE ${where}`, params);
  return result.rows[0].n;
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
  console.log(`  Deep:     ${args.deep}`);
  console.log('');

  if (args.retryFailed) {
    const cleared = resetProcessed(ProcessedType.NO_IMAGE_FOUND);
    console.log(`--retry-failed: cleared ${cleared} previously failed space(s) for re-attempt.\n`);
  }

  const db = createDbPool();
  await assertDbConnection(db);
  console.log('');

  const eligible = await countEligible(db, args);
  const spaces = await querySpaces(db, args);

  console.log(`${eligible} space(s) eligible; processing ${spaces.length} this run.\n`);

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
        { dryRun: args.dryRun, deep: args.deep, progress },
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
          if (outcome.validated) {
            const { source, width, height } = outcome.validated;
            console.log(`${progress} DRY RUN — WOULD SAVE (${source}) ${width}x${height}: ${space.notificationMsg}`);
            dryRunFound++;
          } else {
            console.log(`${progress} DRY RUN — ${outcome.candidateCount} candidate(s), none valid: ${space.notificationMsg}`);
            skippedTooSmall++;
          }
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
    console.log(`Would save an image:      ${dryRunFound}`);
  } else {
    console.log(`Updated:                  ${updated}`);
  }
  console.log(`Skipped (no image):       ${skippedNoImage}`);
  console.log(`Skipped (too small):      ${skippedTooSmall}`);
  console.log(`Errors:                   ${errors}`);
  const hitRate = spaces.length > 0
    ? Math.round(((args.dryRun ? dryRunFound : updated) / spaces.length) * 100)
    : 0;
  console.log(`Hit rate:                 ${hitRate}%`);
  console.log(`Eligible remaining:       ${Math.max(eligible - spaces.length, 0)}`);
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
