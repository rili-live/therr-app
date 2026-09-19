#!/usr/bin/env node
/**
 * Debug a "New Business Space Request" admin email whose space is not showing
 * up in the dashboard's "pending approval" list.
 *
 * Read-only. Answers:
 *   1. Who is the requesting user (email, access levels, brand)?
 *   2. Does a space row exist for this claim (by requestedByUserId, and/or by
 *      title + coordinates)? What are its owner / claimant / pending flags?
 *   3. What does the admin claim queue hold (the predicate from PR #2927), and
 *      is this claim in it? A claim missing here with a matching space in (2)
 *      means the request was lost before it was recorded — see
 *      `approve-space-claim` to record and approve it.
 *   4. What the PRE-#2927 dashboard query returned instead (kept so the output
 *      can be compared against what an admin actually saw before the fix).
 *
 * Usage:
 *   npx ts-node scripts/import-spaces/debug-space-claim --user-id <uuid>
 *   npx ts-node scripts/import-spaces/debug-space-claim --user-id <uuid> --title "Pappadeaux" --lat 35.1412542 --lng -106.5981512
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Pool } from 'pg';
import { assertDbConnection, createDbPool } from './utils/db';

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Mirrors therr-client-web-dashboard/src/constants/LocationDefaults.ts and
// the AdminDashboardOverview pending-spaces search.
const DASHBOARD_DEFAULT_COORDS = { latitude: 30.3076576, longitude: -97.9205478 };
const DASHBOARD_DISTANCE_OVERRIDE = 20037943;
const DASHBOARD_ITEMS_PER_PAGE = 50;

interface ICliArgs {
  userId?: string;
  title?: string;
  lat?: number;
  lng?: number;
}

function parseArgs(): ICliArgs {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      parsed[args[i].replace('--', '')] = args[i + 1];
      i++;
    }
  }
  if (!parsed['user-id'] && !parsed.title) {
    console.error('Usage: --user-id <uuid> [--title <text>] [--lat <n>] [--lng <n>]');
    process.exit(1);
  }
  return {
    userId: parsed['user-id'],
    title: parsed.title,
    lat: parsed.lat ? parseFloat(parsed.lat) : undefined,
    lng: parsed.lng ? parseFloat(parsed.lng) : undefined,
  };
}

const SPACE_COLS = [
  'id', 'fromUserId', 'requestedByUserId', 'isClaimPending', 'isPublic', 'isMatureContent',
  'isModeratorApproved', 'notificationMsg', 'addressReadable',
  'category', 'latitude', 'longitude', 'radius', 'createdAt', 'updatedAt',
].map((c) => `"${c}"`).join(', ');

function printRows(label: string, rows: any[]) {
  console.log(`\n── ${label} (${rows.length}) ──`);
  if (!rows.length) {
    console.log('  (none)');
    return;
  }
  rows.forEach((r) => {
    console.log(JSON.stringify(r, null, 2).split('\n').map((l) => `  ${l}`).join('\n'));
  });
}

async function main() {
  const args = parseArgs();
  const mapsDb: Pool = createDbPool({ target: 'maps' });
  const usersDb: Pool = createDbPool({ target: 'users' });
  await assertDbConnection(mapsDb, console.error);

  // ── 1. The requesting user ────────────────────────────────────────────────
  if (args.userId) {
    try {
      const { rows } = await usersDb.query(
        `SELECT id, email, "userName", "firstName", "lastName", "accessLevels", "isBusinessAccount",
                "brandVariations", "isUnclaimed", "createdAt"
         FROM main.users WHERE id = $1`,
        [args.userId],
      );
      printRows('Requesting user (main.users)', rows);
    } catch (err: any) {
      console.error(`\n(users DB lookup failed: ${err.message} — set USERS_SERVICE_DATABASE in .env to enable)`);
    }
  }

  // ── 2. Spaces tied to this user by requestedByUserId / fromUserId ────────
  if (args.userId) {
    const { rows } = await mapsDb.query(
      `SELECT ${SPACE_COLS} FROM main.spaces
       WHERE "requestedByUserId" = $1 OR "fromUserId" = $1
       ORDER BY "createdAt" DESC LIMIT 20`,
      [args.userId],
    );
    printRows('Spaces where requestedByUserId or fromUserId = user', rows);
  }

  // ── 3. Spaces matching the title / coordinates from the email ────────────
  if (args.title || (args.lat != null && args.lng != null)) {
    const conds: string[] = [];
    const params: any[] = [];
    if (args.title) {
      params.push(`%${args.title}%`);
      conds.push(`"notificationMsg" ILIKE $${params.length}`);
    }
    if (args.lat != null && args.lng != null) {
      params.push(args.lng, args.lat);
      conds.push(`ST_DWithin("geomCenter"::geography, ST_MakePoint($${params.length - 1}, $${params.length})::geography, 200)`);
    }
    const { rows } = await mapsDb.query(
      `SELECT ${SPACE_COLS} FROM main.spaces WHERE ${conds.join(' OR ')} ORDER BY "createdAt" DESC LIMIT 20`,
      params,
    );
    printRows('Spaces matching title OR within 200m of email coordinates', rows);
  }

  // ── 4. The admin claim queue (SpacesStore.searchSpaces, filterBy=isClaimPending) ──
  // Two shapes: a brand-new space flagged isClaimPending, or a claim on an existing
  // space that only stamps requestedByUserId and stays live until approved.
  const { rows: pending } = await mapsDb.query(
    `SELECT ${SPACE_COLS} FROM main.spaces
     WHERE "isMatureContent" = false
       AND ("isClaimPending" = true OR ("requestedByUserId" IS NOT NULL AND "fromUserId" <> "requestedByUserId"))
     ORDER BY "createdAt" DESC LIMIT 50`,
  );
  printRows('Admin claim queue (what the fixed dashboard lists)', pending);
  if (args.userId) {
    const mine = pending.filter((p) => p.requestedByUserId === args.userId);
    console.log(`  → claims in the queue from user ${args.userId}: ${mine.length}`);
  }

  // ── 5. What the PRE-#2927 dashboard got back ─────────────────────────────
  // Reproduces the old SpacesStore.searchSpaces for filterBy=isClaimPending, query=true,
  // includePublicResults=true (query !== 'me' && query !== 'user'):
  //   WHERE ST_DWithin(geomCenter, Austin, 20037943)
  //     AND isMatureContent = false
  //     AND (isClaimPending = true OR isPublic = true)
  //   ORDER BY distance ASC LIMIT 50
  const { rows: dashboardRows } = await mapsDb.query(
    `SELECT id, "notificationMsg", "isClaimPending", "isPublic", "isMatureContent", "requestedByUserId",
            ROUND((ST_Distance("geomCenter"::geography, ST_MakePoint($1, $2)::geography) / 1000)::numeric, 1) AS km_from_austin
     FROM main.spaces
     WHERE ST_DWithin("geomCenter"::geography, ST_MakePoint($1, $2)::geography, $3)
       AND "isMatureContent" = false
       AND ("isClaimPending" = true OR "isPublic" = true)
     ORDER BY ST_Distance("geomCenter"::geography, ST_MakePoint($1, $2)::geography) ASC
     LIMIT $4`,
    [DASHBOARD_DEFAULT_COORDS.longitude, DASHBOARD_DEFAULT_COORDS.latitude, DASHBOARD_DISTANCE_OVERRIDE, DASHBOARD_ITEMS_PER_PAGE],
  );
  const pendingInDashboard = dashboardRows.filter((r) => r.isClaimPending);
  console.log('\n── PRE-#2927 dashboard pending-list query reproduction ──');
  console.log(`  rows returned: ${dashboardRows.length}`);
  console.log(`  of which isClaimPending=true: ${pendingInDashboard.length}`);
  console.log(`  of which are merely isPublic=true (noise): ${dashboardRows.length - pendingInDashboard.length}`);
  pending.forEach((p) => {
    const idx = dashboardRows.findIndex((r) => r.id === p.id);
    console.log(`  queued "${p.notificationMsg}" (${p.id}): ${idx === -1 ? 'NOT in old dashboard results' : `position ${idx + 1}`}`);
  });

  // Count of public spaces closer to Austin than each pending one — the number of
  // non-pending rows that crowd it out of the 50-row page.
  for (const p of pending) {
    const { rows: [{ count }] } = await mapsDb.query(
      `SELECT COUNT(*)::int AS count FROM main.spaces
       WHERE "isMatureContent" = false AND "isPublic" = true AND "isClaimPending" = false
         AND ST_Distance("geomCenter"::geography, ST_MakePoint($1, $2)::geography)
           < (SELECT ST_Distance("geomCenter"::geography, ST_MakePoint($1, $2)::geography) FROM main.spaces WHERE id = $3)`,
      [DASHBOARD_DEFAULT_COORDS.longitude, DASHBOARD_DEFAULT_COORDS.latitude, p.id],
    );
    console.log(`  public non-pending spaces closer to Austin than "${p.notificationMsg}": ${count}`);
  }

  await mapsDb.end();
  await usersDb.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
