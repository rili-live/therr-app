#!/usr/bin/env node
/**
 * CLI tool to enrich imported spaces with metadata scraped from their website.
 *
 * Where `source-images` fills in a photo and `source-emails-websites` fills in
 * contact details, this fills in the fields that make a space listing feel
 * complete: phone, menu / order / reservation links, price range, cuisine, and
 * opening hours.
 *
 * Primary source is the site's schema.org JSON-LD block, which most restaurant
 * and retail sites publish; anchor-text heuristics cover the rest.
 *
 * Only writes columns that are currently NULL/empty — an operator or business
 * owner's own value is never overwritten.
 *
 * Usage:
 *   npx ts-node scripts/import-spaces/enrich-metadata --city chicago --dry-run --limit 5
 *   npx ts-node scripts/import-spaces/enrich-metadata --limit 100
 *
 * Requires .env at project root or scripts/import-spaces/.env with DB credentials.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Pool } from 'pg';
import { CITIES } from './config';
import { assertDbConnection, createDbPool } from './utils/db';
import { fetchHtml } from './utils/httpFetch';
import { extractStructuredBusiness, IStructuredBusiness } from './sources/jsonLd';
import { parseSchemaHours } from './transforms/parseSchemaHours';

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ── Help ─────────────────────────────────────────────────────────────────────
function printHelp() {
  const cityList = Object.keys(CITIES).join(', ');
  console.log(`
Enrich Metadata CLI — Fill in menu/order/reservation links, phone, hours,
price range and cuisine for imported spaces by reading their website.

Usage:
  npx ts-node scripts/import-spaces/enrich-metadata [options]

Options:
  --city <name>      Filter by addressLocality (default: all)
                     Available: ${cityList}, all
  --category <name>  Filter by Therr category string (default: all)
  --fields <list>    Comma-separated fields to fill (default: all)
                     Available: phone,menu,order,reservation,price,cuisine,hours
  --limit <n>        Max spaces to process (default: 50)
  --delay <ms>       Delay between requests in ms (default: 2000)
  --dry-run          Crawl and log without updating the database
  --help, -h         Show this help message

Examples:
  npx ts-node scripts/import-spaces/enrich-metadata --dry-run --limit 10
  npx ts-node scripts/import-spaces/enrich-metadata --city chicago --fields menu,order --limit 50
`);
}

const ALL_FIELDS = ['phone', 'menu', 'order', 'reservation', 'price', 'cuisine', 'hours'] as const;
type EnrichField = typeof ALL_FIELDS[number];

interface ICliArgs {
  city: string;
  category: string;
  fields: Set<EnrichField>;
  dryRun: boolean;
  limit: number;
  delay: number;
}

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

  let fields = new Set<EnrichField>(ALL_FIELDS);
  if (parsed.fields) {
    const requested = parsed.fields.split(',').map((f) => f.trim()).filter(Boolean);
    const invalid = requested.filter((f) => !ALL_FIELDS.includes(f as EnrichField));
    if (invalid.length > 0) {
      console.error(`Invalid --fields value(s): ${invalid.join(', ')}. Available: ${ALL_FIELDS.join(',')}`);
      process.exit(1);
    }
    fields = new Set(requested as EnrichField[]);
  }

  return {
    city: parsed.city || 'all',
    category: parsed.category || 'all',
    fields,
    dryRun: parsed.dryRun === 'true',
    limit: parsed.limit ? parseInt(parsed.limit, 10) : 50,
    delay: parsed.delay ? parseInt(parsed.delay, 10) : 2000,
  };
}

interface ISpaceRow {
  id: string;
  notificationMsg: string;
  websiteUrl: string;
  phoneNumber: string | null;
  menuUrl: string | null;
  orderUrl: string | null;
  reservationUrl: string | null;
  priceRange: number | null;
  foodStyle: string | null;
  openingHours: unknown;
}

/**
 * Target spaces that have a website to read and at least one requested field
 * still empty. Without the second half we would re-crawl thousands of spaces
 * that are already complete.
 */
function buildMissingClause(fields: Set<EnrichField>): string {
  const clauses: string[] = [];
  if (fields.has('phone')) clauses.push('("phoneNumber" IS NULL OR "phoneNumber" = \'\')');
  if (fields.has('menu')) clauses.push('("menuUrl" IS NULL OR "menuUrl" = \'\')');
  if (fields.has('order')) clauses.push('("orderUrl" IS NULL OR "orderUrl" = \'\')');
  if (fields.has('reservation')) clauses.push('("reservationUrl" IS NULL OR "reservationUrl" = \'\')');
  if (fields.has('price')) clauses.push('"priceRange" IS NULL');
  if (fields.has('cuisine')) clauses.push('("foodStyle" IS NULL OR "foodStyle" = \'\')');
  if (fields.has('hours')) clauses.push('"openingHours" IS NULL');
  return clauses.length > 0 ? `(${clauses.join(' OR ')})` : 'TRUE';
}

async function querySpaces(db: Pool, args: ICliArgs): Promise<ISpaceRow[]> {
  const conditions = [
    '"websiteUrl" IS NOT NULL',
    '"websiteUrl" != \'\'',
    buildMissingClause(args.fields),
  ];
  const params: (string | number)[] = [];

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

  params.push(args.limit);
  const query = `SELECT id, "notificationMsg", "websiteUrl", "phoneNumber", "menuUrl",
      "orderUrl", "reservationUrl", "priceRange", "foodStyle", "openingHours"
    FROM main.spaces
    WHERE ${conditions.join(' AND ')}
    ORDER BY RANDOM()
    LIMIT $${params.length}`;

  const result = await db.query(query, params);
  return result.rows;
}

// ── Anchor-text fallbacks ────────────────────────────────────────────────────

/** Known ordering and reservation platforms, matched against link hrefs. */
const ORDER_DOMAINS = [
  'toasttab.com', 'doordash.com', 'ubereats.com', 'grubhub.com', 'seamless.com',
  'chownow.com', 'slicelife.com', 'olo.com', 'squareup.com', 'clover.com',
  'postmates.com', 'caviar.com', 'menufy.com', 'orderspoon.com',
];
const RESERVATION_DOMAINS = [
  'opentable.com', 'resy.com', 'sevenrooms.com', 'tock.com', 'yelp.com/reservations',
  'quandoo.com', 'bookenda.com', 'eatapp.co',
];

interface IAnchor { href: string; text: string; }

function extractAnchors(html: string, baseUrl: string): IAnchor[] {
  const anchors: IAnchor[] = [];
  const anchorRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi;

  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = anchorRegex.exec(html)) !== null) {
    let href = match[1];
    try {
      href = new URL(href, baseUrl).href;
    } catch {
      continue;
    }
    const text = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    anchors.push({ href, text });
  }

  return anchors;
}

function findByDomains(anchors: IAnchor[], domains: string[]): string | undefined {
  const hit = anchors.find((a) => domains.some((d) => a.href.toLowerCase().includes(d)));
  return hit?.href;
}

function findByText(anchors: IAnchor[], pattern: RegExp, hrefPattern?: RegExp): string | undefined {
  const hit = anchors.find((a) => pattern.test(a.text) || (hrefPattern ? hrefPattern.test(a.href) : false));
  return hit?.href;
}

/**
 * Extract a North American phone number from page text.
 * Deliberately conservative: requires a recognizable 10-digit shape.
 */
function extractPhone(html: string): string | undefined {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  const telMatch = stripped.match(/href=["']tel:([^"']+)["']/i);
  if (telMatch) {
    const digits = telMatch[1].replace(/[^\d+]/g, '');
    if (digits.replace(/\D/g, '').length >= 10) return digits;
  }

  const text = stripped.replace(/<[^>]+>/g, ' ');
  const phoneMatch = text.match(/(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})(?!\d)/);
  if (phoneMatch) return `(${phoneMatch[1]}) ${phoneMatch[2]}-${phoneMatch[3]}`;

  return undefined;
}

/** schema.org priceRange is "$$" or "$10-$20"; Therr stores an integer 1-4. */
function parsePriceRange(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const dollarSigns = raw.match(/\$/g);
  if (dollarSigns && dollarSigns.length >= 1 && dollarSigns.length <= 4 && !/\d/.test(raw)) {
    return dollarSigns.length;
  }
  // Numeric ranges like "$10-$25" — bucket by the lower bound.
  const numeric = raw.match(/(\d+)/);
  if (numeric) {
    const value = parseInt(numeric[1], 10);
    if (value <= 10) return 1;
    if (value <= 25) return 2;
    if (value <= 50) return 3;
    return 4;
  }
  return undefined;
}

interface IEnrichment {
  phoneNumber?: string;
  menuUrl?: string;
  orderUrl?: string;
  reservationUrl?: string;
  priceRange?: number;
  foodStyle?: string;
  openingHours?: string;
}

function buildEnrichment(
  space: ISpaceRow,
  structured: IStructuredBusiness | null,
  anchors: IAnchor[],
  html: string,
  fields: Set<EnrichField>,
): IEnrichment {
  const result: IEnrichment = {};
  const isEmpty = (v: string | null) => !v || v === '';

  if (fields.has('phone') && isEmpty(space.phoneNumber)) {
    result.phoneNumber = structured?.telephone || extractPhone(html);
  }

  if (fields.has('menu') && isEmpty(space.menuUrl)) {
    result.menuUrl = structured?.menuUrl
      || findByText(anchors, /^\s*(menu|our menu|food menu|menus)\s*$/i, /\/menus?(\/|$|\?)/i);
  }

  if (fields.has('order') && isEmpty(space.orderUrl)) {
    result.orderUrl = structured?.orderUrl
      || findByDomains(anchors, ORDER_DOMAINS)
      || findByText(anchors, /^\s*(order online|order now|order pickup|order delivery)\s*$/i);
  }

  if (fields.has('reservation') && isEmpty(space.reservationUrl)) {
    result.reservationUrl = structured?.reservationUrl
      || findByDomains(anchors, RESERVATION_DOMAINS)
      || findByText(anchors, /^\s*(reserve|reservations|book a table|book now)\s*$/i);
  }

  if (fields.has('price') && space.priceRange === null) {
    result.priceRange = parsePriceRange(structured?.priceRange);
  }

  if (fields.has('cuisine') && isEmpty(space.foodStyle) && structured?.servesCuisine) {
    result.foodStyle = structured.servesCuisine.join(', ').substring(0, 100);
  }

  if (fields.has('hours') && !space.openingHours && structured?.openingHours) {
    const parsed = parseSchemaHours(structured.openingHours);
    if (parsed) result.openingHours = JSON.stringify(parsed);
  }

  // Drop keys that resolved to undefined so the UPDATE stays minimal.
  for (const key of Object.keys(result) as (keyof IEnrichment)[]) {
    if (result[key] === undefined) delete result[key];
  }

  return result;
}

const COLUMN_BY_KEY: Record<keyof IEnrichment, string> = {
  phoneNumber: 'phoneNumber',
  menuUrl: 'menuUrl',
  orderUrl: 'orderUrl',
  reservationUrl: 'reservationUrl',
  priceRange: 'priceRange',
  foodStyle: 'foodStyle',
  openingHours: 'openingHours',
};

async function applyEnrichment(db: Pool, spaceId: string, enrichment: IEnrichment): Promise<void> {
  const keys = Object.keys(enrichment) as (keyof IEnrichment)[];
  if (keys.length === 0) return;

  const params: unknown[] = [];
  const assignments = keys.map((key) => {
    params.push(enrichment[key]);
    const cast = key === 'openingHours' ? '::jsonb' : '';
    return `"${COLUMN_BY_KEY[key]}" = $${params.length}${cast}`;
  });

  params.push(spaceId);
  await db.query(
    `UPDATE main.spaces SET ${assignments.join(', ')}, "updatedAt" = NOW() WHERE id = $${params.length}`,
    params,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();
  console.log('\nEnrich Metadata CLI');
  console.log(`  City:     ${args.city}`);
  console.log(`  Category: ${args.category}`);
  console.log(`  Fields:   ${Array.from(args.fields).join(', ')}`);
  console.log(`  Dry run:  ${args.dryRun}`);
  console.log(`  Limit:    ${args.limit}`);
  console.log(`  Delay:    ${args.delay}ms`);
  console.log('');

  const db = createDbPool();
  await assertDbConnection(db);
  console.log('');

  const spaces = await querySpaces(db, args);
  console.log(`Found ${spaces.length} spaces with a website and missing metadata.\n`);

  if (spaces.length === 0) {
    await db.end();
    return;
  }

  const fieldCounts: Record<string, number> = {};
  let enrichedSpaces = 0;
  let noData = 0;
  let errors = 0;
  let jsonLdHits = 0;

  for (let i = 0; i < spaces.length; i++) {
    const space = spaces[i];
    const progress = `[${i + 1}/${spaces.length}]`;

    try {
      const page = await fetchHtml(space.websiteUrl, { label: 'enrich' });
      if (!page) {
        console.log(`${progress} SKIP (unreachable): ${space.notificationMsg} — ${space.websiteUrl}`);
        noData++;
        if (i < spaces.length - 1) await sleep(args.delay);
        continue;
      }

      const structured = extractStructuredBusiness(page.html);
      if (structured) jsonLdHits++;

      const anchors = extractAnchors(page.html, page.finalUrl);
      const enrichment = buildEnrichment(space, structured, anchors, page.html, args.fields);
      const found = Object.keys(enrichment);

      if (found.length === 0) {
        console.log(`${progress} SKIP (nothing new): ${space.notificationMsg}`);
        noData++;
      } else {
        const summary = found.map((k) => {
          const value = String((enrichment as Record<string, unknown>)[k]);
          return `${k}=${value.length > 60 ? `${value.slice(0, 57)}…` : value}`;
        }).join(', ');
        const label = structured ? `json-ld:${structured.matchedType}` : 'html';
        console.log(`${progress} ${args.dryRun ? 'DRY RUN — ' : ''}ENRICHED (${label}) ${space.notificationMsg}`);
        console.log(`${progress}   ${summary}`);

        if (!args.dryRun) await applyEnrichment(db, space.id, enrichment);

        enrichedSpaces++;
        for (const key of found) fieldCounts[key] = (fieldCounts[key] || 0) + 1;
      }
    } catch (err: any) {
      console.error(`${progress} ERROR: ${space.notificationMsg} — ${err.message}`);
      errors++;
    }

    if (i < spaces.length - 1) await sleep(args.delay);
  }

  console.log('\n══════════════════════════════════════');
  console.log(`Spaces processed:      ${spaces.length}`);
  console.log(`Spaces enriched:       ${enrichedSpaces}`);
  console.log(`Nothing found:         ${noData}`);
  console.log(`Errors:                ${errors}`);
  console.log(`Pages with JSON-LD:    ${jsonLdHits}`);
  if (Object.keys(fieldCounts).length > 0) {
    console.log('\nFields filled:');
    for (const [field, count] of Object.entries(fieldCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${field.padEnd(18)} ${count}`);
    }
  }
  console.log('══════════════════════════════════════\n');

  await db.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
