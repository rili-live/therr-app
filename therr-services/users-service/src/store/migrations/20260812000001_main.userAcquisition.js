// Create main.userAcquisition — where a registered account came from.
//
// Archetype: Identity-shared (per docs/NICHE_APP_DATABASE_GUIDELINES.md). An
// acquisition row is a fact about how a *person* arrived, not app-partitioned
// state, and it is never rendered to a user, so there is nothing here that a
// multi-app user could see leaked across brands. `surface` and `brandVariation`
// are recorded descriptively — they say which client the visitor landed on —
// and are explicitly NOT scoping predicates. This table is deliberately absent
// from eslint-config/brand-scoped-tables.js; if it ever becomes user-visible,
// reclassify it Brand-scoped and bring it under BrandScopedStore then.
//
// WHY THIS EXISTS (see docs/MARKETING_ATTRIBUTION_PLAN.md, Phase 1)
//
// The B2B funnel crosses two registrable domains — therr.app (blog/landing) →
// therr.com (space page, claim banner) → dashboard.therr.com (registration,
// pricing, checkout). GA4 loses the original source on the therr.app →
// therr.com hop, and even where it does not, the answer lives in GA4 rather
// than next to the account. "Which blog post produced this business account"
// was unanswerable in principle before this table.
//
// A separate table rather than columns on main.users, because:
//   - it is append-only and never updated, whereas main.users is the hottest
//     row in the system and is read on every authenticated request;
//   - the columns are wide (a referrer URL can be a kilobyte) and would be
//     carried by every `SELECT *` on users forever;
//   - acquisition is a per-arrival fact, and a user can be acquired more than
//     once (re-registration on another surface, a claimed unclaimed account).
//
// Every column is nullable except the FK and the timestamp. The client fills
// what the URL happened to carry, and a direct organic arrival legitimately
// carries nothing but a landing path — "direct" is a real answer, not an error.
//
// NOT brand-scoped and NOT read by either Cloud Function repo. Safe under the
// cross-repo migration rule in root CLAUDE.md § Sibling Repos: nothing in
// therr-messaging-automator or therr-ai-automator's src/store/ can reference a
// table that did not exist when they were written. Verified 2026-08-12 by
// grepping both repos' src/store for 'main.userAcquisition'.
//
// Idempotent (hasTable probe, CREATE INDEX IF NOT EXISTS) per
// therr/require-idempotent-migration.

const TABLE = 'main."userAcquisition"';

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    const exists = await knex.schema.withSchema('main').hasTable('userAcquisition');

    if (!exists) {
        await knex.schema.withSchema('main').createTable('userAcquisition', (table) => {
            table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

            table.uuid('userId').notNullable()
                .references('id').inTable('main.users')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');

            // The five standard UTM parameters. Sized to match the client-side
            // cap in therr-react/utilities/attribution; the server truncates to
            // the same length, since a client-side cap is not a constraint.
            table.string('utmSource', 255);
            table.string('utmMedium', 255);
            table.string('utmCampaign', 255);
            table.string('utmContent', 255);
            table.string('utmTerm', 255);

            // document.referrer, minus self-referrals between our own
            // properties — those are the funnel's internal hops, not sources.
            table.string('referrer', 1024);

            // Path only, never the query string: the query string is where the
            // UTMs already are, and it is also where password-reset and
            // verification tokens live. Storing it would put credentials in an
            // analytics table.
            table.string('landingPath', 512);

            // Which client the visitor landed on: web | dashboard | landing |
            // mobile. Mirrors the GA4 `surface` custom dimension so the two
            // datasets can be reconciled.
            table.string('surface', 50);

            // Descriptive only — see the archetype note above.
            table.string('brandVariation', 50);

            table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        });
    }

    // Created outside the table builder so re-running against a table that
    // already exists still converges on the full index set.
    await knex.raw(
        `CREATE INDEX IF NOT EXISTS "userAcquisition_userId_idx"
         ON ${TABLE} ("userId")`,
    );
    // The campaign rollup — "signups by campaign over a window" — is the only
    // analytical read this table has, and it leads on the campaign because that
    // is by far the more selective of the two columns.
    await knex.raw(
        `CREATE INDEX IF NOT EXISTS "userAcquisition_campaign_idx"
         ON ${TABLE} ("utmCampaign", "createdAt")
         WHERE "utmCampaign" IS NOT NULL`,
    );
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS main."userAcquisition_userId_idx"');
    await knex.raw('DROP INDEX IF EXISTS main."userAcquisition_campaign_idx"');
    await knex.schema.withSchema('main').dropTableIfExists('userAcquisition');
};
