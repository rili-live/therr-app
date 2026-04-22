/**
 * Shared INSERT helper for `main.spaces` used by import scripts.
 *
 * Centralizes the 35-line INSERT statement that `index.ts` and `manage-space.ts`
 * had duplicated verbatim. Returns granular counts so callers can distinguish
 * real failures from benign ON CONFLICT skips.
 */
import { Pool } from 'pg';
import { BATCH_SIZE } from '../config';
import { ISpaceInsertParams } from '../transforms/mapToSpace';

const INSERT_SQL = `INSERT INTO main.spaces
    ("fromUserId", locale, "isPublic", message, "notificationMsg",
     "mediaIds", "mentionsIds", "hashTags", "maxViews",
     latitude, longitude, radius, "polygonCoords", "maxProximity",
     "doesRequireProximityToView", "isMatureContent", "isModeratorApproved",
     "isForSale", "isHirable", "isPromotional", "isExclusiveToGroups",
     category, "areaType", valuation, region,
     "addressReadable", "addressStreetAddress", "addressRegion", "addressLocality", "postalCode",
     "phoneNumber", "businessEmail", "websiteUrl", "isPointOfInterest", "openingHours",
     geom, "geomCenter")
  VALUES
    ($1, $2, $3, $4, $5,
     $6, $7, $8, $9,
     $10::float8, $11::float8, $12::float8, $13::jsonb, $14::float8,
     $15, $16, $17,
     $18, $19, $20, $21,
     $22, $23, $24, $25,
     $26, $27, $28, $29, $30::integer,
     $31, $32, $33, $34, $35::jsonb,
     ST_SetSRID(ST_Buffer(ST_MakePoint($11::float8, $10::float8)::geography, $36::float8)::geometry, 4326),
     ST_SetSRID(ST_MakePoint($11::float8, $10::float8), 4326))
  ON CONFLICT DO NOTHING
  RETURNING id`;

export interface IInsertSpacesResult {
  /** Number of rows actually inserted. */
  inserted: number;
  /** IDs of inserted rows, in insertion order. */
  ids: string[];
  /**
   * Rows the database rejected via ON CONFLICT (including the exclude_geom
   * overlap constraint) — not a real error, just a duplicate/neighbor hit.
   */
  skipped: number;
  /** Rows that raised a non-conflict DB error. */
  failed: number;
}

export interface IInsertSpacesOptions {
  /** Per-row max before a progress line is logged. Defaults to `BATCH_SIZE`. */
  batchSize?: number;
  /** Logger for progress/error lines. Defaults to `console`. */
  log?: (msg: string) => void;
  errorLog?: (msg: string) => void;
}

/**
 * Determines whether an INSERT error should be treated as a benign conflict
 * (duplicate, geom overlap) vs a true failure worth logging.
 */
function isBenignConflict(err: { message?: string }): boolean {
  const msg = err.message || '';
  return msg.includes('no_area_overlaps') || msg.includes('exclude');
}

/**
 * Insert a batch of spaces with ON CONFLICT DO NOTHING. Returns
 * `{inserted, ids, skipped, failed}` so callers can tell true errors from
 * benign duplicates — something the old in-file versions lost.
 */
export async function insertSpacesBatch(
  db: Pool,
  spaces: ISpaceInsertParams[],
  options: IInsertSpacesOptions = {},
): Promise<IInsertSpacesResult> {
  const {
    batchSize = BATCH_SIZE,
    log = (m: string) => console.log(m),
    errorLog = (m: string) => console.error(m),
  } = options;

  const result: IInsertSpacesResult = {
    inserted: 0,
    ids: [],
    skipped: 0,
    failed: 0,
  };

  for (let i = 0; i < spaces.length; i += batchSize) {
    const batch = spaces.slice(i, i + batchSize);

    for (const space of batch) {
      try {
        const r = await db.query(INSERT_SQL, [
          space.fromUserId, space.locale, space.isPublic, space.message, space.notificationMsg,
          space.mediaIds, space.mentionsIds, space.hashTags, space.maxViews,
          space.latitude, space.longitude, space.radius, space.polygonCoords, space.maxProximity,
          space.doesRequireProximityToView, space.isMatureContent, space.isModeratorApproved,
          space.isForSale, space.isHirable, space.isPromotional, space.isExclusiveToGroups,
          space.category, space.areaType, space.valuation, space.region,
          space.addressReadable, space.addressStreetAddress, space.addressRegion, space.addressLocality, space.postalCode,
          space.phoneNumber, space.businessEmail, space.websiteUrl, space.isPointOfInterest, space.openingHours,
          space.radius,
        ]);

        if (r.rowCount && r.rowCount > 0) {
          result.inserted += 1;
          result.ids.push(r.rows[0].id);
        } else {
          result.skipped += 1;
        }
      } catch (err: any) {
        if (isBenignConflict(err)) {
          result.skipped += 1;
        } else {
          result.failed += 1;
          errorLog(`  Failed to insert "${space.notificationMsg}": ${err.message}`);
        }
      }
    }

    log(`  Batch progress: ${Math.min(i + batchSize, spaces.length)}/${spaces.length} processed, ${result.inserted} inserted`);
  }

  return result;
}
