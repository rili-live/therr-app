// Create habits.lifetime_purchases — the record of the one-time "free for life"
// founder purchase, and the ledger that enforces the 5,000-buyer limit.
//
// Archetype: Niche-schema (per docs/NICHE_APP_DATABASE_GUIDELINES.md). Lives in
// `habits.*` and carries no `brandVariation` column: the product being sold is
// a Friends with Habits SKU on a Friends with Habits Play listing, and no Therr
// or Teem context can ever read a row here.
//
// This is deliberately NOT in `main.*` alongside the Stripe B2B subscription
// machinery. That machinery has no row-level store at all — a Therr business
// subscription lives entirely in `main.users.accessLevels` plus Stripe's own
// records. Play purchases cannot work that way for two reasons that both need
// durable local rows:
//
//   1. A Play purchase token is a bearer credential for one purchase. Without a
//      UNIQUE constraint on it, the same token replayed from a second account
//      grants a second lifetime entitlement — the single most likely way this
//      feature gets abused, and the cheapest to close.
//   2. The offer is capped at the first 5,000 buyers. "How many have been sold"
//      has to be a fact we own; asking Play would mean paging every order on
//      every paywall render.
//
// WHY THE ENTITLEMENT IS STILL AN ACCESS LEVEL
//
// Rows here are the *audit trail*; `AccessLevels.HABITS_LIFETIME` on
// `main.users.accessLevels` is what gates actually read. That keeps every gate
// a pure function of the user record — no join, no second source of truth — and
// matches how every other entitlement in this codebase works.
//
// WHY founderNumber IS NULLABLE
//
// A purchase that arrives after the 5,000th is still honoured: the buyer paid,
// and refusing a completed Play transaction is a far worse outcome than handing
// out a 5,001st lifetime unlock. Such a row gets a NULL founderNumber and a
// warn span. The client hides the CTA once `remaining <= 0`, so this is the
// narrow race between render and purchase, not a routine path.
//
// Index strategy:
//   - UNIQUE (purchaseToken) — the replay guard described above.
//   - UNIQUE (founderNumber) — the backstop for slot allocation, which is
//     serialised with a transaction-scoped advisory lock in
//     LifetimePurchasesStore. The constraint is what makes a lost race fail
//     loudly instead of issuing a duplicate slot.
//   - partial UNIQUE (userId) WHERE status = 'active' — one live entitlement
//     per account, while still allowing a refunded row to sit alongside a later
//     re-purchase.
//
// Idempotent (hasTable probe, CREATE INDEX IF NOT EXISTS) per
// therr/require-idempotent-migration. createTable is guarded rather than using
// createTableIfNotExists, which Knex itself warns against and the lint rule
// flags.

const TABLE = 'habits.lifetime_purchases';

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    const exists = await knex.schema.withSchema('habits').hasTable('lifetime_purchases');

    if (!exists) {
        await knex.schema.withSchema('habits').createTable('lifetime_purchases', (table) => {
            table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

            table.uuid('userId').notNullable()
                .references('id').inTable('main.users')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');

            // android today. ios and web are reserved rather than speculative:
            // the same founder ledger has to serve them if the offer is ever
            // opened on another store, and a platform column added later would
            // need a backfill guess about existing rows.
            table.string('platform', 16).notNullable();

            table.string('productId', 120).notNullable();

            // Play purchase tokens are long and have no documented maximum, so
            // text rather than a guessed varchar length.
            table.text('purchaseToken').notNullable();
            table.string('orderId', 120);

            // active | refunded | revoked
            //
            // Nothing writes anything but 'active' yet — Play's Real-Time
            // Developer Notifications are not consumed (see the follow-up in
            // docs/WORK_IN_PROGRESS.md). The column exists now because adding it
            // later would mean backfilling a status onto rows whose true state
            // we would no longer be able to reconstruct.
            table.string('status', 20).notNullable().defaultTo('active');

            // 1..HABITS_LIFETIME_FOUNDER_LIMIT, or NULL when bought after the
            // offer sold out. Surfaced to the buyer ("Founder #237").
            table.integer('founderNumber');

            // Denormalised from Play's response so the price actually charged
            // stays answerable after a repricing, and so revenue can be summed
            // without calling the Play API.
            table.bigInteger('priceAmountMicros');
            table.string('priceCurrencyCode', 8);

            table.timestamp('purchasedAt', { useTz: true });

            // Play auto-refunds an unacknowledged purchase after three days, so
            // whether we acknowledged — and when — is the difference between a
            // sale and a reversal. Stored rather than inferred.
            table.timestamp('acknowledgedAt', { useTz: true });

            // The raw verification response. Kept because a disputed purchase is
            // argued from what Play told us at the time, not from what it says
            // today.
            table.jsonb('verificationPayload');

            table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
            table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        });
    }

    // Created outside the table builder so a re-run against an existing table
    // still converges on the full index set.
    await knex.raw(
        `CREATE UNIQUE INDEX IF NOT EXISTS "lifetime_purchases_purchaseToken_idx"
         ON ${TABLE} ("purchaseToken")`,
    );
    await knex.raw(
        `CREATE UNIQUE INDEX IF NOT EXISTS "lifetime_purchases_founderNumber_idx"
         ON ${TABLE} ("founderNumber")`,
    );
    await knex.raw(
        `CREATE UNIQUE INDEX IF NOT EXISTS "lifetime_purchases_active_userId_idx"
         ON ${TABLE} ("userId") WHERE "status" = 'active'`,
    );
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS habits."lifetime_purchases_purchaseToken_idx"');
    await knex.raw('DROP INDEX IF EXISTS habits."lifetime_purchases_founderNumber_idx"');
    await knex.raw('DROP INDEX IF EXISTS habits."lifetime_purchases_active_userId_idx"');
    await knex.schema.withSchema('habits').dropTableIfExists('lifetime_purchases');
};
