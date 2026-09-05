// Gives thoughts a working media column.
//
// `main.thoughts` has carried a `mediaIds text` column since the original 2022 migration,
// but nothing ever wrote it: the mobile composer uploads an image and posts
// `media: [{ type, path }]`, and `ThoughtsStore.create`'s allow-list dropped the field on
// the floor. Every goal or thought posted with a photo since has orphaned the object in
// the bucket and stored nothing. See docs/WORK_IN_PROGRESS.md § 2.6.7.
//
// `medias jsonb` rather than reviving the comma-separated `mediaIds`: moments, spaces and
// events all moved to a `medias jsonb` of `[{ path, type }]` (20240322140814 and siblings),
// and matching them is what lets the existing client-side `getUserContentUri(media)` render
// thought media with no new display code.
//
// `mediaIds` is deliberately left in place. It is expand/contract — therr-ai-automator
// writes `main.thoughts` directly (see docs/CROSS_REPO_INTEGRATION.md), so dropping a
// column in the same change that adds one risks breaking a Cloud Function at its next
// firing rather than at deploy. Removing it belongs in a later contract migration.

exports.up = (knex) => knex.raw(`
    ALTER TABLE main."thoughts"
    ADD COLUMN IF NOT EXISTS "medias" jsonb
`);

exports.down = (knex) => knex.raw(`
    ALTER TABLE main."thoughts"
    DROP COLUMN IF EXISTS "medias"
`);
