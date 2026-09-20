#!/usr/bin/env node
/**
 * Approve a business-space claim from the CLI and trigger the
 * "Approved: Business Space Request" email to the requesting user.
 *
 * Background: before PR #2927, `POST /maps-service/spaces/request-claim/:spaceId`
 * (claiming an EXISTING space) sent the admin email but its DB update failed
 * silently, so the only record of the claim is that email. This script records
 * the claim the way the fixed handler does, then runs the real approval path so
 * the email comes from the same code the dashboard uses.
 *
 * Steps:
 *   1. Record the claim: set requestedByUserId = <user>. The pending flag is left
 *      alone on purpose — a claim on a space already on the map must not pull the
 *      business off the map while it is reviewed (see SpacesStore.searchSpaces).
 *   2. Call the production API `POST /maps-service/spaces/request-approve/:spaceId`
 *      as the super admin, which emails the requester and (with #2927 deployed)
 *      hands ownership to them via `SpacesStore.approveClaim`.
 *   3. Verify the row. If the running API predates #2927 it will not have moved
 *      `fromUserId`; the script then performs that transfer directly so the
 *      business can see the space under /spaces.
 *
 * Auth for step 2 (one of):
 *   THERR_ADMIN_TOKEN=<jwt>                     — paste from a logged-in dashboard session
 *   THERR_ADMIN_USERNAME=... THERR_ADMIN_PASSWORD=...  — script logs in for you
 * Put them in scripts/import-spaces/.env or export them in the shell.
 *
 * Usage:
 *   npx ts-node scripts/import-spaces/approve-space-claim --space-id <uuid> --user-id <uuid> --dry-run
 *   npx ts-node scripts/import-spaces/approve-space-claim --space-id <uuid> --user-id <uuid>
 *   npx ts-node scripts/import-spaces/approve-space-claim --space-id <uuid> --user-id <uuid> --repair-only
 *   npx ts-node scripts/import-spaces/approve-space-claim --space-id <uuid> --user-id <uuid> --yes
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as readline from 'readline';
import axios from 'axios';
import { Pool } from 'pg';
import { assertDbConnection, createDbPool } from './utils/db';
import { IMPORT_USER_ID as SUPER_ADMIN_ID } from './config';

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DEFAULT_API_BASE = 'https://api.therr.com/v1';
const DASHBOARD_BRAND_VARIATION = 'dashboard-therr';

interface ICliArgs {
  spaceId: string;
  userId: string;
  dryRun: boolean;
  yes: boolean;
  repairOnly: boolean;
  apiBase: string;
}

function printHelp() {
  console.log(`
Approve Space Claim — repair a claim row and trigger the approval email.

Options:
  --space-id <uuid>   Space to approve (required)
  --user-id <uuid>    User who requested the claim (required)
  --dry-run           Show what would change; no writes, no API call
  --repair-only       Only fix the DB row (step 1); skip the approval API call
  --yes               Skip the confirmation prompt
  --api-base <url>    Gateway base (default: ${DEFAULT_API_BASE})
  --help              Show this help

Env (for the approval API call):
  THERR_ADMIN_TOKEN                          super-admin JWT, or
  THERR_ADMIN_USERNAME + THERR_ADMIN_PASSWORD super-admin login (script signs in)
`);
}

function parseArgs(): ICliArgs {
  const args = process.argv.slice(2);
  const parsed: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) continue;
    const key = a.replace('--', '');
    const next = args[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      parsed[key] = next;
      i++;
    } else {
      parsed[key] = true;
    }
  }
  if (parsed.help) {
    printHelp();
    process.exit(0);
  }
  if (!parsed['space-id'] || !parsed['user-id']) {
    printHelp();
    process.exit(1);
  }
  return {
    spaceId: String(parsed['space-id']),
    userId: String(parsed['user-id']),
    dryRun: !!parsed['dry-run'],
    yes: !!parsed.yes,
    repairOnly: !!parsed['repair-only'],
    apiBase: parsed['api-base'] ? String(parsed['api-base']) : DEFAULT_API_BASE,
  };
}

function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question} [y/N] `, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

async function getAdminSession(apiBase: string): Promise<{ token: string; userId: string }> {
  if (process.env.THERR_ADMIN_TOKEN) {
    // Decode the JWT payload (no verification — we only need the user id for x-userid)
    const payload = JSON.parse(Buffer.from(process.env.THERR_ADMIN_TOKEN.split('.')[1], 'base64url').toString('utf8'));
    if (!payload?.id) throw new Error('THERR_ADMIN_TOKEN payload has no `id`');
    return { token: process.env.THERR_ADMIN_TOKEN, userId: payload.id };
  }
  const userName = process.env.THERR_ADMIN_USERNAME;
  const password = process.env.THERR_ADMIN_PASSWORD;
  if (!userName || !password) {
    throw new Error('Set THERR_ADMIN_TOKEN, or THERR_ADMIN_USERNAME + THERR_ADMIN_PASSWORD, to call the approval API');
  }
  const { data } = await axios.post(`${apiBase}/users-service/auth`, {
    userName,
    password,
    rememberMe: false,
  }, {
    headers: {
      'x-platform': 'desktop',
      'x-brand-variation': DASHBOARD_BRAND_VARIATION,
    },
    timeout: 20000,
  });
  if (!data?.idToken || !data?.id) throw new Error('Login succeeded but response had no idToken/id');
  if (!(data.accessLevels || []).includes('user.super-admin')) {
    throw new Error(`Logged in as ${data.userName} but account lacks user.super-admin`);
  }
  return { token: data.idToken, userId: data.id };
}

async function main() {
  const args = parseArgs();
  const mapsDb: Pool = createDbPool({ target: 'maps' });
  const usersDb: Pool = createDbPool({ target: 'users' });
  await assertDbConnection(mapsDb);

  // ── Load current state ───────────────────────────────────────────────────
  const { rows: [space] } = await mapsDb.query(
    `SELECT id, "fromUserId", "requestedByUserId", "isClaimPending", "isPublic", "isMatureContent",
            "notificationMsg", "addressReadable", "updatedAt"
     FROM main.spaces WHERE id = $1`,
    [args.spaceId],
  );
  if (!space) throw new Error(`Space ${args.spaceId} not found`);

  const { rows: [user] } = await usersDb.query(
    'SELECT id, email, "userName", "isBusinessAccount", "accessLevels" FROM main.users WHERE id = $1',
    [args.userId],
  );
  if (!user) throw new Error(`User ${args.userId} not found`);

  console.log('\nSpace:', JSON.stringify(space, null, 2));
  console.log('Requester:', JSON.stringify(user, null, 2));

  if (space.fromUserId === args.userId) {
    console.log('\nUser already owns this space (fromUserId matches). Nothing to do.');
    await mapsDb.end(); await usersDb.end();
    return;
  }
  if (space.requestedByUserId && space.requestedByUserId !== args.userId) {
    throw new Error(`Space is already requested by a different user (${space.requestedByUserId}); refusing to overwrite`);
  }
  // Same rule as the claimSpace handler and repair-space-claims: only unclaimed inventory
  // (owned by the super admin) can be claimed. Approving would otherwise take the space
  // away from the business that owns it.
  if (space.fromUserId !== SUPER_ADMIN_ID) {
    throw new Error(`Space is owned by ${space.fromUserId}, not unclaimed inventory; refusing to reassign it`);
  }

  // ── Step 1: repair ───────────────────────────────────────────────────────
  const needsRepair = space.requestedByUserId !== args.userId;
  console.log(`\nStep 1 — record claim: ${needsRepair
    ? `set requestedByUserId=${args.userId}`
    : 'already recorded, nothing to change'}`);
  const approveUrl = `${args.apiBase}/maps-service/spaces/request-approve/${args.spaceId}`;
  console.log(`Step 2 — ${args.repairOnly ? 'SKIPPED (--repair-only)' : `POST ${approveUrl} as super admin`}`);
  console.log(`         → emails ${user.email} ("Approved: Business Space Request"), clears isClaimPending, transfers ownership`);

  if (args.dryRun) {
    console.log('\n--dry-run: no changes made.');
    await mapsDb.end(); await usersDb.end();
    return;
  }
  if (!args.yes && !(await confirm('\nProceed?'))) {
    console.log('Aborted.');
    await mapsDb.end(); await usersDb.end();
    return;
  }

  if (needsRepair) {
    const { rowCount } = await mapsDb.query(
      `UPDATE main.spaces SET "requestedByUserId" = $2, "updatedAt" = NOW()
       WHERE id = $1 AND ("requestedByUserId" IS NULL OR "requestedByUserId" = $2)`,
      [args.spaceId, args.userId],
    );
    if (rowCount !== 1) throw new Error(`Repair updated ${rowCount} rows (expected 1)`);
    console.log('\nRecorded: requestedByUserId set. The space now appears in the admin claim queue.');
  }

  if (args.repairOnly) {
    console.log('Done (repair only). Approve via the API or the dashboard when ready.');
    await mapsDb.end(); await usersDb.end();
    return;
  }

  // ── Step 2: approve through the real API so the email fires ──────────────
  const session = await getAdminSession(args.apiBase);
  const { data } = await axios.post(approveUrl, {}, {
    headers: {
      authorization: `Bearer ${session.token}`,
      'x-userid': session.userId,
      'x-platform': 'desktop',
      'x-brand-variation': DASHBOARD_BRAND_VARIATION,
      'x-localecode': 'en-us',
    },
    timeout: 30000,
  });
  console.log('\nApproval API response:', JSON.stringify({ updated: data?.updated, isClaimPending: data?.space?.isClaimPending }, null, 2));
  if (data?.updated !== true) {
    throw new Error('API reported updated=false — the email may have been sent but the DB flag was not flipped. Check maps-service logs.');
  }

  // ── Step 3: verify (and transfer ownership if the deployed API predates #2927) ──
  let { rows: [after] } = await mapsDb.query(
    'SELECT id, "fromUserId", "requestedByUserId", "isClaimPending", "updatedAt" FROM main.spaces WHERE id = $1',
    [args.spaceId],
  );
  if (after.fromUserId !== args.userId && after.fromUserId === space.fromUserId) {
    console.log('\nAPI approved but did not transfer ownership (pre-#2927 build) — transferring directly.');
    ({ rows: [after] } = await mapsDb.query(
      `UPDATE main.spaces SET "fromUserId" = $2, "isClaimPending" = false, "updatedAt" = NOW()
       WHERE id = $1 AND "fromUserId" = $3 AND "requestedByUserId" = $2
       RETURNING id, "fromUserId", "requestedByUserId", "isClaimPending", "updatedAt"`,
      [args.spaceId, args.userId, space.fromUserId],
    ));
  }
  console.log('\nAfter:', JSON.stringify(after, null, 2));
  const ok = after.fromUserId === args.userId && after.isClaimPending === false;
  console.log(ok
    ? `\n✅ Approved. ${user.email} was sent the approval email.`
    : '\n⚠️  Row is not in the expected approved state — inspect above.');

  await mapsDb.end();
  await usersDb.end();
}

main().catch((err) => {
  const detail = err?.response?.data ? ` ${JSON.stringify(err.response.data)}` : '';
  console.error(`\nError: ${err.message}${detail}`);
  process.exit(1);
});
