import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { LIFETIME_PURCHASES_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

/**
 * A stable 64-bit key for the transaction-scoped advisory lock that serialises
 * founder-slot allocation. Postgres advisory locks are keyed by number, not by
 * name, so the number has to be pinned somewhere — hashing a string at runtime
 * would work, but a literal is greppable and cannot drift between deploys.
 */
const FOUNDER_SLOT_LOCK_KEY = 8150001;

export type LifetimePurchaseStatus = 'active' | 'refunded' | 'revoked';

export interface ILifetimePurchaseRow {
    id: string;
    userId: string;
    platform: string;
    productId: string;
    purchaseToken: string;
    orderId: string | null;
    status: LifetimePurchaseStatus;
    founderNumber: number | null;
    priceAmountMicros: string | null;
    priceCurrencyCode: string | null;
    purchasedAt: Date | null;
    acknowledgedAt: Date | null;
    verificationPayload: any;
    createdAt: Date;
    updatedAt: Date;
}

export interface ICreateLifetimePurchaseParams {
    userId: string;
    platform: string;
    productId: string;
    purchaseToken: string;
    orderId?: string | null;
    priceAmountMicros?: string | number | null;
    priceCurrencyCode?: string | null;
    purchasedAt?: Date | null;
    verificationPayload?: any;
}

export default class LifetimePurchasesStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    getByUserId(userId: string): Promise<ILifetimePurchaseRow | undefined> {
        const queryString = knexBuilder
            .from(LIFETIME_PURCHASES_TABLE_NAME)
            .where({ userId, status: 'active' })
            .limit(1)
            .toString();

        return this.db.read.query(queryString)
            .then((response) => response.rows[0] as ILifetimePurchaseRow | undefined);
    }

    getByPurchaseToken(purchaseToken: string): Promise<ILifetimePurchaseRow | undefined> {
        const queryString = knexBuilder
            .from(LIFETIME_PURCHASES_TABLE_NAME)
            .where({ purchaseToken })
            .limit(1)
            .toString();

        return this.db.read.query(queryString)
            .then((response) => response.rows[0] as ILifetimePurchaseRow | undefined);
    }

    /**
     * How many founder slots are spoken for.
     *
     * Counts rows with a founder number regardless of status: a refund does not
     * hand the slot back. Reclaiming slots would mean the "first 5,000" promise
     * silently changes meaning over time, and would let a refund-and-repurchase
     * loop churn the counter. The offer is a fixed number of seats.
     */
    countClaimedFounderSlots(): Promise<number> {
        const queryString = knexBuilder
            .from(LIFETIME_PURCHASES_TABLE_NAME)
            .whereNotNull('founderNumber')
            .count('id as count')
            .toString();

        return this.db.read.query(queryString)
            .then((response) => parseInt(response.rows[0]?.count ?? '0', 10));
    }

    /**
     * Record a verified purchase and allocate its founder slot atomically.
     *
     * Everything happens inside one transaction holding
     * `pg_advisory_xact_lock`, because the allocation is a read-then-write on a
     * global counter: two buyers checking out in the same second would both
     * read the same MAX and both try to claim the same number. The advisory
     * lock serialises them, and the UNIQUE index on `founderNumber` is the
     * backstop that turns any residual race into a loud failure rather than a
     * duplicate slot. The lock is transaction-scoped, so it is released by
     * COMMIT or ROLLBACK — there is no path that leaks it.
     *
     * When `founderLimit` slots are already gone the row is still written, with
     * a NULL founder number. The buyer completed a Play purchase; refusing to
     * record it would leave them charged and unentitled, which is far worse
     * than a 5,001st lifetime unlock. The caller logs this case.
     *
     * Returns the inserted row, or the existing row when the purchase token has
     * already been recorded — verification is retried by the client on a flaky
     * network, and a retry must be idempotent rather than a 500.
     */
    createWithFounderSlot(
        params: ICreateLifetimePurchaseParams,
        founderLimit: number,
    ): Promise<{ purchase: ILifetimePurchaseRow; wasAlreadyRecorded: boolean }> {
        return this.db.write.connect().then((client) => client.query('BEGIN')
            .then(() => client.query('SELECT pg_advisory_xact_lock($1)', [FOUNDER_SLOT_LOCK_KEY]))
            .then(() => {
                const existingQuery = knexBuilder
                    .from(LIFETIME_PURCHASES_TABLE_NAME)
                    .where({ purchaseToken: params.purchaseToken })
                    .limit(1)
                    .toString();

                return client.query(existingQuery).then((response) => response.rows[0]);
            })
            .then((existing) => {
                if (existing) {
                    return client.query('COMMIT').then(() => ({
                        purchase: existing as ILifetimePurchaseRow,
                        wasAlreadyRecorded: true,
                    }));
                }

                // COALESCE(MAX(...), 0) + 1 rather than a sequence: a sequence
                // would burn numbers on any rolled-back attempt, so the
                // "Founder #N" a buyer is shown would not match how many people
                // actually bought before them.
                const insertQuery = knexBuilder.raw(
                    `INSERT INTO ${LIFETIME_PURCHASES_TABLE_NAME} (
                        "userId", "platform", "productId", "purchaseToken", "orderId",
                        "priceAmountMicros", "priceCurrencyCode", "purchasedAt",
                        "verificationPayload", "founderNumber"
                    )
                    SELECT
                        ?::uuid, ?, ?, ?, ?,
                        ?::bigint, ?, ?::timestamptz,
                        ?::jsonb,
                        CASE WHEN next_slot.value <= ? THEN next_slot.value ELSE NULL END
                    FROM (
                        SELECT COALESCE(MAX("founderNumber"), 0) + 1 AS value
                        FROM ${LIFETIME_PURCHASES_TABLE_NAME}
                    ) next_slot
                    RETURNING *`,
                    [
                        params.userId,
                        params.platform,
                        params.productId,
                        params.purchaseToken,
                        params.orderId ?? null,
                        params.priceAmountMicros != null ? String(params.priceAmountMicros) : null,
                        params.priceCurrencyCode ?? null,
                        params.purchasedAt ? params.purchasedAt.toISOString() : null,
                        params.verificationPayload ? JSON.stringify(params.verificationPayload) : null,
                        founderLimit,
                    ],
                ).toString();

                return client.query(insertQuery)
                    .then((response) => client.query('COMMIT').then(() => ({
                        purchase: response.rows[0] as ILifetimePurchaseRow,
                        wasAlreadyRecorded: false,
                    })));
            })
            .catch((err) => client.query('ROLLBACK').then(() => {
                throw err;
            }))
            .finally(() => {
                client.release();
            }));
    }

    markAcknowledged(id: string) {
        const queryString = knexBuilder
            .from(LIFETIME_PURCHASES_TABLE_NAME)
            .where({ id })
            .update({ acknowledgedAt: new Date(), updatedAt: new Date() })
            .returning('*')
            .toString();

        return this.db.write.query(queryString)
            .then((response) => response.rows[0] as ILifetimePurchaseRow);
    }

    /**
     * Present for the refund/revocation path that Play's Real-Time Developer
     * Notifications will drive. Nothing calls it yet — see the follow-up in
     * docs/WORK_IN_PROGRESS.md — but the write path belongs with the rest of
     * the table's access, not scattered into whatever consumes RTDN later.
     */
    setStatus(id: string, status: LifetimePurchaseStatus) {
        const queryString = knexBuilder
            .from(LIFETIME_PURCHASES_TABLE_NAME)
            .where({ id })
            .update({ status, updatedAt: new Date() })
            .returning('*')
            .toString();

        return this.db.write.query(queryString)
            .then((response) => response.rows[0] as ILifetimePurchaseRow);
    }
}
