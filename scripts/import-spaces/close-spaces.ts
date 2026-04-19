#!/usr/bin/env node
/**
 * Batch close (soft-delete) spaces that are no longer operational.
 *
 * Parallels `update-space-contact.ts --closed` but operates on many IDs at
 * once. Sets `isPublic=false` and `isClaimPending=false` so the space
 * drops out of the public feed AND any admin approval queue.
 *
 * Usage:
 *   npx ts-node scripts/import-spaces/close-spaces --ids <id1>,<id2>[,...]
 *   npx ts-node scripts/import-spaces/close-spaces --ids-file path/to/ids.txt
 *   npx ts-node scripts/import-spaces/close-spaces --ids <id1>,<id2> --dry-run
 *
 * Reads .env from scripts/import-spaces/.env (preferred) or root .env.
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { assertDbConnection, createDbPool } from './utils/db';

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function printHelp() {
  console.log(`
Close Spaces CLI — Batch soft-delete spaces that are no longer operational.

Usage:
  npx ts-node scripts/import-spaces/close-spaces [options]

Options:
  --ids <csv>          Comma-separated list of space UUIDs to close
  --ids-file <path>    Path to a file with one space UUID per line
                       (# and blank lines are ignored)
  --dry-run            Print matched rows without making changes
  --help, -h           Show this help message

Effect (per ID):
  UPDATE main.spaces
     SET "isPublic" = false,
         "isClaimPending" = false,
         "updatedAt" = NOW()
   WHERE id = ANY($1);

Examples:
  npx ts-node scripts/import-spaces/close-spaces --ids abc,def --dry-run
  npx ts-node scripts/import-spaces/close-spaces --ids-file ./to-close.txt
`);
}

interface ICliArgs {
  ids: string[];
  dryRun: boolean;
}

function parseIdsFile(filePath: string): string[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
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

  const ids: string[] = [];
  if (parsed.ids) {
    ids.push(...parsed.ids.split(',').map((s) => s.trim()).filter(Boolean));
  }
  if (parsed['ids-file']) {
    ids.push(...parseIdsFile(parsed['ids-file']));
  }

  const unique = Array.from(new Set(ids));
  if (unique.length === 0) {
    console.error('Error: provide --ids or --ids-file with at least one space UUID.');
    process.exit(1);
  }

  return { ids: unique, dryRun: parsed.dryRun === 'true' };
}

async function main() {
  const args = parseArgs();

  console.log('\nClose Spaces CLI');
  console.log(`  IDs:     ${args.ids.length}`);
  console.log(`  Dry run: ${args.dryRun}\n`);

  const db = createDbPool({ max: 3 });
  await assertDbConnection(db);

  try {
    const { rows: matched } = await db.query(
      `SELECT id, "notificationMsg", "isPublic", "isClaimPending"
         FROM main.spaces
        WHERE id = ANY($1::uuid[])`,
      [args.ids],
    );

    if (matched.length === 0) {
      console.log('No matching spaces found.');
      return;
    }

    console.log(`Matched ${matched.length} of ${args.ids.length} requested IDs:`);
    for (const row of matched) {
      console.log(`  ${row.id}  isPublic=${row.isPublic}  isClaimPending=${row.isClaimPending}  ${row.notificationMsg}`);
    }

    const missing = args.ids.filter((id) => !matched.some((r: { id: string }) => r.id === id));
    if (missing.length > 0) {
      console.log(`\nNot found (${missing.length}):`);
      for (const id of missing) console.log(`  ${id}`);
    }

    if (args.dryRun) {
      console.log('\nDry run — no changes made.');
      return;
    }

    const matchedIds = matched.map((r: { id: string }) => r.id);
    const { rowCount } = await db.query(
      `UPDATE main.spaces
          SET "isPublic" = false,
              "isClaimPending" = false,
              "updatedAt" = NOW()
        WHERE id = ANY($1::uuid[])`,
      [matchedIds],
    );

    console.log(`\nClosed ${rowCount} space(s).`);
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
