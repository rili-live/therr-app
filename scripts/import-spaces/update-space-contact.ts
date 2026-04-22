#!/usr/bin/env node
/**
 * Update a space's contact info (email, website) and optionally source an image.
 * Designed to be called by the /find-space-contacts slash command.
 *
 * Usage:
 *   npx ts-node scripts/import-spaces/update-space-contact \
 *     --id <space-uuid> \
 *     --email "info@business.com" \
 *     --website "https://business.com" \
 *     --source-image \
 *     --closed
 *
 * All arguments are optional except --id. Only provided fields are updated.
 * Output: JSON result to stdout. Logging goes to stderr.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { IMPORT_USER_ID } from './config';
import { createDbPool } from './utils/db';
import { sourceImageForSpace } from './utils/sourceImage';

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function log(msg: string) {
  process.stderr.write(`${msg}\n`);
}

interface ICliArgs {
  id: string;
  email: string | null;
  website: string | null;
  sourceImage: boolean;
  closed: boolean;
  userId: string;
}

function parseArgs(): ICliArgs {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source-image') {
      parsed.sourceImage = 'true';
    } else if (args[i] === '--closed') {
      parsed.closed = 'true';
    } else if (args[i].startsWith('--') && i + 1 < args.length) {
      parsed[args[i].replace('--', '')] = args[i + 1];
      i++;
    }
  }

  if (!parsed.id) {
    log('Error: --id <space-uuid> is required.');
    process.exit(1);
  }

  if (!parsed.email && !parsed.website && parsed.sourceImage !== 'true' && parsed.closed !== 'true') {
    log('Error: At least one of --email, --website, --source-image, or --closed must be provided.');
    process.exit(1);
  }

  return {
    id: parsed.id,
    email: parsed.email || null,
    website: parsed.website || null,
    sourceImage: parsed.sourceImage === 'true',
    closed: parsed.closed === 'true',
    userId: parsed['user-id'] || IMPORT_USER_ID,
  };
}

interface IUpdateResult {
  spaceId: string;
  emailUpdated: boolean;
  websiteUpdated: boolean;
  imageSourced: boolean;
  imagePath: string | null;
  closedMarked: boolean;
}

async function main() {
  const args = parseArgs();
  const db = createDbPool({ max: 3 });

  try {
    await db.query('SELECT 1');
  } catch (err: any) {
    log(`Database connection failed: ${err.message}`);
    await db.end();
    process.exit(1);
  }

  try {
    const result: IUpdateResult = {
      spaceId: args.id,
      emailUpdated: false,
      websiteUpdated: false,
      imageSourced: false,
      imagePath: null,
      closedMarked: false,
    };

    // Verify space exists and get current data
    const spaceResult = await db.query(
      `SELECT id, "notificationMsg", "fromUserId", "websiteUrl", "businessEmail", "mediaIds", medias
       FROM main.spaces WHERE id = $1`,
      [args.id],
    );

    if (spaceResult.rows.length === 0) {
      log(`Error: Space ${args.id} not found.`);
      console.log(JSON.stringify({ error: 'Space not found', spaceId: args.id }));
      process.exit(1);
    }

    const space = spaceResult.rows[0];

    // Update email
    if (args.email && !space.businessEmail) {
      await db.query(
        `UPDATE main.spaces SET "businessEmail" = $1, "updatedAt" = NOW() WHERE id = $2`,
        [args.email, args.id],
      );
      result.emailUpdated = true;
      log(`Updated email: ${args.email}`);
    }

    // Update website
    if (args.website && (!space.websiteUrl || space.websiteUrl === '')) {
      await db.query(
        `UPDATE main.spaces SET "websiteUrl" = $1, "updatedAt" = NOW() WHERE id = $2`,
        [args.website, args.id],
      );
      result.websiteUpdated = true;
      log(`Updated website: ${args.website}`);
    }

    // Mark as closed/defunct. Also clears any lingering pending-claim flag so
    // the space drops out of the admin approval queue — a closed business
    // should never appear as "awaiting approval".
    if (args.closed) {
      await db.query(
        `UPDATE main.spaces
            SET "isPublic" = false,
                "isClaimPending" = false,
                "updatedAt" = NOW()
          WHERE id = $1`,
        [args.id],
      );
      result.closedMarked = true;
      log(`Marked space as closed (isPublic=false, isClaimPending=false): ${args.id}`);
    }

    // Source image
    if (args.sourceImage) {
      const websiteUrl = args.website || space.websiteUrl;

      if (!websiteUrl) {
        log('Skipping image sourcing: no website URL available.');
      } else {
        log(`Sourcing image from: ${websiteUrl}`);
        const userId = space.fromUserId || args.userId;
        const outcome = await sourceImageForSpace(
          db,
          { id: args.id, notificationMsg: space.notificationMsg, mediaIds: space.mediaIds, medias: space.medias },
          websiteUrl,
          userId,
          { log },
        );

        switch (outcome.status) {
          case 'uploaded':
            result.imageSourced = true;
            result.imagePath = outcome.imagePath;
            break;
          case 'skipped-has-media':
            log('Skipping image sourcing: space already has media.');
            break;
          case 'no-candidates':
          case 'no-valid-image':
            log('No valid image found on website.');
            break;
          default:
            break;
        }
      }
    }

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  log(`Fatal error: ${err.message}`);
  process.exit(1);
});
