#!/usr/bin/env node
/**
 * Unified CLI for creating and enriching spaces.
 *
 * Combines the logic of all import-spaces scripts into a single pipeline:
 * 1. Create a new space from OSM data
 * 2. Find/set the website for the space
 * 3. Crawl the website for an image, email, description, hours, and phone
 *
 * Also supports an --enrich-existing flag to apply steps 2-3 to existing spaces
 * that are missing information.
 *
 * Usage:
 *   # Create new spaces with full enrichment
 *   npx ts-node scripts/import-spaces/manage-space --city eugene --category restaurant --limit 10
 *
 *   # Enrich existing spaces missing info
 *   npx ts-node scripts/import-spaces/manage-space --enrich-existing --city eugene --limit 20
 *
 *   # Enrich a single existing space by ID
 *   npx ts-node scripts/import-spaces/manage-space --enrich-existing --id <uuid>
 *
 *   # Dry run to preview
 *   npx ts-node scripts/import-spaces/manage-space --city chicago --category cafe --dry-run --limit 5
 *
 * Requires .env at project root or scripts/import-spaces/.env with DB + GCS credentials.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Pool } from 'pg';
import { CITIES, BATCH_SIZE, IMPORT_USER_ID, OSM_CATEGORY_MAP } from './config';
import { fetchOsmData } from './sources/osm';
import { mapOsmToSpace, ISpaceInsertParams } from './transforms/mapToSpace';
import { findDuplicates, deduplicateWithinBatch } from './utils/deduplicate';
import { validateSpace } from './utils/validate';
import { crawlForEmails } from './sources/crawlEmails';
import { searchForWebsite } from './sources/searchWeb';
import { crawlForImages } from './sources/crawl';
import { crawlForDetails, fetchPage } from './sources/crawlDetails';
import { downloadAndValidateImage } from './utils/imageValidation';
import { uploadImage } from './utils/gcs';
import { CITY_TIMEZONE_MAP } from './transforms/parseHours';

// Load .env from scripts/import-spaces/ first, fall back to root .env
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ── Help ─────────────────────────────────────────────────────────────────────
function printHelp() {
  const cityList = Object.keys(CITIES).join(', ');
  const categoryList = Object.keys(OSM_CATEGORY_MAP).join(', ');

  console.log(`
Manage Space CLI — Create and enrich spaces in a single pipeline.

Usage:
  npx ts-node scripts/import-spaces/manage-space [options]

Modes:
  (default)            Import new spaces from OSM and enrich them with website data
  --enrich-existing    Skip import; enrich existing spaces missing info (website, email, image, etc.)

Options:
  --city <name>        Target city (default: chicago)
                       Available: ${cityList}, all
  --category <name>    Business category (default: restaurant)
                       Available: ${categoryList}
                       For --enrich-existing, use Therr category e.g. "categories.restaurant/food"
  --source <name>      Data source for import (default: osm)
  --limit <n>          Max spaces to process (default: no limit)
  --delay <ms>         Delay between web requests in ms (default: 2000)
  --user-id <uuid>     Owner user ID (default: ${IMPORT_USER_ID})
  --id <uuid>          Enrich a single space by ID (requires --enrich-existing)
  --skip-dedup         Skip duplicate checking during import
  --skip-enrich        Import only — skip the enrichment phase
  --dry-run            Preview results without database changes
  --help, -h           Show this help message

Examples:
  # Import and enrich new restaurant spaces in Eugene
  npx ts-node scripts/import-spaces/manage-space --city eugene --category restaurant --limit 10

  # Dry run to preview what would be imported
  npx ts-node scripts/import-spaces/manage-space --city chicago --category cafe --dry-run --limit 5

  # Enrich existing spaces missing websites/emails/images in Portland
  npx ts-node scripts/import-spaces/manage-space --enrich-existing --city portland --limit 20

  # Enrich a single space by ID
  npx ts-node scripts/import-spaces/manage-space --enrich-existing --id abc-123-uuid

  # Import all categories for all cities (no enrichment)
  npx ts-node scripts/import-spaces/manage-space --city all --category all --skip-enrich
`);
}

interface ICliArgs {
  source: string;
  city: string;
  category: string;
  dryRun: boolean;
  skipDedup: boolean;
  skipEnrich: boolean;
  enrichExisting: boolean;
  singleId: string | null;
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
    } else if (args[i] === '--skip-dedup') {
      parsed.skipDedup = 'true';
    } else if (args[i] === '--skip-enrich') {
      parsed.skipEnrich = 'true';
    } else if (args[i] === '--enrich-existing') {
      parsed.enrichExisting = 'true';
    } else if (args[i].startsWith('--') && i + 1 < args.length) {
      parsed[args[i].replace('--', '')] = args[i + 1];
      i++;
    }
  }

  // --id implies --enrich-existing
  const enrichExisting = parsed.enrichExisting === 'true' || !!parsed.id;

  // Default city/category to 'all' in enrich-existing mode since DB categories
  // differ from import short names (e.g. "categories.restaurant/food" vs "restaurant")
  const defaultCity = enrichExisting ? 'all' : 'chicago';
  const defaultCategory = enrichExisting ? 'all' : 'restaurant';

  return {
    source: parsed.source || 'osm',
    city: parsed.city || defaultCity,
    category: parsed.category || defaultCategory,
    dryRun: parsed.dryRun === 'true',
    skipDedup: parsed.skipDedup === 'true',
    skipEnrich: parsed.skipEnrich === 'true',
    enrichExisting,
    singleId: parsed.id || null,
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

// ── Sleep helper ─────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

// ── Counters ─────────────────────────────────────────────────────────────────
interface ICounters {
  fetched: number;
  imported: number;
  skippedValidation: number;
  skippedDuplicate: number;
  websitesFound: number;
  emailsFound: number;
  imagesFound: number;
  descriptionsFound: number;
  hoursFound: number;
  phonesFound: number;
  enrichErrors: number;
}

function newCounters(): ICounters {
  return {
    fetched: 0,
    imported: 0,
    skippedValidation: 0,
    skippedDuplicate: 0,
    websitesFound: 0,
    emailsFound: 0,
    imagesFound: 0,
    descriptionsFound: 0,
    hoursFound: 0,
    phonesFound: 0,
    enrichErrors: 0,
  };
}

// ── Insert spaces ────────────────────────────────────────────────────────────
async function insertSpaces(db: Pool, spaces: ISpaceInsertParams[]): Promise<{ inserted: number; ids: string[] }> {
  let inserted = 0;
  const ids: string[] = [];

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
             "phoneNumber", "businessEmail", "websiteUrl", "isPointOfInterest", "openingHours",
             geom, "geomCenter")
          VALUES
            ($1, $2, $3, $4, $5,
             $6, $7, $8, $9,
             $10::float8, $11::float8, $12::float8, $13::jsonb, $14::float8,
             $15, $16, $17,
             $18, $19, $20, $21,
             $22, $23, $24, $25,
             $26, $27, $28, $29, $30::integer,
             $31, $32, $33, $34, $35::jsonb,
             ST_SetSRID(ST_Buffer(ST_MakePoint($11::float8, $10::float8)::geography, $36::float8)::geometry, 4326),
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
            space.phoneNumber, space.businessEmail, space.websiteUrl, space.isPointOfInterest, space.openingHours,
            space.radius,
          ],
        );
        if (result.rowCount && result.rowCount > 0) {
          inserted++;
          ids.push(result.rows[0].id);
        }
      } catch (err: any) {
        if (!err.message?.includes('no_area_overlaps') && !err.message?.includes('exclude')) {
          console.error(`  Failed to insert "${space.notificationMsg}": ${err.message}`);
        }
      }
    }

    console.log(`  Batch progress: ${Math.min(i + BATCH_SIZE, spaces.length)}/${spaces.length} processed, ${inserted} inserted`);
  }

  return { inserted, ids };
}

// ── Space row interface for enrichment ───────────────────────────────────────
interface ISpaceRow {
  id: string;
  notificationMsg: string;
  category: string;
  websiteUrl: string | null;
  businessEmail: string | null;
  phoneNumber: string | null;
  mediaIds: string | null;
  medias: any | null;
  message: string | null;
  openingHours: any | null;
  fromUserId: string;
  addressLocality: string;
  addressRegion: string;
}

// ── Query existing spaces needing enrichment ─────────────────────────────────
async function querySpacesForEnrichment(db: Pool, args: ICliArgs): Promise<ISpaceRow[]> {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIdx = 1;

  if (args.singleId) {
    conditions.push(`id = $${paramIdx}`);
    params.push(args.singleId);
    paramIdx++;
  } else {
    // Spaces missing at least one of: website, email, or image
    conditions.push(`(
      ("businessEmail" IS NULL)
      OR ("websiteUrl" IS NULL OR "websiteUrl" = '')
      OR (("mediaIds" = '' OR "mediaIds" IS NULL) AND medias IS NULL)
    )`);

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
  }

  let query = `SELECT id, "notificationMsg", category, "websiteUrl", "businessEmail",
      "phoneNumber", "mediaIds", medias, message, "openingHours",
      "fromUserId", "addressLocality", "addressRegion"
    FROM main.spaces
    WHERE ${conditions.join(' AND ')}
    ORDER BY RANDOM()`;

  if (!args.singleId && args.limit > 0) {
    query += ` LIMIT $${paramIdx}`;
    params.push(args.limit);
  }

  const result = await db.query(query, params);
  return result.rows;
}

// ── Query newly inserted spaces by IDs ───────────────────────────────────────
async function querySpacesByIds(db: Pool, ids: string[]): Promise<ISpaceRow[]> {
  if (ids.length === 0) return [];

  const result = await db.query(
    `SELECT id, "notificationMsg", category, "websiteUrl", "businessEmail",
        "phoneNumber", "mediaIds", medias, message, "openingHours",
        "fromUserId", "addressLocality", "addressRegion"
      FROM main.spaces
      WHERE id = ANY($1)`,
    [ids],
  );
  return result.rows;
}

// ── Check if a space needs images ────────────────────────────────────────────
function spaceNeedsImages(space: ISpaceRow): boolean {
  return (!space.mediaIds || space.mediaIds === '') && !space.medias;
}

// ── Source image for a space ─────────────────────────────────────────────────
async function sourceImageForSpace(
  db: Pool,
  space: ISpaceRow,
  websiteUrl: string,
  userId: string,
  progress: string,
): Promise<boolean> {
  const candidates = await crawlForImages(websiteUrl);
  if (candidates.length === 0) return false;

  for (const candidate of candidates) {
    const validImage = await downloadAndValidateImage(candidate.imageUrl);
    if (!validImage) continue;

    console.log(`${progress}   Image found (${candidate.source}): ${validImage.width}x${validImage.height}`);

    const storagePath = await uploadImage(userId, space.id, validImage.buffer, validImage.contentType);

    const mediaResult = await db.query(
      `INSERT INTO main.media ("fromUserId", "altText", type, path)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [userId, space.notificationMsg, 'user-image-public', storagePath],
    );
    const mediaId = mediaResult.rows[0].id;

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

/**
 * Resolve timezone for a space based on its addressLocality.
 * Falls back to America/Chicago if no match is found.
 */
function resolveTimezone(addressLocality: string): string {
  if (!addressLocality) return 'America/Chicago';

  for (const [cityName, tz] of Object.entries(CITY_TIMEZONE_MAP)) {
    if (addressLocality.toLowerCase().includes(cityName.toLowerCase())) {
      return tz;
    }
  }
  return 'America/Chicago';
}

/**
 * Normalize a website URL, ensuring it has a protocol prefix.
 */
function normalizeUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
}

// ── Enrich a single space with all available info ────────────────────────────
async function enrichSpace(
  db: Pool,
  space: ISpaceRow,
  args: ICliArgs,
  counters: ICounters,
  progress: string,
): Promise<void> {
  let websiteUrl = space.websiteUrl || '';

  // ── Step 1: Find website if missing ──
  if (!websiteUrl) {
    const searchResult = await searchForWebsite(
      space.notificationMsg,
      space.addressLocality || '',
      space.addressRegion || '',
    );

    if (searchResult) {
      websiteUrl = searchResult.websiteUrl;
      console.log(`${progress} WEBSITE (${searchResult.confidence}): ${websiteUrl} — matched: ${searchResult.matchedOn}`);

      if (!args.dryRun) {
        await db.query(
          `UPDATE main.spaces SET "websiteUrl" = $1, "updatedAt" = NOW() WHERE id = $2`,
          [websiteUrl, space.id],
        );
      }
      counters.websitesFound++;
    } else {
      console.log(`${progress} No website found for: ${space.notificationMsg}`);
      return; // Can't do much without a website
    }
  }

  // ── Step 2: Fetch the website once and reuse the HTML ──
  const normalizedWebsiteUrl = normalizeUrl(websiteUrl);
  const html = await fetchPage(normalizedWebsiteUrl);

  if (!html) {
    console.log(`${progress} Could not fetch website HTML from: ${normalizedWebsiteUrl}`);
  }

  // ── Step 3: Extract email from website ──
  if (!space.businessEmail) {
    // crawlForEmails handles its own fetch + contact page traversal,
    // so we call it separately (it may follow contact/about links)
    const emailResults = await crawlForEmails(websiteUrl);
    if (emailResults.length > 0) {
      const bestEmail = emailResults[0];
      console.log(`${progress} EMAIL (${bestEmail.source}): ${bestEmail.email}`);

      if (!args.dryRun) {
        await db.query(
          `UPDATE main.spaces SET "businessEmail" = $1, "updatedAt" = NOW() WHERE id = $2`,
          [bestEmail.email, space.id],
        );
      }
      counters.emailsFound++;
    }
  }

  // ── Step 4: Extract details from pre-fetched HTML (no redundant fetch) ──
  if (html) {
    const details = await crawlForDetails(websiteUrl, html);

    if (details.description && (!space.message || space.message === space.notificationMsg)) {
      const newMessage = `${space.notificationMsg} - ${details.description}`;
      console.log(`${progress} DESCRIPTION: ${details.description.substring(0, 80)}...`);

      if (!args.dryRun) {
        await db.query(
          `UPDATE main.spaces SET message = $1, "updatedAt" = NOW() WHERE id = $2`,
          [newMessage, space.id],
        );
      }
      counters.descriptionsFound++;
    }

    if (details.openingHours && !space.openingHours) {
      const timezone = resolveTimezone(space.addressLocality || '');
      const hoursJson = JSON.stringify({
        schema: details.openingHours,
        timezone,
        isConfirmed: false,
      });
      console.log(`${progress} HOURS: ${details.openingHours.length} rule(s) found (${timezone})`);

      if (!args.dryRun) {
        await db.query(
          `UPDATE main.spaces SET "openingHours" = $1::jsonb, "updatedAt" = NOW() WHERE id = $2`,
          [hoursJson, space.id],
        );
      }
      counters.hoursFound++;
    }

    if (details.phoneNumber && !space.phoneNumber) {
      console.log(`${progress} PHONE: ${details.phoneNumber}`);

      if (!args.dryRun) {
        await db.query(
          `UPDATE main.spaces SET "phoneNumber" = $1, "updatedAt" = NOW() WHERE id = $2`,
          [details.phoneNumber, space.id],
        );
      }
      counters.phonesFound++;
    }
  }

  // ── Step 5: Source image from website ──
  if (spaceNeedsImages(space)) {
    if (args.dryRun) {
      console.log(`${progress} Would source image from ${websiteUrl}`);
    } else {
      const imageSourced = await sourceImageForSpace(
        db, space, websiteUrl, space.fromUserId || args.userId, progress,
      );
      if (imageSourced) counters.imagesFound++;
    }
  }
}

// ── Phase 1: Import new spaces from OSM ──────────────────────────────────────
async function runImport(db: Pool, args: ICliArgs, counters: ICounters): Promise<string[]> {
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

  const allInsertedIds: string[] = [];
  let remaining = args.limit || Infinity;

  for (const cityKey of cityKeys) {
    if (remaining <= 0) break;
    const city = CITIES[cityKey];
    console.log(`\n── Import: ${city.name}, ${city.regionCode} ──────────────────────────`);

    const osmElements = await fetchOsmData(city, args.category);
    counters.fetched += osmElements.length;

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
        counters.skippedValidation++;
      }
    }
    spaces = validSpaces;

    // Deduplicate within batch
    spaces = deduplicateWithinBatch(spaces);

    console.log(`  Transformed: ${spaces.length} valid spaces (${osmElements.length - spaces.length} filtered)`);

    if (remaining < spaces.length) {
      console.log(`  Limiting to ${remaining} spaces (--limit)`);
      spaces = spaces.slice(0, remaining);
    }

    if (args.dryRun) {
      console.log('\n  Sample (first 5):');
      spaces.slice(0, 5).forEach((s) => {
        console.log(`    - ${s.notificationMsg} (${s.category}) @ ${s.latitude.toFixed(4)}, ${s.longitude.toFixed(4)}`);
        console.log(`      ${s.addressReadable}`);
        if (s.phoneNumber) console.log(`      Phone: ${s.phoneNumber}`);
        if (s.websiteUrl) console.log(`      Web: ${s.websiteUrl}`);
      });
      counters.imported += spaces.length;
      remaining -= spaces.length;
      continue;
    }

    // Deduplicate against DB
    if (!args.skipDedup) {
      console.log('  Checking for duplicates in database...');
      const duplicates = await findDuplicates(db, spaces);
      if (duplicates.size > 0) {
        console.log(`  Found ${duplicates.size} duplicates, skipping.`);
        counters.skippedDuplicate += duplicates.size;
        spaces = spaces.filter((_, idx) => !duplicates.has(idx));
      }
    }

    // Insert
    if (spaces.length > 0) {
      console.log(`  Inserting ${spaces.length} spaces...`);
      const { inserted, ids } = await insertSpaces(db, spaces);
      counters.imported += inserted;
      remaining -= inserted;
      allInsertedIds.push(...ids);
      console.log(`  Inserted: ${inserted}`);
    }
  }

  return allInsertedIds;
}

// ── Phase 2: Enrich spaces ───────────────────────────────────────────────────
async function runEnrichment(db: Pool, spaces: ISpaceRow[], args: ICliArgs, counters: ICounters): Promise<void> {
  console.log(`\n── Enrichment: ${spaces.length} spaces to process ──────────────────────────`);

  for (let i = 0; i < spaces.length; i++) {
    const space = spaces[i];
    const progress = `[${i + 1}/${spaces.length}]`;

    console.log(`\n${progress} ${space.notificationMsg}`);

    try {
      await enrichSpace(db, space, args, counters, progress);
    } catch (err: any) {
      console.error(`${progress} ERROR: ${err.message}`);
      counters.enrichErrors++;
    }

    if (i < spaces.length - 1) await sleep(args.delay);
  }
}

// ── Print summary ────────────────────────────────────────────────────────────
function printSummary(args: ICliArgs, counters: ICounters) {
  console.log('\n══════════════════════════════════════');

  if (!args.enrichExisting) {
    console.log(`Fetched from OSM:         ${counters.fetched}`);
    console.log(`Skipped (validation):     ${counters.skippedValidation}`);
    console.log(`Skipped (duplicate):      ${counters.skippedDuplicate}`);
    console.log(`${args.dryRun ? 'Would insert' : 'Inserted'}:              ${counters.imported}`);
    console.log('──────────────────────────────────────');
  }

  const dryLabel = args.dryRun ? ' (dry run)' : '';
  console.log(`Websites found${dryLabel}:   ${counters.websitesFound}`);
  console.log(`Emails found${dryLabel}:     ${counters.emailsFound}`);
  console.log(`Images sourced${dryLabel}:   ${counters.imagesFound}`);
  console.log(`Descriptions found${dryLabel}: ${counters.descriptionsFound}`);
  console.log(`Hours found${dryLabel}:      ${counters.hoursFound}`);
  console.log(`Phones found${dryLabel}:     ${counters.phonesFound}`);
  console.log(`Enrichment errors:        ${counters.enrichErrors}`);
  console.log('══════════════════════════════════════\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();

  console.log('\nManage Space CLI');
  console.log(`  Mode:          ${args.enrichExisting ? 'enrich existing' : 'import + enrich'}`);
  console.log(`  City:          ${args.city}`);
  console.log(`  Category:      ${args.category}`);
  console.log(`  Dry run:       ${args.dryRun}`);
  console.log(`  Limit:         ${args.limit || 'none'}`);
  console.log(`  Delay:         ${args.delay}ms`);
  if (args.singleId) console.log(`  Space ID:      ${args.singleId}`);
  if (!args.enrichExisting) {
    console.log(`  Skip dedup:    ${args.skipDedup}`);
    console.log(`  Skip enrich:   ${args.skipEnrich}`);
  }
  console.log('');

  const db = createDbPool();

  // Test connection
  try {
    await db.query('SELECT 1');
    console.log('Database connection established.\n');
  } catch (err: any) {
    console.error(`Database connection failed: ${err.message}`);
    console.error('Make sure .env is configured with DB_HOST_MAIN_WRITE, DB_USER_MAIN_WRITE, etc.');
    await db.end();
    process.exit(1);
  }

  const counters = newCounters();

  if (args.enrichExisting) {
    // ── Enrich-existing mode ──
    const spaces = await querySpacesForEnrichment(db, args);
    if (spaces.length === 0) {
      console.log('No spaces found needing enrichment.');
    } else {
      await runEnrichment(db, spaces, args, counters);
    }
  } else {
    // ── Import + enrich mode ──

    // Phase 1: Import from OSM
    const insertedIds = await runImport(db, args, counters);

    // Phase 2: Enrich newly imported spaces
    if (!args.skipEnrich && !args.dryRun && insertedIds.length > 0) {
      const newSpaces = await querySpacesByIds(db, insertedIds);
      // Only enrich spaces that are missing info (no website, email, or image)
      const spacesToEnrich = newSpaces.filter(
        (s) => !s.websiteUrl || !s.businessEmail || spaceNeedsImages(s),
      );
      if (spacesToEnrich.length > 0) {
        await runEnrichment(db, spacesToEnrich, args, counters);
      } else {
        console.log('\nAll imported spaces already have complete information.');
      }
    }
  }

  printSummary(args, counters);
  await db.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
