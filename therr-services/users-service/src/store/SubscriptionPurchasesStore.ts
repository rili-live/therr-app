import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { SUBSCRIPTION_PURCHASES_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

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
                const writableColumns = {
                    userId: params.userId,
                    platform: params.platform,
                    productId: params.productId,
                    linkedPurchaseToken: params.linkedPurchaseToken ?? null,
                    orderId: params.orderId ?? null,
                    status: params.status,
                    subscriptionState: params.subscriptionState ?? null,
                    autoRenewing: params.autoRenewing ?? null,
                    startTime: params.startTime ? params.startTime.toISOString() : null,
                    expiryTime: params.expiryTime ? params.expiryTime.toISOString() : null,
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
