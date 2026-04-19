#!/usr/bin/env node
/**
 * Bulk-clear lingering `isClaimPending` flags on spaces.
 *
 * Mirrors the admin "Approve" button's DB effect at scale, so ops can clear
 * stale pending claims (e.g., from closed businesses, old test data) from the
 * admin approval queue in one shot.
 *
 * Usage:
 *   npx ts-node scripts/import-spaces/clear-pending --dry-run
 *   npx ts-node scripts/import-spaces/clear-pending --city chicago --dry-run
 *   npx ts-node scripts/import-spaces/clear-pending --ids <id1>,<id2>
 *   npx ts-node scripts/import-spaces/clear-pending --before-date 2025-01-01 --dry-run
 *
 * Default behavior without --yes is equivalent to --dry-run — writes only happen
 * when you explicitly pass --yes, to protect against accidental mass clears.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { CITIES } from './config';
import { assertDbConnection, createDbPool } from './utils/db';

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function printHelp() {
  const cityList = Object.keys(CITIES).join(', ');
  console.log(`
Clear Pending Claims CLI — Bulk-clear stale isClaimPending flags.

Usage:
  npx ts-node scripts/import-spaces/clear-pending [options]

Options:
  --city <name>          Filter by addressLocality (default: all)
                         Available: ${cityList}, all
  --category <name>      Filter by Therr category (default: all)
                         e.g. "categories.restaurant/food"
  --ids <csv>            Only touch these space UUIDs (comma-separated)
  --before-date <date>   Only rows updated before this date (ISO, YYYY-MM-DD)
  --limit <n>            Cap the number of rows touched (default: no cap)
  --dry-run              Print matching rows without writing (default)
  --yes                  Actually perform the UPDATE (required to write)
  --help, -h             Show this help message

Effect:
  UPDATE main.spaces
     SET "isClaimPending" = false,
         "updatedAt" = NOW()
   WHERE "isClaimPending" = true
     AND (/* filters */);

Examples:
  # Preview all currently-pending rows
  npx ts-node scripts/import-spaces/clear-pending --dry-run

  # Preview pending rows in a single city
  npx ts-node scripts/import-spaces/clear-pending --city chicago --dry-run

  # Actually clear a targeted set
  npx ts-node scripts/import-spaces/clear-pending --ids abc,def --yes
`);
}

interface ICliArgs {
  city: string;
  category: string;
  ids: string[];
  beforeDate: string | null;
  limit: number;
  dryRun: boolean;
  yes: boolean;
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
    } else if (args[i] === '--yes') {
      parsed.yes = 'true';
    } else if (args[i].startsWith('--') && i + 1 < args.length) {
      parsed[args[i].replace('--', '')] = args[i + 1];
      i++;
    }
  }

  const ids = parsed.ids
    ? parsed.ids.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  return {
    city: parsed.city || 'all',
    category: parsed.category || 'all',
    ids,
    beforeDate: parsed['before-date'] || null,
    limit: parsed.limit ? parseInt(parsed.limit, 10) : 0,
    // If neither --dry-run nor --yes was passed, default to dry-run for safety.
    dryRun: parsed.dryRun === 'true' || parsed.yes !== 'true',
    yes: parsed.yes === 'true',
  };
}

interface IWhereClause {
  sql: string;
  params: (string | number | string[])[];
}

function buildWhereClause(args: ICliArgs): IWhereClause {
  const conditions: string[] = [`"isClaimPending" = true`];
  const params: (string | number | string[])[] = [];
  let idx = 1;

  if (args.ids.length > 0) {
    conditions.push(`id = ANY($${idx}::uuid[])`);
    params.push(args.ids);
    idx++;
  }

  if (args.city !== 'all') {
    const cityConfig = CITIES[args.city];
    if (cityConfig) {
      conditions.push(`"addressLocality" ILIKE $${idx}`);
      params.push(`%${cityConfig.name}%`);
      idx++;
    }
  }

  if (args.category !== 'all') {
    conditions.push(`category = $${idx}`);
    params.push(args.category);
    idx++;
  }

  if (args.beforeDate) {
    conditions.push(`"updatedAt" < $${idx}`);
    params.push(args.beforeDate);
    idx++;
  }

  return { sql: conditions.join(' AND '), params };
}

async function main() {
  const args = parseArgs();

  console.log('\nClear Pending Claims CLI');
  console.log(`  City:         ${args.city}`);
  console.log(`  Category:     ${args.category}`);
  console.log(`  IDs:          ${args.ids.length || 'none'}`);
  console.log(`  Before date:  ${args.beforeDate || 'none'}`);
  console.log(`  Limit:        ${args.limit || 'none'}`);
  console.log(`  Dry run:      ${args.dryRun}\n`);

  const where = buildWhereClause(args);
  const db = createDbPool({ max: 3 });
  await assertDbConnection(db);

  try {
    let selectSql = `SELECT id, "notificationMsg", "addressLocality", category, "updatedAt"
        FROM main.spaces
       WHERE ${where.sql}
       ORDER BY "updatedAt" DESC`;
    if (args.limit > 0) {
      selectSql += ` LIMIT ${args.limit}`;
    }

    const { rows } = await db.query(selectSql, where.params);
    console.log(`Matched ${rows.length} row(s) with isClaimPending=true.`);
    for (const row of rows.slice(0, 20)) {
      console.log(`  ${row.id}  ${row.addressLocality || '?'}  ${row.category || '?'}  — ${row.notificationMsg}`);
    }
    if (rows.length > 20) {
      console.log(`  …and ${rows.length - 20} more.`);
    }

    if (args.dryRun) {
      console.log('\nDry run — no changes made. Re-run with --yes to apply.');
      return;
    }

    if (rows.length === 0) {
      console.log('\nNothing to clear.');
      return;
    }

    const ids = rows.map((r: { id: string }) => r.id);
    const { rowCount } = await db.query(
      `UPDATE main.spaces
          SET "isClaimPending" = false,
              "updatedAt" = NOW()
        WHERE id = ANY($1::uuid[])`,
      [ids],
    );

    console.log(`\nCleared isClaimPending on ${rowCount} row(s).`);
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
