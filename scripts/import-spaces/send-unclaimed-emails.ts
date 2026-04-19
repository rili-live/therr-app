#!/usr/bin/env node
/**
 * CLI tool to send outreach emails to unclaimed business listings.
 *
 * Queries the maps-service DB for spaces with a known businessEmail that have
 * NOT yet received an unclaimed-space outreach email (checked via userMetrics
 * in the users-service DB).  For each eligible space it sends a CAN-SPAM
 * compliant marketing email via AWS SES inviting the owner to claim their
 * Therr listing.
 *
 * Start slowly (50/day) to warm up SES sender reputation.  Monitor your SES
 * dashboard for bounce rates; stay under 5% to avoid reputation damage.
 *
 * Usage:
 *   npx ts-node scripts/import-spaces/send-unclaimed-emails [options]
 *
 * Requires .env at project root or scripts/import-spaces/.env with:
 *   DB_HOST_MAIN_WRITE, DB_USER_MAIN_WRITE, DB_PASSWORD_MAIN_WRITE,
 *   MAPS_SERVICE_DATABASE, USERS_SERVICE_DATABASE,
 *   AWS_SES_REGION, AWS_SES_ACCESS_KEY_ID, AWS_SES_ACCESS_KEY_SECRET,
 *   AWS_SES_FROM_EMAIL
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Pool } from 'pg';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { CITIES } from './config';
import { createDbPool } from './utils/db';
import { withRetry, isTransientNetworkError } from './utils/withRetry';

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ── Constants ─────────────────────────────────────────────────────────────────
const METRIC_NAME = 'space.marketing.unclaimedEmailSent';
const METRIC_VALUE_TYPE = 'NUMBER';
const THERR_HOST = process.env.THERR_HOST || 'https://therr.com';
const FROM_EMAIL = process.env.AWS_SES_FROM_EMAIL || 'info@therr.com';
const FROM_EMAIL_TITLE = 'Therr App';

// SUPER_ADMIN_ID mirrors therr-services/*/src/constants/index.ts. Imported
// spaces are inserted with fromUserId = this value; the handler treats such
// spaces as "unclaimed" when no user has requested to claim them.
const SUPER_ADMIN_ID_BY_ENV: Record<string, string> = {
  development: '04e65180-3cff-48b1-988f-4b6e0ab25def',
  stage: '04e65180-3cff-48b1-988f-4b6e0ab25def',
  production: '568bf5d2-8595-4fd6-95da-32cc318618d3',
};
const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_ID
  || SUPER_ADMIN_ID_BY_ENV[process.env.NODE_ENV || 'development']
  || SUPER_ADMIN_ID_BY_ENV.development;

// ── Help ──────────────────────────────────────────────────────────────────────
function printHelp() {
  const cityList = Object.keys(CITIES).join(', ');
  console.log(`
Send Unclaimed Space Emails — Outreach to business owners to claim their listing.

Usage:
  npx ts-node scripts/import-spaces/send-unclaimed-emails [options]

Options:
  --city <name>    Filter by city (default: all)
                   Available: ${cityList}, all
  --category <n>   Filter by Therr category string (default: all)
                   e.g. "categories.restaurant/food"
  --limit <n>      Max emails to send per run (default: 50)
  --delay <ms>     Delay between sends in ms (default: 500)
  --dry-run        Query and log without sending any emails or writing metrics
  --help, -h       Show this help message

Notes:
  - Deduplication is enforced: spaces that already received an email are skipped.
  - Blacklisted / bounced emails are skipped automatically.
  - Start with --limit 50 to warm up SES sending reputation.

Examples:
  npx ts-node scripts/import-spaces/send-unclaimed-emails --dry-run --limit 5
  npx ts-node scripts/import-spaces/send-unclaimed-emails --city chicago --limit 50
  npx ts-node scripts/import-spaces/send-unclaimed-emails --limit 50
`);
}

// ── CLI args ──────────────────────────────────────────────────────────────────
interface ICliArgs {
  city: string;
  category: string;
  limit: number;
  delay: number;
  dryRun: boolean;
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

  return {
    city: parsed.city || 'all',
    category: parsed.category || 'all',
    limit: parsed.limit ? parseInt(parsed.limit, 10) : 50,
    delay: parsed.delay ? parseInt(parsed.delay, 10) : 500,
    dryRun: parsed.dryRun === 'true',
  };
}

// ── Space query ───────────────────────────────────────────────────────────────
interface ISpaceRow {
  id: string;
  notificationMsg: string;
  businessEmail: string;
  addressLocality: string;
  addressRegion: string;
  category: string;
}

async function queryUnclaimedSpaces(mapsPool: Pool, args: ICliArgs): Promise<ISpaceRow[]> {
  // Replicates handlers/spaces.ts:360's computed `isUnclaimed` rule:
  // fromUserId === SUPER_ADMIN_ID && !requestedByUserId. Also requires the
  // space is public and has no pending claim so we only email live, unowned
  // listings.
  const params: (string | number)[] = [SUPER_ADMIN_ID];
  const conditions = [
    `"businessEmail" IS NOT NULL`,
    `"businessEmail" != ''`,
    `"fromUserId" = $1`,
    `"requestedByUserId" IS NULL`,
    `"isClaimPending" = false`,
    `"isPublic" = true`,
  ];
  let paramIdx = 2;

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

  const query = `SELECT id, "notificationMsg", "businessEmail", "addressLocality", "addressRegion", category
    FROM main.spaces
    WHERE ${conditions.join(' AND ')}
    ORDER BY RANDOM()
    LIMIT $${paramIdx}`;
  params.push(args.limit);

  const result = await mapsPool.query(query, params);
  return result.rows;
}

// ── Dedup check ───────────────────────────────────────────────────────────────
async function hasAlreadySentEmail(usersPool: Pool, spaceId: string): Promise<boolean> {
  const result = await usersPool.query(
    `SELECT id FROM main."userMetrics"
     WHERE name = $1
       AND dimensions->>'spaceId' = $2
     LIMIT 1`,
    [METRIC_NAME, spaceId],
  );
  return result.rows.length > 0;
}

// ── Blacklist check ───────────────────────────────────────────────────────────
async function isEmailBlacklisted(usersPool: Pool, email: string): Promise<boolean> {
  const result = await usersPool.query(
    `SELECT id FROM main."blacklistedEmails" WHERE email ILIKE $1 LIMIT 1`,
    [email],
  ).catch(() => ({ rows: [] })); // table may not exist in dev
  return result.rows.length > 0;
}

// ── Email HTML builder ────────────────────────────────────────────────────────
function buildEmailHtml(spaceName: string, claimUrl: string): string {
  const accentColor = '#1C7F8A';
  const escapedName = spaceName.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Business Is Getting Noticed</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <img src="https://therr.com/assets/images/therr-splash-logo-200.png"
           alt="Therr App" width="120" style="display:block;margin:0 auto 16px;" />
      <h1 style="margin:0;font-size:22px;color:#1f2937;">Your Business Is Getting Noticed</h1>
    </div>
    <p style="color:#374151;font-size:16px;line-height:1.6;">Hello, <strong>${escapedName}</strong>!</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;">
      People in your area are discovering <strong>${escapedName}</strong> on Therr — and they're sharing
      what's happening at your business in real time. Customers are posting about their experiences,
      flagging deals, and letting others know when things are busy or when the vibe is great.
      Your business already has a listing. The question is: who's controlling the story?
    </p>
    <p style="color:#374151;font-size:16px;line-height:1.6;">
      When you claim your page, you unlock tools Google can't offer: see real-time customer reports
      about your business, get paired with complementary local spots that send you foot traffic, and
      reward customers who spread the word. This isn't just a listing — it's a living,
      community-powered presence.
    </p>
    <p style="color:#374151;font-size:16px;line-height:1.6;font-weight:600;">
      It only takes 60 seconds to get started.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${claimUrl}"
         style="display:inline-block;background:${accentColor};color:#ffffff;text-decoration:none;
                padding:14px 28px;border-radius:6px;font-size:16px;font-weight:600;">
        See Your Business Page
      </a>
    </div>
    <p style="color:#6b7280;font-size:14px;line-height:1.6;">
      Already have an account? Simply log in and claim your space from the business page.
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
    <p style="color:#9ca3af;font-size:12px;text-align:center;line-height:1.6;">
      Therr Inc. &bull; <a href="https://therr.com" style="color:#9ca3af;">therr.com</a><br/>
      You are receiving this because your business has a listing on Therr.<br/>
      <a href="https://therr.com/emails/unsubscribe" style="color:#9ca3af;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>`;
}

// ── SES send ──────────────────────────────────────────────────────────────────
function createSesClient(): SESv2Client {
  return new SESv2Client({
    region: process.env.AWS_SES_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SES_ACCESS_KEY_SECRET || '',
    },
  });
}

async function sendEmail(
  ses: SESv2Client,
  toAddress: string,
  spaceName: string,
  claimUrl: string,
): Promise<void> {
  const subject = `People are searching for ${spaceName}`;
  const html = buildEmailHtml(spaceName, claimUrl);

  const command = new SendEmailCommand({
    Destination: { ToAddresses: [toAddress] },
    FromEmailAddress: `"${FROM_EMAIL_TITLE}" <${FROM_EMAIL}>`,
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: html, Charset: 'UTF-8' },
        },
      },
    },
  });

  await withRetry(() => ses.send(command), {
    retries: 2,
    baseDelayMs: 2000,
    shouldRetry: isTransientNetworkError,
    label: 'ses.send',
    log: console.warn,
  });
}

// ── Metric write ──────────────────────────────────────────────────────────────
async function logEmailSentMetric(usersPool: Pool, spaceId: string, businessEmail: string): Promise<void> {
  await usersPool.query(
    `INSERT INTO main."userMetrics" (name, "userId", value, "valueType", dimensions, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), NOW())
     ON CONFLICT DO NOTHING`,
    [
      METRIC_NAME,
      '', // system-level metric, no user context
      '1',
      METRIC_VALUE_TYPE,
      JSON.stringify({ spaceId, businessEmail }),
    ],
  );
}

// ── Sleep ─────────────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

// ── Counters ──────────────────────────────────────────────────────────────────
interface ICounters {
  sent: number;
  skippedAlreadySent: number;
  skippedBlacklisted: number;
  errors: number;
  dryRun: number;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();

  console.log('\nSend Unclaimed Space Emails');
  console.log(`  City:     ${args.city}`);
  console.log(`  Category: ${args.category}`);
  console.log(`  Limit:    ${args.limit}`);
  console.log(`  Delay:    ${args.delay}ms`);
  console.log(`  Dry run:  ${args.dryRun}`);
  console.log('');

  if (!args.dryRun && (!process.env.AWS_SES_ACCESS_KEY_ID || !process.env.AWS_SES_ACCESS_KEY_SECRET)) {
    console.error('ERROR: AWS_SES_ACCESS_KEY_ID and AWS_SES_ACCESS_KEY_SECRET must be set.');
    process.exit(1);
  }

  const mapsPool = createDbPool({ target: 'maps', max: 3 });
  const usersPool = createDbPool({ target: 'users', max: 3 });
  const ses = createSesClient();

  // Test DB connections
  try {
    await Promise.all([mapsPool.query('SELECT 1'), usersPool.query('SELECT 1')]);
    console.log('Database connections established.\n');
  } catch (err: any) {
    console.error(`Database connection failed: ${err.message}`);
    process.exit(1);
  }

  const spaces = await queryUnclaimedSpaces(mapsPool, args);
  console.log(`Found ${spaces.length} candidate space(s) with business emails.\n`);

  const counters: ICounters = {
    sent: 0,
    skippedAlreadySent: 0,
    skippedBlacklisted: 0,
    errors: 0,
    dryRun: 0,
  };

  for (let i = 0; i < spaces.length; i++) {
    const space = spaces[i];
    const progress = `[${i + 1}/${spaces.length}]`;
    const claimUrl = `${THERR_HOST}/spaces/${space.id}?claim=true`;

    try {
      // Dedup check
      const alreadySent = await hasAlreadySentEmail(usersPool, space.id);
      if (alreadySent) {
        console.log(`${progress} SKIP (already sent): ${space.notificationMsg} <${space.businessEmail}>`);
        counters.skippedAlreadySent++;
        continue;
      }

      // Blacklist check
      const blacklisted = await isEmailBlacklisted(usersPool, space.businessEmail);
      if (blacklisted) {
        console.log(`${progress} SKIP (blacklisted): ${space.notificationMsg} <${space.businessEmail}>`);
        counters.skippedBlacklisted++;
        continue;
      }

      if (args.dryRun) {
        console.log(`${progress} DRY RUN: would send to ${space.notificationMsg} <${space.businessEmail}>`);
        console.log(`         Claim URL: ${claimUrl}`);
        counters.dryRun++;
      } else {
        await sendEmail(ses, space.businessEmail, space.notificationMsg, claimUrl);
        await logEmailSentMetric(usersPool, space.id, space.businessEmail);
        console.log(`${progress} SENT: ${space.notificationMsg} <${space.businessEmail}>`);
        counters.sent++;
      }
    } catch (err: any) {
      console.error(`${progress} ERROR: ${space.notificationMsg} — ${err.message}`);
      counters.errors++;
    }

    if (i < spaces.length - 1) await sleep(args.delay);
  }

  // Summary
  console.log('\n══════════════════════════════════════');
  if (args.dryRun) {
    console.log(`Would send:              ${counters.dryRun}`);
  } else {
    console.log(`Emails sent:             ${counters.sent}`);
  }
  console.log(`Skipped (already sent):  ${counters.skippedAlreadySent}`);
  console.log(`Skipped (blacklisted):   ${counters.skippedBlacklisted}`);
  console.log(`Errors:                  ${counters.errors}`);
  console.log('══════════════════════════════════════\n');

  await Promise.all([mapsPool.end(), usersPool.end()]);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
