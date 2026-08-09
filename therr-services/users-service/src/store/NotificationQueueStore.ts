import KnexBuilder, { Knex } from 'knex';
import BrandScopedStore, { BrandValue } from './BrandScopedStore';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

// eslint-disable-next-line therr/no-direct-brand-scoped-table
export const NOTIFICATION_QUEUE_TABLE_NAME = 'main.notificationQueue';

export type NotificationQueueStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface INotificationQueueRow {
    id: string;
    userId: string;
    brandVariation: string;
    type: string;
    dedupeKey: string;
    payload: Record<string, any>;
    status: NotificationQueueStatus;
    scheduledFor: Date;
    attempts: number;
    lastError: string | null;
    sentAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface IEnqueueArgs {
    userId: string;
    type: string;
    // Must encode everything that makes this notification distinct, *including
    // its period*. See the migration for why this is the caller's job.
    dedupeKey: string;
    payload?: Record<string, any>;
    scheduledFor?: Date;
}

/**
 * The durable queue every deferred notification passes through.
 *
 * Design notes live in docs/NOTIFICATION_QUEUE_DESIGN.md; the two that matter
 * when reading this file:
 *
 *  - Enqueue is ON CONFLICT DO NOTHING against (brandVariation, userId,
 *    dedupeKey). Enqueuing is therefore safe to retry and safe to run twice,
 *    which is what lets the producers be at-least-once without duplicate sends.
 *  - Claiming uses FOR UPDATE SKIP LOCKED inside the UPDATE's subquery, so a
 *    second worker (or a second replica after a scale-up) can never hand the
 *    same row to two senders. users-service runs at replicas: 1 today, so this
 *    is insurance rather than a live requirement — but it is the cheap kind,
 *    and getting it wrong is only discoverable in production under load.
 */
export default class NotificationQueueStore extends BrandScopedStore {
    constructor(dbConnection: IConnection) {
        // 'shadow' matches the other Phase 2 stores: assertBrand warns rather
        // than throws until the cohort flips to 'enforce' together.
        super(dbConnection, NOTIFICATION_QUEUE_TABLE_NAME, 'shadow');
    }

    // Returns the inserted row, or undefined when the dedupe key already exists
    // (i.e. this notification was already queued for this period). Callers can
    // treat undefined as "already handled" rather than as an error.
    enqueue(brand: BrandValue, args: IEnqueueArgs): Promise<INotificationQueueRow | undefined> {
        this.assertBrand(brand);
        const queryString = knexBuilder
            .raw(
                `INSERT INTO ?? ("userId", "brandVariation", "type", "dedupeKey", "payload", "scheduledFor")
                 VALUES (?::uuid, ?, ?, ?, ?::jsonb, COALESCE(?::timestamptz, now()))
                 ON CONFLICT ("brandVariation", "userId", "dedupeKey") DO NOTHING
                 RETURNING *`,
                [
                    NOTIFICATION_QUEUE_TABLE_NAME,
                    args.userId,
                    brand,
                    args.type,
                    args.dedupeKey,
                    JSON.stringify(args.payload || {}),
                    args.scheduledFor ? args.scheduledFor.toISOString() : null,
                ],
            )
            .toString();
        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    /**
     * Atomically claim up to `limit` due rows, flipping them out of 'pending' so
     * no other worker can pick them up.
     *
     * Claimed rows go to 'failed' immediately, not to an intermediate
     * 'processing' state. That is deliberate: a worker that crashes mid-batch
     * leaves rows in a terminal, *visible* state with the attempt counted,
     * rather than in a limbo state that needs a separate reaper to time out.
     * The happy path overwrites 'failed' with 'sent' moments later, and
     * `requeueFailed` below is the explicit, bounded retry.
     */
    claimDue(brand: BrandValue, limit: number): Promise<INotificationQueueRow[]> {
        this.assertBrand(brand);
        const queryString = knexBuilder
            .raw(
                `UPDATE ?? AS q
                 SET "status" = 'failed',
                     "attempts" = q."attempts" + 1,
                     "lastError" = 'claimed but not completed',
                     "updatedAt" = now()
                 WHERE q."id" IN (
                     SELECT inner_q."id" FROM ?? AS inner_q
                     WHERE inner_q."status" = 'pending'
                       AND inner_q."brandVariation" = ?
                       AND inner_q."scheduledFor" <= now()
                     ORDER BY inner_q."scheduledFor" ASC
                     LIMIT ?
                     FOR UPDATE SKIP LOCKED
                 )
                 RETURNING q.*`,
                [NOTIFICATION_QUEUE_TABLE_NAME, NOTIFICATION_QUEUE_TABLE_NAME, brand, limit],
            )
            .toString();
        return this.db.write.query(queryString).then((response) => response.rows as INotificationQueueRow[]);
    }

    markSent(id: string) {
        const queryString = knexBuilder
            .raw(
                `UPDATE ?? SET "status" = 'sent', "sentAt" = now(), "lastError" = NULL, "updatedAt" = now()
                 WHERE "id" = ?::uuid`,
                [NOTIFICATION_QUEUE_TABLE_NAME, id],
            )
            .toString();
        return this.db.write.query(queryString).then((response) => response.rowCount ?? 0);
    }

    // `skipped` records a deliberate non-send (rate cap, preference, no device
    // token) so suppression shows up in metrics instead of looking like failure.
    markSkipped(id: string, reason: string) {
        const queryString = knexBuilder
            .raw(
                `UPDATE ?? SET "status" = 'skipped', "lastError" = ?, "updatedAt" = now()
                 WHERE "id" = ?::uuid`,
                [NOTIFICATION_QUEUE_TABLE_NAME, reason, id],
            )
            .toString();
        return this.db.write.query(queryString).then((response) => response.rowCount ?? 0);
    }

    markFailed(id: string, error: string) {
        const queryString = knexBuilder
            .raw(
                `UPDATE ?? SET "status" = 'failed', "lastError" = ?, "updatedAt" = now()
                 WHERE "id" = ?::uuid`,
                [NOTIFICATION_QUEUE_TABLE_NAME, error, id],
            )
            .toString();
        return this.db.write.query(queryString).then((response) => response.rowCount ?? 0);
    }

    // How many notifications this user has actually been sent since `since`.
    // Backs the per-user daily cap — the safety valve that makes raising send
    // frequency reversible rather than a one-way bet on user tolerance.
    countSentSince(brand: BrandValue, userId: string, since: Date): Promise<number> {
        const queryString = this.scopedQuery(brand)
            .where('userId', '=', userId)
            .where('status', '=', 'sent')
            .where('sentAt', '>=', since.toISOString())
            .count('* as count')
            .toString();
        return this.db.read.query(queryString).then((response) => Number(response.rows[0]?.count || 0));
    }

    // Bounded retry for rows a worker claimed but never completed (crash, pod
    // eviction mid-batch) and for transient send failures.
    requeueFailed(brand: BrandValue, maxAttempts: number, limit: number): Promise<number> {
        this.assertBrand(brand);
        const queryString = knexBuilder
            .raw(
                `UPDATE ?? AS q
                 SET "status" = 'pending', "updatedAt" = now()
                 WHERE q."id" IN (
                     SELECT inner_q."id" FROM ?? AS inner_q
                     WHERE inner_q."status" = 'failed'
                       AND inner_q."brandVariation" = ?
                       AND inner_q."attempts" < ?
                     ORDER BY inner_q."updatedAt" ASC
                     LIMIT ?
                     FOR UPDATE SKIP LOCKED
                 )`,
                [NOTIFICATION_QUEUE_TABLE_NAME, NOTIFICATION_QUEUE_TABLE_NAME, brand, maxAttempts, limit],
            )
            .toString();
        return this.db.write.query(queryString).then((response) => response.rowCount ?? 0);
    }

    // Retention. Sent/skipped rows are kept long enough to answer "why did this
    // user get that?" and to serve the rate-limit window, then dropped — the
    // partial claim index means history costs reads nothing, but it still costs
    // disk. Not brand-scoped: retention is uniform across brands and a per-brand
    // sweep would just be N times the work for the same outcome.
    deleteCompletedBefore(before: Date, limit: number): Promise<number> {
        const queryString = knexBuilder
            .raw(
                `DELETE FROM ?? WHERE "id" IN (
                     SELECT "id" FROM ??
                     WHERE "status" IN ('sent', 'skipped')
                       AND "updatedAt" < ?::timestamptz
                     LIMIT ?
                 )`,
                [
                    NOTIFICATION_QUEUE_TABLE_NAME,
                    NOTIFICATION_QUEUE_TABLE_NAME,
                    before.toISOString(),
                    limit,
                ],
            )
            .toString();
        return this.db.write.query(queryString).then((response) => response.rowCount ?? 0);
    }

    /**
     * Retention for rows that failed their way out of the retry budget.
     *
     * `deleteCompletedBefore` deliberately only touches 'sent' and 'skipped', so
     * without this a row that exhausted `maxAttempts` lives forever — and
     * because the dedupe constraint is on (brandVariation, userId, dedupeKey),
     * it also holds that key's slot forever. For a period-stamped key that is
     * harmless (tomorrow's key differs), but for a once-per-event key
     * (`pact-accepted:<pactId>:<memberId>`) it means the notification can never
     * be queued again, even after whatever broke the send is fixed.
     *
     * Kept separate from `deleteCompletedBefore` rather than folded into it so
     * each method keeps one meaning: "drop old history" vs "give up on rows that
     * will never send". A failed row is also worth keeping longer — it is the
     * only record that a send was attempted and lost.
     */
    deleteExhaustedFailedBefore(maxAttempts: number, before: Date, limit: number): Promise<number> {
        const queryString = knexBuilder
            .raw(
                `DELETE FROM ?? WHERE "id" IN (
                     SELECT "id" FROM ??
                     WHERE "status" = 'failed'
                       AND "attempts" >= ?
                       AND "updatedAt" < ?::timestamptz
                     LIMIT ?
                 )`,
                [
                    NOTIFICATION_QUEUE_TABLE_NAME,
                    NOTIFICATION_QUEUE_TABLE_NAME,
                    maxAttempts,
                    before.toISOString(),
                    limit,
                ],
            )
            .toString();
        return this.db.write.query(queryString).then((response) => response.rowCount ?? 0);
    }
}
