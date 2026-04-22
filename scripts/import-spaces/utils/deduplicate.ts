/**
 * Deduplication: checks if a space with the same name exists within proximity.
 */
import { Pool } from 'pg';
import { ISpaceInsertParams } from '../transforms/mapToSpace';

const PROXIMITY_METERS = 200;
const BATCH_CHECK_SIZE = 200;

export async function findDuplicates(
  db: Pool,
  spaces: ISpaceInsertParams[],
): Promise<Set<number>> {
  const duplicateIndices = new Set<number>();

  // Process in batches using a single query with unnest arrays
  for (let i = 0; i < spaces.length; i += BATCH_CHECK_SIZE) {
    const batch = spaces.slice(i, i + BATCH_CHECK_SIZE);
    const names = batch.map((s) => s.notificationMsg.toLowerCase());
    const lons = batch.map((s) => s.longitude);
    const lats = batch.map((s) => s.latitude);

    const result = await db.query(
      `SELECT idx FROM (
        SELECT unnest($1::int[]) AS idx,
               unnest($2::text[]) AS name,
               unnest($3::float8[]) AS lon,
               unnest($4::float8[]) AS lat
      ) AS candidates
      WHERE EXISTS (
        SELECT 1 FROM main.spaces s
        WHERE LOWER(s."notificationMsg") = candidates.name
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(candidates.lon, candidates.lat), 4326)::geography,
          s."geom"::geography,
          $5
        )
      )`,
      [
        batch.map((_, batchIdx) => i + batchIdx),
        names,
        lons,
        lats,
        PROXIMITY_METERS,
      ],
    );

    for (const row of result.rows) {
      duplicateIndices.add(row.idx);
    }

    if ((i + BATCH_CHECK_SIZE) < spaces.length) {
      console.log(`  Dedup progress: ${Math.min(i + BATCH_CHECK_SIZE, spaces.length)}/${spaces.length} checked`);
    }
  }

  return duplicateIndices;
}

export function deduplicateWithinBatch(spaces: ISpaceInsertParams[]): ISpaceInsertParams[] {
  const seen = new Map<string, ISpaceInsertParams>();

  for (const space of spaces) {
    const key = `${space.notificationMsg.toLowerCase()}|${space.latitude.toFixed(4)},${space.longitude.toFixed(4)}`;
    if (!seen.has(key)) {
      seen.set(key, space);
    }
  }

  return Array.from(seen.values());
}
