// Supports the authorization check in `createMediaUrls` / `ContentMediaStore.getReferencedPaths`.
//
// That handler now refuses to resolve a private media path the caller neither owns nor
// can justify with a piece of content, and "can justify" is a `medias @> '[{"path": …}]'`
// containment probe against these three tables. Without an index that probe is a
// sequential scan on every nearby-feed render that includes another user's private
// image, which is the common case the check has to stay cheap for.
//
// `jsonb_path_ops` rather than the default `jsonb_ops`: it indexes only containment,
// which is the sole operator used here, and produces a substantially smaller index.

exports.up = (knex) => knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_moments_medias_gin
    ON main."moments" USING GIN ("medias" jsonb_path_ops)
`).then(() => knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_spaces_medias_gin
    ON main."spaces" USING GIN ("medias" jsonb_path_ops)
`)).then(() => knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_events_medias_gin
    ON main."events" USING GIN ("medias" jsonb_path_ops)
`));

exports.down = (knex) => knex.raw('DROP INDEX IF EXISTS main.idx_moments_medias_gin')
    .then(() => knex.raw('DROP INDEX IF EXISTS main.idx_spaces_medias_gin'))
    .then(() => knex.raw('DROP INDEX IF EXISTS main.idx_events_medias_gin'));
