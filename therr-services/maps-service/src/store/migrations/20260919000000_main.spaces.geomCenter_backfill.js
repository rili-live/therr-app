// Backfill `geomCenter` for spaces created through the app since 2024-05-23.
//
// `20240523210755_main.spaces` added the column and backfilled it once, but
// `SpacesStore.createSpace` never wrote it for new rows (only `geom`), and every
// proximity query — searchSpaces, countRecords, getSpacePairings, check-in distance —
// reads `geomCenter`. Each such space (272 in production at the time of writing, 270
// of them public) therefore matched no ST_DWithin filter and never appeared in search.
//
// The store now populates the column on insert; this brings the existing rows in line.
// Idempotent: only rows with a NULL centre are touched, so a re-run is a no-op.

exports.up = (knex) => knex.raw(`
    UPDATE main."spaces"
    SET "geomCenter" = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
    WHERE "geomCenter" IS NULL
      AND longitude IS NOT NULL
      AND latitude IS NOT NULL
`);

// Data backfill only — there is no prior state to restore.
exports.down = () => Promise.resolve();
