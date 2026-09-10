#!/usr/bin/env node
/**
 * CLI tool to report metadata coverage across imported spaces.
 *
 * Answers the question every other script in this directory raises: what is
 * actually left to do, and is a run worth starting? It separates "missing" from
 * "actionable" — a space with no image and no website cannot be helped by
 * `source-images`, so counting it in that backlog is misleading.
 *
 * Usage:
 *   npx ts-node scripts/import-spaces/stats
 *   npx ts-node scripts/import-spaces/stats --city chicago
 *   npx ts-node scripts/import-spaces/stats --by-city
 *
 * Requires .env at project root or scripts/import-spaces/.env with DB credentials.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { CITIES } from './config';
import { assertDbConnection, createDbPool } from './utils/db';
import { ProcessedType, processedIdsArray, getProcessedStats } from './utils/processedSpaces';

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function printHelp() {
  const cityList = Object.keys(CITIES).join(', ');
  console.log(`
Import Spaces Stats — Metadata coverage report.

Usage:
  npx ts-node scripts/import-spaces/stats [options]

Options:
  --city <name>   Restrict to one city (default: all)
                  Available: ${cityList}, all
  --by-city       Break the image/website backlog down per city
  --help, -h      Show this help message

Examples:
  npx ts-node scripts/import-spaces/stats
  npx ts-node scripts/import-spaces/stats --by-city
  npx ts-node scripts/import-spaces/stats --city chicago
`);
}

interface ICliArgs {
  city: string;
  byCity: boolean;
}

function parseArgs(): ICliArgs {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') {
      printHelp();
      process.exit(0);
    } else if (args[i] === '--by-city') {
      parsed.byCity = 'true';
    } else if (args[i].startsWith('--') && i + 1 < args.length) {
      parsed[args[i].replace('--', '')] = args[i + 1];
      i++;
    }
  }

  return { city: parsed.city || 'all', byCity: parsed.byCity === 'true' };
}

function cityFilter(args: ICliArgs): { clause: string; params: string[] } {
  if (args.city === 'all') return { clause: 'TRUE', params: [] };
  const cityConfig = CITIES[args.city];
  if (!cityConfig) {
    console.error(`Unknown city: "${args.city}". Run --help for the list.`);
    process.exit(1);
  }
  return { clause: '"addressLocality" ILIKE $1', params: [`%${cityConfig.name}%`] };
}

function bar(value: number, total: number, width = 24): string {
  if (total === 0) return ''.padEnd(width, '░');
  const filled = Math.round((value / total) * width);
  return '█'.repeat(filled).padEnd(width, '░');
}

function row(label: string, have: number, total: number): string {
  const pct = total > 0 ? Math.round((have / total) * 100) : 0;
  return `  ${label.padEnd(16)} ${bar(have, total)} ${String(pct).padStart(3)}%  ${have}/${total}`;
}

async function main() {
  const args = parseArgs();
  const { clause, params } = cityFilter(args);

  const db = createDbPool({ max: 3 });
  await assertDbConnection(db);

  const totalsResult = await db.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE ("mediaIds" IS NOT NULL AND "mediaIds" != '') OR medias IS NOT NULL)::int AS has_media,
      COUNT(*) FILTER (WHERE "websiteUrl" IS NOT NULL AND "websiteUrl" != '')::int AS has_website,
      COUNT(*) FILTER (WHERE "businessEmail" IS NOT NULL AND "businessEmail" != '')::int AS has_email,
      COUNT(*) FILTER (WHERE "phoneNumber" IS NOT NULL AND "phoneNumber" != '')::int AS has_phone,
      COUNT(*) FILTER (WHERE "openingHours" IS NOT NULL)::int AS has_hours,
      COUNT(*) FILTER (WHERE "menuUrl" IS NOT NULL AND "menuUrl" != '')::int AS has_menu,
      COUNT(*) FILTER (WHERE "orderUrl" IS NOT NULL AND "orderUrl" != '')::int AS has_order,
      COUNT(*) FILTER (WHERE "reservationUrl" IS NOT NULL AND "reservationUrl" != '')::int AS has_reservation,
      COUNT(*) FILTER (WHERE "priceRange" IS NOT NULL)::int AS has_price,
      COUNT(*) FILTER (WHERE "foodStyle" IS NOT NULL AND "foodStyle" != '')::int AS has_cuisine
    FROM main.spaces WHERE ${clause}
  `, params);

  const t = totalsResult.rows[0];
  const scope = args.city === 'all' ? 'all cities' : CITIES[args.city].name;

  console.log(`\n══ Space metadata coverage — ${scope} ══\n`);
  console.log(row('Image', t.has_media, t.total));
  console.log(row('Website', t.has_website, t.total));
  console.log(row('Business email', t.has_email, t.total));
  console.log(row('Phone', t.has_phone, t.total));
  console.log(row('Opening hours', t.has_hours, t.total));
  console.log(row('Menu URL', t.has_menu, t.total));
  console.log(row('Order URL', t.has_order, t.total));
  console.log(row('Reservation URL', t.has_reservation, t.total));
  console.log(row('Price range', t.has_price, t.total));
  console.log(row('Cuisine', t.has_cuisine, t.total));

  // Backlog: what each script could actually act on right now.
  const imageProcessed = processedIdsArray([ProcessedType.NO_IMAGE_FOUND, ProcessedType.IMAGE_FOUND]);
  const websiteProcessed = processedIdsArray([ProcessedType.NO_WEBSITE_FOUND, ProcessedType.WEBSITE_FOUND]);
  const emailProcessed = processedIdsArray([ProcessedType.NO_EMAIL_FOUND, ProcessedType.EMAIL_FOUND]);

  const backlogResult = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE needs_image)::int AS needs_image,
      COUNT(*) FILTER (WHERE needs_image AND has_site)::int AS image_actionable,
      COUNT(*) FILTER (WHERE needs_image AND has_site AND NOT (id = ANY($${params.length + 1}::uuid[])))::int AS image_untried,
      COUNT(*) FILTER (WHERE NOT has_site)::int AS needs_website,
      COUNT(*) FILTER (WHERE NOT has_site AND NOT (id = ANY($${params.length + 2}::uuid[])))::int AS website_untried,
      COUNT(*) FILTER (WHERE has_site AND "businessEmail" IS NULL)::int AS needs_email,
      COUNT(*) FILTER (WHERE has_site AND "businessEmail" IS NULL AND NOT (id = ANY($${params.length + 3}::uuid[])))::int AS email_untried
    FROM (
      SELECT id, "businessEmail",
        (("mediaIds" IS NULL OR "mediaIds" = '') AND medias IS NULL) AS needs_image,
        ("websiteUrl" IS NOT NULL AND "websiteUrl" != '') AS has_site
      FROM main.spaces WHERE ${clause}
    ) s
  `, [...params, imageProcessed, websiteProcessed, emailProcessed]);

  const b = backlogResult.rows[0];
  console.log('\n── Actionable backlog ────────────────────────────────');
  console.log(`  Missing an image:            ${b.needs_image}`);
  console.log(`    ├─ has a website to crawl: ${b.image_actionable}`);
  console.log(`    └─ not yet attempted:      ${b.image_untried}   ← source-images`);
  console.log(`  Missing a website:           ${b.needs_website}`);
  console.log(`    └─ not yet attempted:      ${b.website_untried}   ← source-emails-websites --mode website`);
  console.log(`  Missing email (has site):    ${b.needs_email}`);
  console.log(`    └─ not yet attempted:      ${b.email_untried}   ← source-emails-websites --mode email`);

  if (b.image_untried === 0 && b.needs_image > 0) {
    console.log('\n  Note: every space missing an image has already been attempted.');
    console.log('        Use --retry-failed on source-images to revisit them.');
  }

  if (args.byCity) {
    const perCity = await db.query(`
      SELECT COALESCE("addressLocality", '(no city)') AS city,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE ("mediaIds" IS NULL OR "mediaIds" = '') AND medias IS NULL
                           AND "websiteUrl" IS NOT NULL AND "websiteUrl" != '')::int AS image_actionable,
        COUNT(*) FILTER (WHERE "websiteUrl" IS NULL OR "websiteUrl" = '')::int AS needs_website
      FROM main.spaces WHERE ${clause}
      GROUP BY 1 ORDER BY 3 DESC, 2 DESC LIMIT 25
    `, params);

    console.log('\n── Backlog by city (top 25) ──────────────────────────');
    console.log(`  ${'City'.padEnd(22)}${'Total'.padStart(7)}${'Img'.padStart(7)}${'Web'.padStart(7)}`);
    for (const r of perCity.rows) {
      const cells = [r.total, r.image_actionable, r.needs_website]
        .map((v) => String(v).padStart(7)).join('');
      console.log(`  ${String(r.city).padEnd(22)}${cells}`);
    }
  }

  const processedStats = getProcessedStats();
  const hasStats = Object.values(processedStats).some((v) => v > 0);
  if (hasStats) {
    console.log('\n── Local processed-spaces tracking ───────────────────');
    for (const [type, count] of Object.entries(processedStats)) {
      if (count > 0) console.log(`  ${type.padEnd(20)} ${count}`);
    }
  }

  console.log('');
  await db.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
