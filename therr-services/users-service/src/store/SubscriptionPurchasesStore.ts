import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { SUBSCRIPTION_PURCHASES_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

/**
 * Timestamps arrive as `new Date(<RFC3339 string from Play>)`, and an unparseable
 * string yields an `Invalid Date` — which is truthy, so a plain `d ? d.toISOString()
 * : null` calls `toISOString()` on it and throws a `RangeError`. That surfaces as a
 * 500 on an otherwise-good purchase: the token verified, the user paid, and the
 * write fails on a field neither the gate nor the entitlement reads.
 *
 * `expiryTime` is incidentally protected upstream (the handler's entitlement check
 * compares it against `Date.now()`, and `NaN > n` is false, so a bad expiry is
 * rejected as non-entitling before it reaches this store). `startTime` has no such
 * check and is reporting-only. Neither is worth failing a paid purchase over, so an
 * unparseable timestamp is stored as NULL — the same value used when Play omits the
 * field entirely — rather than thrown.
 */
const toIsoOrNull = (value: Date | null | undefined): string | null => {
    if (!value || Number.isNaN(value.getTime())) {
        return null;
    }

    return value.toISOString();
};

export type SubscriptionPurchaseStatus = 'active' | 'canceled' | 'expired' | 'revoked' | 'on_hold' | 'paused';

export interface ISubscriptionPurchaseRow {
    id: string;
    userId: string;
    platform: string;
    productId: string;
    purchaseToken: string;
    linkedPurchaseToken: string | null;
    orderId: string | null;
    status: SubscriptionPurchaseStatus;
    subscriptionState: string | null;
    autoRenewing: boolean | null;
    startTime: Date | null;
    expiryTime: Date | null;
    priceAmountMicros: string | null;
    priceCurrencyCode: string | null;
    acknowledgedAt: Date | null;
    verificationPayload: any;
    createdAt: Date;
    updatedAt: Date;
}

export interface IUpsertSubscriptionPurchaseParams {
    userId: string;
    platform: string;
    productId: string;
    purchaseToken: string;
    linkedPurchaseToken?: string | null;
    orderId?: string | null;
    status: SubscriptionPurchaseStatus;
    subscriptionState?: string | null;
    autoRenewing?: boolean | null;
    startTime?: Date | null;
    expiryTime?: Date | null;
    priceAmountMicros?: string | number | null;
    priceCurrencyCode?: string | null;
    verificationPayload?: any;
}

export default class SubscriptionPurchasesStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    /**
     * The account's live subscription row, if any.
     *
     * `status = 'active'` is the coarse flag the write path maintains; it is
     * kept in lockstep with `AccessLevels.HABITS_PREMIUM`, so the paywall and
     * the offer endpoint can answer "does this account have premium" from one
     * row without re-deriving it from `subscriptionState` and `expiryTime`.
     */
    getActiveByUserId(userId: string): Promise<ISubscriptionPurchaseRow | undefined> {
        const queryString = knexBuilder
            .from(SUBSCRIPTION_PURCHASES_TABLE_NAME)
            .where({ userId, status: 'active' })
            .orderBy('createdAt', 'desc')
            .limit(1)
            .toString();

        return this.db.read.query(queryString)
            .then((response) => response.rows[0] as ISubscriptionPurchaseRow | undefined);
    }

    getByPurchaseToken(purchaseToken: string): Promise<ISubscriptionPurchaseRow | undefined> {
        const queryString = knexBuilder
            .from(SUBSCRIPTION_PURCHASES_TABLE_NAME)
            .where({ purchaseToken })
            .limit(1)
            .toString();

        return this.db.read.query(queryString)
            .then((response) => response.rows[0] as ISubscriptionPurchaseRow | undefined);
    }

    /**
     * Record (or refresh) a verified subscription and keep the "one active row
     * per account" invariant.
     *
     * Everything runs in one transaction because there are two writes that must
     * not be seen half-done: superseding whatever active row the account already
     * had, and writing the row for this token. Without the transaction a crash
     * between them could either strand two active rows (violating the partial
     * unique) or leave the account with none.
     *
     * Ordering inside the transaction:
     *   1. When this write is itself 'active', expire every OTHER active row for
     *      the account — a resubscribe carries a new token linked to the old
     *      one, and Play never keeps two subscriptions to the same product live
     *      at once. This is what lets the partial UNIQUE(userId) WHERE active
     *      constraint hold without the insert below failing on it.
     *   2. Upsert by purchaseToken. A token re-verified by the client is the
     *      same row updated in place (`wasAlreadyRecorded: true`) rather than a
     *      duplicate — the retry path must be idempotent, not a 500.
     */
    upsertByPurchaseToken(
        params: IUpsertSubscriptionPurchaseParams,
    ): Promise<{ purchase: ISubscriptionPurchaseRow; wasAlreadyRecorded: boolean }> {
        const priceAmountMicros = params.priceAmountMicros != null ? String(params.priceAmountMicros) : null;

        return this.db.write.connect().then((client) => client.query('BEGIN')
            .then(() => {
                if (params.status !== 'active') {
                    return undefined;
                }

                // Expire any other active row for this account. Scoped by userId
                // and excluding the current token so re-verifying the same token
                // does not expire its own row.
                const supersedeQuery = knexBuilder(SUBSCRIPTION_PURCHASES_TABLE_NAME)
                    .where({ userId: params.userId, status: 'active' })
                    .andWhereNot({ purchaseToken: params.purchaseToken })
                    .update({ status: 'expired', updatedAt: new Date() })
                    .toString();

                return client.query(supersedeQuery);
            })
            .then(() => {
                const existingQuery = knexBuilder
                    .from(SUBSCRIPTION_PURCHASES_TABLE_NAME)
                    .where({ purchaseToken: params.purchaseToken })
                    .limit(1)
                    .toString();

                return client.query(existingQuery).then((response) => response.rows[0]);
            })
            .then((existing) => {
                // A token already bound to another account must never be re-pointed by an
                // update. `writableColumns` sets `userId`, so without this the row is simply
                // reassigned and the second account is granted the first account's paid
                // subscription — the exact replay the UNIQUE(purchaseToken) index exists to
                // stop, defeated by writing through it instead of inserting past it.
                //
                // The handler checks this too and answers a clean 409, but its read happens
                // outside this transaction: two concurrent verifies of the same stolen token
                // can both see "unclaimed" before either writes. This is the check that holds
                // under that race, so failing loudly here is correct even though it surfaces
                // as a 500 — an error beats a silent transfer of a paid entitlement.
                if (existing && existing.userId !== params.userId) {
                    throw new Error(
                        `Subscription purchaseToken is already bound to user ${existing.userId}`,
                    );
                }

                const writableColumns = {
                    userId: params.userId,
                    platform: params.platform,
                    productId: params.productId,
                    linkedPurchaseToken: params.linkedPurchaseToken ?? null,
                    orderId: params.orderId ?? null,
                    status: params.status,
                    subscriptionState: params.subscriptionState ?? null,
                    autoRenewing: params.autoRenewing ?? null,
                    startTime: toIsoOrNull(params.startTime),
                    expiryTime: toIsoOrNull(params.expiryTime),
                    priceAmountMicros,
                    priceCurrencyCode: params.priceCurrencyCode ?? null,
                    verificationPayload: params.verificationPayload
                        ? JSON.stringify(params.verificationPayload)
                        : null,
                };

                if (existing) {
                    const updateQuery = knexBuilder(SUBSCRIPTION_PURCHASES_TABLE_NAME)
                        .where({ purchaseToken: params.purchaseToken })
                        .update({ ...writableColumns, updatedAt: new Date() })
                        .returning('*')
                        .toString();

                    return client.query(updateQuery)
                        .then((response) => client.query('COMMIT').then(() => ({
                            purchase: response.rows[0] as ISubscriptionPurchaseRow,
                            wasAlreadyRecorded: true,
                        })));
                }

                const insertQuery = knexBuilder(SUBSCRIPTION_PURCHASES_TABLE_NAME)
                    .insert({ ...writableColumns, purchaseToken: params.purchaseToken })
                    .returning('*')
                    .toString();

                return client.query(insertQuery)
                    .then((response) => client.query('COMMIT').then(() => ({
                        purchase: response.rows[0] as ISubscriptionPurchaseRow,
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
        const queryString = knexBuilder(SUBSCRIPTION_PURCHASES_TABLE_NAME)
            .where({ id })
            .update({ acknowledgedAt: new Date(), updatedAt: new Date() })
            .returning('*')
            .toString();

        return this.db.write.query(queryString)
            .then((response) => response.rows[0] as ISubscriptionPurchaseRow);
    }

    /**
     * Present for the cancellation/refund path that Play's Real-Time Developer
     * Notifications will drive. Nothing calls it yet — see the follow-up in
     * docs/WORK_IN_PROGRESS.md — but the write path belongs with the rest of the
     * table's access, not scattered into whatever consumes RTDN later.
     */
    setStatus(id: string, status: SubscriptionPurchaseStatus) {
        const queryString = knexBuilder(SUBSCRIPTION_PURCHASES_TABLE_NAME)
            .where({ id })
            .update({ status, updatedAt: new Date() })
            .returning('*')
            .toString();

        return this.db.write.query(queryString)
            .then((response) => response.rows[0] as ISubscriptionPurchaseRow);
    }
}
