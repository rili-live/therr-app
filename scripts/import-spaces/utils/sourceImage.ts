/**
 * Shared image-sourcing pipeline for import scripts.
 *
 * Handles the full crawl → validate → GCS upload → media INSERT → spaces UPDATE
 * flow that was duplicated across `manage-space.ts`, `source-emails-websites.ts`,
 * `source-images.ts`, and `update-space-contact.ts`.
 *
 * Includes an idempotency guard: if the space already has a `mediaIds` or
 * `medias` value, the upload is skipped so we don't orphan old files in GCS
 * on re-runs.
 */
import { Pool } from 'pg';
import { crawlForImages } from '../sources/crawl';
import { downloadAndValidateImage } from './imageValidation';
import { uploadImage } from './gcs';

export interface ISourceImageInput {
  id: string;
  notificationMsg: string;
  mediaIds?: string | null;
  medias?: unknown;
}

export interface ISourceImageOptions {
  /** If true, skip GCS upload and DB writes. */
  dryRun?: boolean;
  /** Optional log prefix (e.g. "[3/50]"). */
  progress?: string;
  /** Logger; defaults to console.log. */
  log?: (msg: string) => void;
}

export type SourceImageOutcome =
  | { status: 'skipped-has-media' }
  | { status: 'no-candidates' }
  | { status: 'no-valid-image' }
  | { status: 'dry-run'; candidateCount: number }
  | { status: 'uploaded'; imagePath: string; width: number; height: number; contentType: string };

/**
 * Source an image for a space. Returns a tagged outcome so callers can
 * update their own counters / processed-spaces files as needed.
 */
export async function sourceImageForSpace(
  db: Pool,
  space: ISourceImageInput,
  websiteUrl: string,
  userId: string,
  options: ISourceImageOptions = {},
): Promise<SourceImageOutcome> {
  const { dryRun = false, progress, log = (m: string) => console.log(m) } = options;
  const prefix = progress ? `${progress} ` : '';

  // Idempotency: don't re-upload if this space already has media.
  // `mediaIds` is a legacy text column; `medias` is jsonb. Treat empty string,
  // empty array, and empty object all as "no media".
  const hasMediaIds = typeof space.mediaIds === 'string' && space.mediaIds !== '';
  const hasMediasArray = Array.isArray(space.medias) && space.medias.length > 0;
  if (hasMediaIds || hasMediasArray) {
    return { status: 'skipped-has-media' };
  }

  const candidates = await crawlForImages(websiteUrl);
  if (candidates.length === 0) {
    return { status: 'no-candidates' };
  }

  if (dryRun) {
    return { status: 'dry-run', candidateCount: candidates.length };
  }

  for (const candidate of candidates) {
    const validImage = await downloadAndValidateImage(candidate.imageUrl);
    if (!validImage) continue;

    log(`${prefix}  Image found (${candidate.source}): ${validImage.width}x${validImage.height}`);

    const storagePath = await uploadImage(userId, space.id, validImage.buffer, validImage.contentType);

    const mediaResult = await db.query(
      `INSERT INTO main.media ("fromUserId", "altText", type, path)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [userId, space.notificationMsg, 'user-image-public', storagePath],
    );
    const mediaId = mediaResult.rows[0].id;

    const medias = JSON.stringify([{ path: storagePath, type: 'user-image-public' }]);
    await db.query(
      `UPDATE main.spaces
         SET "mediaIds" = $1::text,
             medias = $2::jsonb,
             "updatedAt" = NOW()
       WHERE id = $3`,
      [String(mediaId), medias, space.id],
    );

    log(`${prefix}  Uploaded image: ${storagePath}`);
    return {
      status: 'uploaded',
      imagePath: storagePath,
      width: validImage.width,
      height: validImage.height,
      contentType: validImage.contentType,
    };
  }

  return { status: 'no-valid-image' };
}
