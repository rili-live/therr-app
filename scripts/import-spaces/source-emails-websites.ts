#!/usr/bin/env node
/**
 * CLI tool to find business emails and websites for imported spaces.
 *
 * For spaces with a websiteUrl: crawls the site for email addresses.
 * For spaces without a websiteUrl: searches the web to discover their website.
 * Optionally sources images when a website is available and the space has no media.
 *
 * Usage:
 *   npx ts-node scripts/import-spaces/source-emails-websites --city eugene --dry-run --limit 5
 *   npx ts-node scripts/import-spaces/source-emails-websites --mode email --source-images --limit 50
 *
 * Requires .env at project root or scripts/import-spaces/.env with DB + GCS credentials.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Pool } from 'pg';
import { CITIES, IMPORT_USER_ID } from './config';
import { crawlForEmails } from './sources/crawlEmails';
import { searchForWebsite } from './sources/searchWeb';
import { crawlForImages } from './sources/crawl';
import { downloadAndValidateImage } from './utils/imageValidation';
import { uploadImage } from './utils/gcs';

// Load .env from scripts/import-spaces/ first, fall back to root .env
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ── Help ─────────────────────────────────────────────────────────────────────
function printHelp() {
  const cityList = Object.keys(CITIES).join(', ');
  console.log(`
Source Emails & Websites CLI — Find contact info for imported spaces.

Usage:
  npx ts-node scripts/import-spaces/source-emails-websites [options]

Options:
  --city <name>        Filter by addressLocality (default: all)
                       Available: ${cityList}, all
  --category <name>    Filter by Therr category string (default: all)
                       e.g. "categories.restaurant/food", "categories.bar/drinks"
  --mode <mode>        What to find (default: both)
                       "email"   — only find emails for spaces with a website
                       "website" — only find websites for spaces without one
                       "both"    — find emails and websites
  --limit <n>          Max spaces to process (default: no limit)
  --delay <ms>         Delay between requests in ms (default: 2000)
  --user-id <uuid>     Override fromUserId for media records
                       (default: ${IMPORT_USER_ID})
  --source-images      Also source images for spaces with a website but no media
  --dry-run            Crawl and log results without updating database
  --help, -h           Show this help message

Examples:
  npx ts-node scripts/import-spaces/source-emails-websites --city eugene --dry-run --limit 5
  npx ts-node scripts/import-spaces/source-emails-websites --mode email --limit 50
  npx ts-node scripts/import-spaces/source-emails-websites --mode website --city chicago --limit 20
  npx ts-node scripts/import-spaces/source-emails-websites --mode both --source-images --limit 100
`);
}

interface ICliArgs {
  city: string;
  category: string;
  mode: 'email' | 'website' | 'both';
  dryRun: boolean;
  sourceImages: boolean;
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
    } else if (args[i] === '--source-images') {
      parsed.sourceImages = 'true';
    } else if (args[i].startsWith('--') && i + 1 < args.length) {
      parsed[args[i].replace('--', '')] = args[i + 1];
      i++;
    }
  }

  const mode = parsed.mode || 'both';
  if (mode !== 'email' && mode !== 'website' && mode !== 'both') {
    console.error(`Invalid --mode: "${mode}". Must be "email", "website", or "both".`);
    process.exit(1);
  }

  return {
    city: parsed.city || 'all',
    category: parsed.category || 'all',
    mode: mode as 'email' | 'website' | 'both',
    dryRun: parsed.dryRun === 'true',
    sourceImages: parsed.sourceImages === 'true',
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
  websiteUrl: string | null;
  mediaIds: string | null;
  medias: any | null;
  fromUserId: string;
  addressLocality: string;
  addressRegion: string;
}

// ── Query spaces needing emails/websites ─────────────────────────────────────
async function querySpacesForEmails(db: Pool, args: ICliArgs): Promise<ISpaceRow[]> {
  const conditions = [
    '"businessEmail" IS NULL',
    `"websiteUrl" != ''`,
    '"websiteUrl" IS NOT NULL',
  ];
  return querySpacesWithConditions(db, args, conditions);
}

async function querySpacesForWebsites(db: Pool, args: ICliArgs): Promise<ISpaceRow[]> {
  const conditions = [
    `("websiteUrl" IS NULL OR "websiteUrl" = '')`,
  ];
  return querySpacesWithConditions(db, args, conditions);
}

async function querySpacesWithConditions(db: Pool, args: ICliArgs, conditions: string[]): Promise<ISpaceRow[]> {
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

  let query = `SELECT id, "notificationMsg", category, "websiteUrl", "mediaIds", medias,
      "fromUserId", "addressLocality", "addressRegion"
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

// ── Check if space needs images ──────────────────────────────────────────────
function spaceNeedsImages(space: ISpaceRow): boolean {
  return (!space.mediaIds || space.mediaIds === '') && !space.medias;
}

// ── Image sourcing (reuses existing pipeline) ────────────────────────────────
async function sourceImageForSpace(
  db: Pool,
  space: ISpaceRow,
  websiteUrl: string,
  userId: string,
  progress: string,
): Promise<boolean> {
  const candidates = await crawlForImages(websiteUrl);
  if (candidates.length === 0) return false;

  // Try each candidate until one validates
  for (const candidate of candidates) {
    const validImage = await downloadAndValidateImage(candidate.imageUrl);
    if (!validImage) continue;

    console.log(`${progress}   Image found (${candidate.source}): ${validImage.width}x${validImage.height}`);

    const storagePath = await uploadImage(userId, space.id, validImage.buffer, validImage.contentType);

    // Insert media record
    const mediaResult = await db.query(
      `INSERT INTO main.media ("fromUserId", "altText", type, path)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [userId, space.notificationMsg, 'user-image-public', storagePath],
    );
    const mediaId = mediaResult.rows[0].id;

    // Update space with media references
    const medias = JSON.stringify([{ path: storagePath, type: 'user-image-public' }]);
    await db.query(
      `UPDATE main.spaces
       SET "mediaIds" = $1::text,
           medias = $2::jsonb,
           "updatedAt" = NOW()
       WHERE id = $3`,
      [String(mediaId), medias, space.id],
    );

    console.log(`${progress}   Uploaded image: ${storagePath}`);
    return true;
  }

  return false;
}

// ── Process spaces that need emails ──────────────────────────────────────────
async function processEmailSpaces(db: Pool, args: ICliArgs, counters: ICounters) {
  const spaces = await querySpacesForEmails(db, args);
  console.log(`Found ${spaces.length} spaces with websites needing email extraction.\n`);

  for (let i = 0; i < spaces.length; i++) {
    const space = spaces[i];
    const progress = `[email ${i + 1}/${spaces.length}]`;

    try {
      const emailResults = await crawlForEmails(space.websiteUrl!);

      if (emailResults.length === 0) {
        console.log(`${progress} SKIP (no email found): ${space.notificationMsg} — ${space.websiteUrl}`);
        counters.skippedNoEmail++;
        if (i < spaces.length - 1) await sleep(args.delay);
        continue;
      }

      const bestEmail = emailResults[0];
      console.log(`${progress} EMAIL FOUND (${bestEmail.source}): ${bestEmail.email} — ${space.notificationMsg}`);

      if (args.dryRun) {
        if (emailResults.length > 1) {
          console.log(`  Other candidates: ${emailResults.slice(1).map((e) => e.email).join(', ')}`);
        }
        counters.dryRunEmails++;
      } else {
        await db.query(
          `UPDATE main.spaces SET "businessEmail" = $1, "updatedAt" = NOW() WHERE id = $2`,
          [bestEmail.email, space.id],
        );
        counters.emailsFound++;
      }

      // Optionally source images
      if (args.sourceImages && spaceNeedsImages(space) && space.websiteUrl) {
        if (args.dryRun) {
          console.log(`${progress}   Would also source image from ${space.websiteUrl}`);
        } else {
          const imageSourced = await sourceImageForSpace(db, space, space.websiteUrl, space.fromUserId || args.userId, progress);
          if (imageSourced) counters.imagesFound++;
        }
      }
    } catch (err: any) {
      console.error(`${progress} ERROR: ${space.notificationMsg} — ${err.message}`);
      counters.errors++;
    }

    if (i < spaces.length - 1) await sleep(args.delay);
  }
}

// ── Process spaces that need websites ────────────────────────────────────────
async function processWebsiteSpaces(db: Pool, args: ICliArgs, counters: ICounters) {
  const spaces = await querySpacesForWebsites(db, args);
  console.log(`Found ${spaces.length} spaces needing website discovery.\n`);

  for (let i = 0; i < spaces.length; i++) {
    const space = spaces[i];
    const progress = `[web ${i + 1}/${spaces.length}]`;

    try {
      const searchResult = await searchForWebsite(
        space.notificationMsg,
        space.addressLocality || '',
        space.addressRegion || '',
      );

      if (!searchResult) {
        console.log(`${progress} SKIP (no website found): ${space.notificationMsg}`);
        counters.skippedNoWebsite++;
        if (i < spaces.length - 1) await sleep(args.delay);
        continue;
      }

      console.log(`${progress} WEBSITE FOUND (${searchResult.confidence}): ${searchResult.websiteUrl} — ${space.notificationMsg}`);
      console.log(`${progress}   Matched on: ${searchResult.matchedOn}`);

      if (args.dryRun) {
        counters.dryRunWebsites++;
      } else {
        await db.query(
          `UPDATE main.spaces SET "websiteUrl" = $1, "updatedAt" = NOW() WHERE id = $2`,
          [searchResult.websiteUrl, space.id],
        );
        counters.websitesFound++;
      }

      // Try to find email from the newly discovered website
      const emailResults = await crawlForEmails(searchResult.websiteUrl);
      if (emailResults.length > 0) {
        const bestEmail = emailResults[0];
        console.log(`${progress}   EMAIL FOUND (${bestEmail.source}): ${bestEmail.email}`);

        if (args.dryRun) {
          counters.dryRunEmails++;
        } else {
          await db.query(
            `UPDATE main.spaces SET "businessEmail" = $1, "updatedAt" = NOW() WHERE id = $2`,
            [bestEmail.email, space.id],
          );
          counters.emailsFound++;
        }
      }

      // Optionally source images from the newly discovered website
      if (args.sourceImages && spaceNeedsImages(space)) {
        if (args.dryRun) {
          console.log(`${progress}   Would also source image from ${searchResult.websiteUrl}`);
        } else {
          const imageSourced = await sourceImageForSpace(
            db, space, searchResult.websiteUrl, space.fromUserId || args.userId, progress,
          );
          if (imageSourced) counters.imagesFound++;
        }
      }
    } catch (err: any) {
      console.error(`${progress} ERROR: ${space.notificationMsg} — ${err.message}`);
      counters.errors++;
    }

    if (i < spaces.length - 1) await sleep(args.delay);
  }
}

// ── Counters ─────────────────────────────────────────────────────────────────
interface ICounters {
  emailsFound: number;
  websitesFound: number;
  imagesFound: number;
  skippedNoEmail: number;
  skippedNoWebsite: number;
  dryRunEmails: number;
  dryRunWebsites: number;
  errors: number;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();
  console.log('\nSource Emails & Websites CLI');
  console.log(`  City:          ${args.city}`);
  console.log(`  Category:      ${args.category}`);
  console.log(`  Mode:          ${args.mode}`);
  console.log(`  Source images:  ${args.sourceImages}`);
  console.log(`  Dry run:       ${args.dryRun}`);
  console.log(`  Limit:         ${args.limit || 'none'}`);
  console.log(`  Delay:         ${args.delay}ms`);
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

  const counters: ICounters = {
    emailsFound: 0,
    websitesFound: 0,
    imagesFound: 0,
    skippedNoEmail: 0,
    skippedNoWebsite: 0,
    dryRunEmails: 0,
    dryRunWebsites: 0,
    errors: 0,
  };

  // Phase 1: Find emails for spaces that have websites
  if (args.mode === 'email' || args.mode === 'both') {
    console.log('── Phase 1: Email extraction from existing websites ──────────────');
    await processEmailSpaces(db, args, counters);
    console.log('');
  }

  // Phase 2: Find websites for spaces that don't have them
  if (args.mode === 'website' || args.mode === 'both') {
    console.log('── Phase 2: Website discovery via web search ─────────────────────');
    await processWebsiteSpaces(db, args, counters);
    console.log('');
  }

  // Summary
  console.log('══════════════════════════════════════');
  if (args.dryRun) {
    console.log(`Emails found (dry run):     ${counters.dryRunEmails}`);
    console.log(`Websites found (dry run):   ${counters.dryRunWebsites}`);
  } else {
    console.log(`Emails found & saved:       ${counters.emailsFound}`);
    console.log(`Websites found & saved:     ${counters.websitesFound}`);
    console.log(`Images sourced:             ${counters.imagesFound}`);
  }
  console.log(`Skipped (no email):         ${counters.skippedNoEmail}`);
  console.log(`Skipped (no website):       ${counters.skippedNoWebsite}`);
  console.log(`Errors:                     ${counters.errors}`);
  console.log('══════════════════════════════════════\n');

  await db.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
