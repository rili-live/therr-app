#!/usr/bin/env node
/**
 * One-off prod data repair for the space-claim queue fix (PR #2927) and the
 * `geomCenter` backfill. Idempotent: every statement is guarded so a second run
 * changes nothing.
 *
 *   1. Approved space requests still carrying a requester — before the fix, the only
 *      writer of `requestedByUserId` was `POST /spaces/request-claim` (a consumer's
 *      "Request a Space" suggestion, created under the super admin), and approval
 *      cleared `isClaimPending` without clearing the requester. The corrected admin
 *      queue predicate (`requestedByUserId` set and <> owner) would list every one of
 *      them as a fresh claim, `isClaimAwaitingApproval` would pin a pending banner on
 *      them, and `isUnclaimed` would stay false so no business could claim them.
 *      Release them: clear `requestedByUserId` so they are plain unclaimed inventory —
 *      exactly what `SpacesStore.approveClaim` now does for that shape at approval
 *      time. Ownership is NOT transferred; these were suggestions, not claims.
 *      This is section 6 + the repair block of `_bin/prod-debug/space-claims-audit.sql`.
 *
 *   2. Record a lost claim on an existing space (optional, `--claim <spaceId>:<userId>`).
 *      Claims via `POST /spaces/request-claim/:spaceId` wrote nothing before the fix;
 *      the only record is the admin email. Stamping `requestedByUserId` puts the
 *      space in the admin queue without pulling it off the map.
 *
 *   3. `geomCenter` backfill — `SpacesStore.createSpace` never populated the column,
 *      so every space created through the app since the 2024-05-23 migration was
 *      invisible to proximity search. The migration
 *      `20260919000000_main.spaces.geomCenter_backfill.js` does the same on deploy;
 *      running it here makes those spaces searchable now.
 *
 * Usage:
 *   npx ts-node scripts/import-spaces/repair-space-claims --dry-run
 *   npx ts-node scripts/import-spaces/repair-space-claims
 *   npx ts-node scripts/import-spaces/repair-space-claims --claim aa232e8f-...:24cd464b-...
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Pool } from 'pg';
import { assertDbConnection, createDbPool } from './utils/db';
import { IMPORT_USER_ID as SUPER_ADMIN_ID } from './config';

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface ICliArgs {
  dryRun: boolean;
  claims: { spaceId: string; userId: string }[];
}

function parseArgs(): ICliArgs {
  const args = process.argv.slice(2);
  const claims: ICliArgs['claims'] = [];
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') dryRun = true;
    if (args[i] === '--claim' && args[i + 1]) {
      const [spaceId, userId] = args[i + 1].split(':');
      if (!spaceId || !userId) {
        console.error('--claim expects <spaceId>:<userId>');
        process.exit(1);
      }
      claims.push({ spaceId, userId });
      i++;
    }
    if (args[i] === '--help') {
      console.log('Usage: repair-space-claims [--dry-run] [--claim <spaceId>:<userId>]...');
      process.exit(0);
    }
  }
  return { dryRun, claims };
}

async function main() {
  const args = parseArgs();
  const db: Pool = createDbPool({ target: 'maps' });
  await assertDbConnection(db);

  // ── Preview ──────────────────────────────────────────────────────────────
  const { rows: released } = await db.query(
    `SELECT id, "notificationMsg" AS title, "requestedByUserId" AS requester, "updatedAt"
     FROM main.spaces
     WHERE "isClaimPending" = false AND "requestedByUserId" IS NOT NULL AND "fromUserId" = $1
     ORDER BY "updatedAt" DESC`,
    [SUPER_ADMIN_ID],
  );
  console.log(`\n1. Approved space requests to release back to unclaimed inventory (clear requestedByUserId): ${released.length}`);
  released.forEach((r) => console.log(`   ${r.id}  ${r.title}  (requested by ${r.requester})`));

  for (const claim of args.claims) {
    const { rows: [space] } = await db.query(
      'SELECT id, "notificationMsg", "fromUserId", "requestedByUserId" FROM main.spaces WHERE id = $1',
      [claim.spaceId],
    );
    if (!space) throw new Error(`--claim: space ${claim.spaceId} not found`);
    if (space.requestedByUserId && space.requestedByUserId !== claim.userId) {
      throw new Error(`--claim: ${claim.spaceId} already requested by ${space.requestedByUserId}`);
    }
    if (space.fromUserId !== SUPER_ADMIN_ID) {
      throw new Error(`--claim: ${claim.spaceId} is owned by ${space.fromUserId}, not unclaimed inventory`);
    }
    console.log(`\n2. Record claim: "${space.notificationMsg}" (${space.id}) requested by ${claim.userId}`
      + `${space.requestedByUserId ? ' (already recorded)' : ''}`);
  }

  const { rows: [{ nullCenters }] } = await db.query(
    `SELECT count(*)::int AS "nullCenters" FROM main.spaces
     WHERE "geomCenter" IS NULL AND longitude IS NOT NULL AND latitude IS NOT NULL`,
  );
  console.log(`\n3. Spaces with NULL geomCenter to backfill: ${nullCenters}`);

  if (args.dryRun) {
    console.log('\n--dry-run: no changes made.');
    await db.end();
    return;
  }

  // ── Apply, all-or-nothing ────────────────────────────────────────────────
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const r1 = await client.query(
      `UPDATE main.spaces SET "requestedByUserId" = NULL, "updatedAt" = now()
       WHERE "isClaimPending" = false AND "requestedByUserId" IS NOT NULL AND "fromUserId" = $1`,
      [SUPER_ADMIN_ID],
    );
    if (r1.rowCount !== released.length) {
      throw new Error(`release touched ${r1.rowCount} rows, preview showed ${released.length}`);
    }

    for (const claim of args.claims) {
      const r2 = await client.query(
        `UPDATE main.spaces SET "requestedByUserId" = $2, "updatedAt" = now()
         WHERE id = $1 AND "fromUserId" = $3 AND ("requestedByUserId" IS NULL OR "requestedByUserId" = $2)`,
        [claim.spaceId, claim.userId, SUPER_ADMIN_ID],
      );
      if (r2.rowCount !== 1) throw new Error(`claim ${claim.spaceId}: update touched ${r2.rowCount} rows`);
    }

    const r3 = await client.query(
      `UPDATE main.spaces SET "geomCenter" = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
       WHERE "geomCenter" IS NULL AND longitude IS NOT NULL AND latitude IS NOT NULL`,
    );
    if (r3.rowCount !== nullCenters) {
      throw new Error(`geomCenter backfill touched ${r3.rowCount} rows, preview showed ${nullCenters}`);
    }

    await client.query('COMMIT');
    console.log(`\nApplied: ${r1.rowCount} space requests released, ${args.claims.length} claims recorded, ${r3.rowCount} geomCenter backfills.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // ── Verify ───────────────────────────────────────────────────────────────
  const { rows: [after] } = await db.query(
    `SELECT
       (SELECT count(*)::int FROM main.spaces
        WHERE "isClaimPending" = false AND "requestedByUserId" IS NOT NULL AND "fromUserId" = $1) AS "unreleasedLeft",
       (SELECT count(*)::int FROM main.spaces
        WHERE "geomCenter" IS NULL AND longitude IS NOT NULL AND latitude IS NOT NULL) AS "nullCentersLeft",
       (SELECT count(*)::int FROM main.spaces
        WHERE "isMatureContent" = false
          AND ("isClaimPending" = true OR ("requestedByUserId" IS NOT NULL AND "fromUserId" <> "requestedByUserId"))) AS "adminQueueSize"`,
    [SUPER_ADMIN_ID],
  );
  console.log('\nAfter:', JSON.stringify(after));

  const { rows: queue } = await db.query(
    `SELECT id, "notificationMsg" AS title, "fromUserId" AS owner, "requestedByUserId" AS claimant, "isClaimPending" AS pending
     FROM main.spaces
     WHERE "isMatureContent" = false
       AND ("isClaimPending" = true OR ("requestedByUserId" IS NOT NULL AND "fromUserId" <> "requestedByUserId"))
     ORDER BY "createdAt" DESC`,
  );
  console.log('\nAdmin queue now holds:');
  queue.forEach((r) => console.log(`   ${r.id}  ${r.title}  claimant=${r.claimant}  pending=${r.pending}`));

  await db.end();
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
