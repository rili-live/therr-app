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
import { crawlForImages, ICrawlResult } from './sources/crawl';
import { downloadAndValidateImage } from './utils/imageValidation';
import { uploadImage } from './utils/gcs';

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
    connectionTimeoutMillis: 10000,
  });
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

  // Test connection
  try {
    await db.query('SELECT 1');
    console.log('Database connection established.\n');
  } catch (err: any) {
    console.error(`Database connection failed: ${err.message}`);
    console.error('Make sure .env is configured with DB_HOST_MAIN_WRITE, DB_USER_MAIN_WRITE, etc.');
    process.exit(1);
  }

  const spaces = await querySpaces(db, args);
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
      // Step 1: Crawl website for image candidates
      const candidates = await crawlForImages(space.websiteUrl);
      if (candidates.length === 0) {
        console.log(`${progress} SKIP (no image found): ${space.notificationMsg} — ${space.websiteUrl}`);
        skippedNoImage++;
        if (i < spaces.length - 1) await sleep(args.delay);
        continue;
      }

      console.log(`${progress} Found ${candidates.length} candidate(s) for: ${space.notificationMsg}`);

      if (args.dryRun) {
        const best = candidates[0];
        console.log(`  DRY RUN — best candidate: ${best.source} ${best.imageUrl.substring(0, 80)}...`);
        dryRunFound++;
        if (i < spaces.length - 1) await sleep(args.delay);
        continue;
      }

      // Step 2: Try each candidate until one validates
      let validImage = null;
      let matchedCandidate = candidates[0];
      for (const candidate of candidates) {
        validImage = await downloadAndValidateImage(candidate.imageUrl);
        if (validImage) {
          matchedCandidate = candidate;
          break;
        }
      }

      if (!validImage) {
        console.log(`  SKIP (all candidates invalid/too small): ${space.notificationMsg}`);
        skippedTooSmall++;
        if (i < spaces.length - 1) await sleep(args.delay);
        continue;
      }

      console.log(`  Image validated (${matchedCandidate.source}): ${validImage.width}x${validImage.height} ${validImage.contentType}`);

      // Step 3: Upload to GCS
      const userId = space.fromUserId || args.userId;
      const storagePath = await uploadImage(userId, space.id, validImage.buffer, validImage.contentType);
      console.log(`  Uploaded to GCS: ${storagePath}`);

      // Step 4: Insert media record
      const mediaResult = await db.query(
        `INSERT INTO main.media ("fromUserId", "altText", type, path)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [userId, space.notificationMsg, 'user-image-public', storagePath],
      );
      const mediaId = mediaResult.rows[0].id;

      // Step 5: Update space with media references
      const medias = JSON.stringify([{ path: storagePath, type: 'user-image-public' }]);
      await db.query(
        `UPDATE main.spaces
         SET "mediaIds" = $1::text,
             medias = $2::jsonb,
             "updatedAt" = NOW()
         WHERE id = $3`,
        [String(mediaId), medias, space.id],
      );

      console.log(`  Updated space ${space.id} with media ${mediaId}`);
      updated++;
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

  await db.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
