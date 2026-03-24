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
 *     --source-image
 *
 * All arguments are optional except --id. Only provided fields are updated.
 * Output: JSON result to stdout. Logging goes to stderr.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Pool } from 'pg';
import { IMPORT_USER_ID } from './config';
import { crawlForImages } from './sources/crawl';
import { downloadAndValidateImage } from './utils/imageValidation';
import { uploadImage } from './utils/gcs';

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
  userId: string;
}

function parseArgs(): ICliArgs {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source-image') {
      parsed.sourceImage = 'true';
    } else if (args[i].startsWith('--') && i + 1 < args.length) {
      parsed[args[i].replace('--', '')] = args[i + 1];
      i++;
    }
  }

  if (!parsed.id) {
    log('Error: --id <space-uuid> is required.');
    process.exit(1);
  }

  if (!parsed.email && !parsed.website && parsed.sourceImage !== 'true') {
    log('Error: At least one of --email, --website, or --source-image must be provided.');
    process.exit(1);
  }

  return {
    id: parsed.id,
    email: parsed.email || null,
    website: parsed.website || null,
    sourceImage: parsed.sourceImage === 'true',
    userId: parsed['user-id'] || IMPORT_USER_ID,
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

interface IUpdateResult {
  spaceId: string;
  emailUpdated: boolean;
  websiteUpdated: boolean;
  imageSourced: boolean;
  imagePath: string | null;
}

async function main() {
  const args = parseArgs();
  const db = createDbPool();

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

    // Source image
    if (args.sourceImage) {
      const websiteUrl = args.website || space.websiteUrl;
      const hasMedia = (space.mediaIds && space.mediaIds !== '') || (space.medias && space.medias.length > 0);

      if (!websiteUrl) {
        log('Skipping image sourcing: no website URL available.');
      } else if (hasMedia) {
        log('Skipping image sourcing: space already has media.');
      } else {
        log(`Sourcing image from: ${websiteUrl}`);
        const candidates = await crawlForImages(websiteUrl);

        for (const candidate of candidates) {
          const validImage = await downloadAndValidateImage(candidate.imageUrl);
          if (!validImage) continue;

          const userId = space.fromUserId || args.userId;
          const storagePath = await uploadImage(userId, args.id, validImage.buffer, validImage.contentType);

          // Insert media record
          const mediaResult = await db.query(
            `INSERT INTO main.media ("fromUserId", "altText", type, path)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [userId, space.notificationMsg, 'user-image-public', storagePath],
          );
          const mediaId = mediaResult.rows[0].id;

          // Update space with media references
          const medias = JSON.stringify([{ path: storagePath, type: 'user-image-public' }]);
          await db.query(
            `UPDATE main.spaces
             SET "mediaIds" = $1::text,
                 medias = $2::jsonb,
                 "updatedAt" = NOW()
             WHERE id = $3`,
            [String(mediaId), medias, args.id],
          );

          result.imageSourced = true;
          result.imagePath = storagePath;
          log(`Uploaded image: ${storagePath}`);
          break;
        }

        if (!result.imageSourced) {
          log('No valid image found on website.');
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
