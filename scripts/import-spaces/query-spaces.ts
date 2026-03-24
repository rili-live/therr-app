#!/usr/bin/env node
/**
 * Query spaces needing email/website enrichment and output as JSON to stdout.
 * Designed to be called by the /find-space-contacts slash command.
 *
 * Usage:
 *   npx ts-node scripts/import-spaces/query-spaces --mode email --city eugene --limit 5
 *   npx ts-node scripts/import-spaces/query-spaces --mode website --limit 10
 *   npx ts-node scripts/import-spaces/query-spaces --mode both --limit 20
 *
 * Output: JSON array of space objects to stdout. All logging goes to stderr.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Pool } from 'pg';
import { CITIES } from './config';

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function log(msg: string) {
  process.stderr.write(`${msg}\n`);
}

interface ICliArgs {
  city: string;
  category: string;
  mode: 'email' | 'website' | 'both';
  limit: number;
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

  const mode = parsed.mode || 'both';
  if (mode !== 'email' && mode !== 'website' && mode !== 'both') {
    log(`Invalid --mode: "${mode}". Must be "email", "website", or "both".`);
    process.exit(1);
  }

  return {
    city: parsed.city || 'all',
    category: parsed.category || 'all',
    mode: mode as 'email' | 'website' | 'both',
    limit: parsed.limit ? parseInt(parsed.limit, 10) : 10,
  };
}

function createDbPool(): Pool {
  return new Pool({
    host: process.env.DB_HOST_MAIN_WRITE,
    user: process.env.DB_USER_MAIN_WRITE,
    password: process.env.DB_PASSWORD_MAIN_WRITE,
    database: process.env.MAPS_SERVICE_DATABASE,
    port: Number(process.env.DB_PORT_MAIN_WRITE) || 5432,
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });
}

async function querySpaces(db: Pool, args: ICliArgs) {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIdx = 1;

  if (args.mode === 'email') {
    conditions.push('"businessEmail" IS NULL');
    conditions.push(`"websiteUrl" IS NOT NULL`);
    conditions.push(`"websiteUrl" != ''`);
  } else if (args.mode === 'website') {
    conditions.push(`("websiteUrl" IS NULL OR "websiteUrl" = '')`);
  } else {
    // both: spaces missing either email or website
    conditions.push(`("businessEmail" IS NULL OR "websiteUrl" IS NULL OR "websiteUrl" = '')`);
  }

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

  let query = `SELECT id, "notificationMsg", category, "websiteUrl", "businessEmail",
      "phoneNumber", "mediaIds", medias, "fromUserId",
      "addressStreetAddress", "addressLocality", "addressRegion", "postalCode"
    FROM main.spaces
    WHERE ${conditions.join(' AND ')}
    ORDER BY RANDOM()
    LIMIT $${paramIdx}`;
  params.push(args.limit);

  const result = await db.query(query, params);
  return result.rows;
}

async function main() {
  const args = parseArgs();
  log(`Querying spaces: mode=${args.mode}, city=${args.city}, category=${args.category}, limit=${args.limit}`);

  const db = createDbPool();

  try {
    await db.query('SELECT 1');
  } catch (err: any) {
    log(`Database connection failed: ${err.message}`);
    process.exit(1);
  }

  const spaces = await querySpaces(db, args);
  log(`Found ${spaces.length} spaces.`);

  // Output clean JSON to stdout (no secrets, no connection info)
  const output = spaces.map((s) => ({
    id: s.id,
    name: s.notificationMsg,
    category: s.category,
    websiteUrl: s.websiteUrl || null,
    businessEmail: s.businessEmail || null,
    phoneNumber: s.phoneNumber || null,
    hasMedia: !!(s.mediaIds && s.mediaIds !== '') || !!(s.medias && s.medias.length > 0),
    address: {
      street: s.addressStreetAddress || null,
      city: s.addressLocality || null,
      region: s.addressRegion || null,
      postalCode: s.postalCode || null,
    },
  }));

  console.log(JSON.stringify(output, null, 2));

  await db.end();
}

main().catch((err) => {
  log(`Fatal error: ${err.message}`);
  process.exit(1);
});
