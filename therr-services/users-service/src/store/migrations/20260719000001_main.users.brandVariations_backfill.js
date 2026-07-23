/**
 * Idempotent brandVariations normalization backfill.
 *
 * Discovery / People-You-May-Know scope users with a JSONB containment check
 * (`"brandVariations" @> '[{"brand":"..."}]'`). That operator only matches when the
 * column is an ARRAY of OBJECTS that each carry a `brand` key. Rows written in older
 * shapes silently fail the filter and vanish from search (e.g. a Therr account that
 * never appears even on the Therr app).
 *
 * `20260425000001_..._v2` normalized the single-object case only. This migration is a
 * superset that repairs every non-canonical shape and is safe to re-run:
 *
 *   SQL NULL / JSON null        -> [{"brand":"therr","details":{}}]  (legacy Therr default)
 *   object {"brand":...}        -> [ {"brand":...} ]                 (wrap)
 *   scalar string "therr"       -> [ {"brand":"therr"} ]
 *   array ["therr","habits"]    -> [ {"brand":"therr"}, {"brand":"habits"} ]
 *   array with junk / no-brand  -> junk elements dropped; if none remain, Therr default
 *   empty array []              -> [{"brand":"therr","details":{}}]  (legacy Therr default)
 *   canonical array of objects  -> untouched (skipped by the WHERE guard)
 *
 * Existing brand memberships are preserved; only unknowable rows fall back to Therr,
 * matching the column's original default and keeping pre-existing accounts visible to
 * the Therr app. The WHERE guard selects only non-canonical rows, so a second run
 * updates zero rows (verified against Postgres 16 with all shapes above).
 *
 * NOTE: the JSONB key-existence operator is written `\\?` (not `?`). Knex.raw treats a
 * bare `?` as a positional bind placeholder, so an unescaped `elem ? 'brand'` throws
 * "syntax error at or near $1". This mirrors the existing `\\?|` usage in UsersStore.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async (knex) => {
    await knex.raw(`
        UPDATE main.users
        SET "brandVariations" = (
            CASE
                WHEN "brandVariations" IS NULL OR jsonb_typeof("brandVariations") = 'null'
                    THEN '[{"brand":"therr","details":{}}]'::jsonb
                WHEN jsonb_typeof("brandVariations") = 'object'
                    THEN jsonb_build_array("brandVariations")
                WHEN jsonb_typeof("brandVariations") = 'string'
                    THEN jsonb_build_array(jsonb_build_object('brand', ("brandVariations" #>> '{}')))
                WHEN jsonb_typeof("brandVariations") = 'array'
                    THEN COALESCE((
                        SELECT jsonb_agg(norm) FILTER (WHERE norm IS NOT NULL)
                        FROM (
                            SELECT CASE
                                WHEN jsonb_typeof(elem) = 'object' AND (elem \\? 'brand') THEN elem
                                WHEN jsonb_typeof(elem) = 'string' THEN jsonb_build_object('brand', (elem #>> '{}'))
                                ELSE NULL
                            END AS norm
                            FROM jsonb_array_elements("brandVariations") elem
                        ) t
                    ), '[{"brand":"therr","details":{}}]'::jsonb)
                ELSE '[{"brand":"therr","details":{}}]'::jsonb
            END
        )
        WHERE
            "brandVariations" IS NULL
            OR jsonb_typeof("brandVariations") <> 'array'
            OR jsonb_array_length("brandVariations") = 0
            OR EXISTS (
                SELECT 1 FROM jsonb_array_elements("brandVariations") elem
                WHERE jsonb_typeof(elem) <> 'object' OR NOT (elem \\? 'brand')
            );
    `);
};

/**
 * Data backfill only — the prior malformed shapes are not restorable (and were
 * inconsistent with the column default). Down is intentionally a no-op.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async () => {
    // No-op: normalized rows are a strict superset-compatible state; nothing to revert.
};
