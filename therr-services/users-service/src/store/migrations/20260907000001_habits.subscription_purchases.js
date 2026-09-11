// Create habits.subscription_purchases — the record of the $6.99/month Friends
// with Habits premium subscription, sold through Google Play Billing.
//
// Archetype: Niche-schema (per docs/NICHE_APP_DATABASE_GUIDELINES.md). Lives in
// `habits.*` and carries no `brandVariation` column: the product is a Friends
// with Habits subscription SKU on a Friends with Habits Play listing, and no
// Therr or Teem context can ever read a row here.
//
// This is the recurring sibling of `habits.lifetime_purchases` (the one-time
// founder unlock). It exists for the same two reasons a Play purchase needs a
// durable local row rather than living entirely in `main.users.accessLevels`:
//
//   1. A Play purchase token is a bearer credential for one purchase. Without a
//      UNIQUE constraint on it, the same token replayed from a second account
//      grants a second entitlement.
//   2. A subscription has state that outlives the checkout — it renews, it can
//      be cancelled, it enters a grace period, it expires. `expiryTime` and
//      `status` are what let a future Real-Time Developer Notification consumer
//      (see docs/WORK_IN_PROGRESS.md) revoke access without calling Play on
//      every gate.
//
// WHY THE ENTITLEMENT IS STILL AN ACCESS LEVEL
//
// Rows here are the audit trail; `AccessLevels.HABITS_PREMIUM` on
// `main.users.accessLevels` is what gates actually read, via
// `hasHabitsPremiumEntitlement`. That keeps every gate a pure function of the
// user record — no join, no second source of truth — exactly as lifetime does.
//
// Index strategy:
//   - UNIQUE (purchaseToken) — the replay guard described above, and what makes
//     a client re-verifying the same token idempotent rather than a duplicate.
//   - partial UNIQUE (userId) WHERE status = 'active' — at most one live
//     subscription per account, while still allowing an expired/cancelled row to
//     sit alongside a later resubscribe. A resubscribe carries a NEW token that
//     links back to the old one via `linkedPurchaseToken`; the store supersedes
//     the old row (status -> 'expired') before inserting, so the partial unique
//     is never violated.
//
// Idempotent (hasTable probe, CREATE INDEX IF NOT EXISTS) per
// therr/require-idempotent-migration. createTable is guarded rather than using
// createTableIfNotExists, which Knex itself warns against and the lint rule
// flags.

const TABLE = 'habits.subscription_purchases';

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    const exists = await knex.schema.withSchema('habits').hasTable('subscription_purchases');

    if (!exists) {
        await knex.schema.withSchema('habits').createTable('subscription_purchases', (table) => {
            table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

            table.uuid('userId').notNullable()
                .references('id').inTable('main.users')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');

            // android today. ios and web are reserved rather than speculative:
            // the same subscription has to serve them if the offer is ever
            // opened on another store, and a platform column added later would
            // need a backfill guess about existing rows.
            table.string('platform', 16).notNullable();

            table.string('productId', 120).notNullable();

            // Play purchase tokens are long and have no documented maximum, so
            // text rather than a guessed varchar length.
            table.text('purchaseToken').notNullable();

            // The token this one replaces on a resubscribe or plan change. Play
            // hands it back on the v2 subscription resource; the store reads it to
            // supersede the earlier row.
            table.text('linkedPurchaseToken');

            table.string('orderId', 120);

            // active | canceled | expired | revoked | on_hold | paused
            //
            // Only 'active' and 'expired' are written today — the client verify
            // path writes 'active' on an entitling state and 'expired' otherwise,
            // and supersession writes 'expired'. The richer set exists now because
            // Play's Real-Time Developer Notifications (not yet consumed — see the
            // follow-up in docs/WORK_IN_PROGRESS.md) drive the rest, and adding the
            // column later would mean backfilling a status onto rows whose true
            // state we could no longer reconstruct.
            table.string('status', 20).notNullable().defaultTo('active');

            // Play's own subscriptionState string, kept verbatim so a row can be
            // reconciled against Play without re-deriving our coarser `status`.
            table.string('subscriptionState', 48);

            table.boolean('autoRenewing');

            table.timestamp('startTime', { useTz: true });

            // The moment access lapses if not renewed. The gate reads `status`,
            // but this is what an RTDN consumer (and any manual audit) compares
            // against NOW() to decide whether a row still entitles.
            table.timestamp('expiryTime', { useTz: true });

            // Denormalised from the client/store so revenue can be summed without
            // calling the Play API. Nullable: the v2 subscription resource does
            // not always carry a price, and the server never trusts a client to
            // supply one for entitlement — only for reporting.
            table.bigInteger('priceAmountMicros');
            table.string('priceCurrencyCode', 8);

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
        `CREATE UNIQUE INDEX IF NOT EXISTS "subscription_purchases_purchaseToken_idx"
         ON ${TABLE} ("purchaseToken")`,
    );
    await knex.raw(
        `CREATE UNIQUE INDEX IF NOT EXISTS "subscription_purchases_active_userId_idx"
         ON ${TABLE} ("userId") WHERE "status" = 'active'`,
    );
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS habits."subscription_purchases_purchaseToken_idx"');
    await knex.raw('DROP INDEX IF EXISTS habits."subscription_purchases_active_userId_idx"');
    await knex.schema.withSchema('habits').dropTableIfExists('subscription_purchases');
};
