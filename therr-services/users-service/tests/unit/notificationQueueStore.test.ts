/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import { BrandVariations } from 'therr-js-utilities/constants';
import NotificationQueueStore from '../../src/store/NotificationQueueStore';

/**
 * NotificationQueueStore — the SQL, not the plumbing.
 *
 * Everything that makes this queue correct is expressed in the emitted SQL:
 * dedup lives in an ON CONFLICT clause, worker safety lives in FOR UPDATE SKIP
 * LOCKED, and brand isolation lives in a WHERE predicate. None of that is
 * visible from the method signatures, and all of it is the kind of thing that
 * survives a careless refactor syntactically while losing its meaning. So these
 * tests capture the generated query strings against a stub connection rather
 * than standing up Postgres — the integration suite covers round-trips.
 */

const buildStore = () => {
    const queries: { pool: 'read' | 'write'; sql: string }[] = [];
    const makeRunner = (pool: 'read' | 'write') => ({
        query: (sql: string) => {
            queries.push({ pool, sql });
            return Promise.resolve({ rows: [], rowCount: 0 });
        },
    });
    const store = new NotificationQueueStore({
        read: makeRunner('read'),
        write: makeRunner('write'),
    } as any);

    return { store, queries, last: () => queries[queries.length - 1].sql };
};

describe('NotificationQueueStore', () => {
    describe('enqueue', () => {
        it('dedupes on (brandVariation, userId, dedupeKey) instead of inserting a second row', async () => {
            const { store, last } = buildStore();

            await store.enqueue(BrandVariations.HABITS, {
                userId: 'a2b1c0d9-0000-4000-8000-000000000001',
                type: 'streak-at-risk',
                dedupeKey: 'streak-at-risk:pact-1:2026-08-08',
            });

            const sql = last();
            expect(sql).to.have.string('ON CONFLICT');
            expect(sql).to.have.string('"brandVariation", "userId", "dedupeKey"');
            // DO NOTHING, not DO UPDATE: a re-run must not reset scheduledFor or
            // resurrect a row the worker already sent.
            expect(sql).to.have.string('DO NOTHING');
        });

        it('writes the brand from the argument, so a producer cannot file under the wrong app', async () => {
            const { store, last } = buildStore();

            await store.enqueue(BrandVariations.HABITS, {
                userId: 'a2b1c0d9-0000-4000-8000-000000000001',
                type: 'pact-nudge',
                dedupeKey: 'pact-nudge:pact-1',
            });

            expect(last()).to.have.string("'habits'");
        });

        it('defaults scheduledFor to now() when the caller does not defer', async () => {
            const { store, last } = buildStore();

            await store.enqueue(BrandVariations.THERR, {
                userId: 'a2b1c0d9-0000-4000-8000-000000000001',
                type: 'new-like-received',
                dedupeKey: 'like:post-1',
            });

            expect(last()).to.have.string('COALESCE');
            expect(last()).to.have.string('now()');
        });

        it('carries an explicit scheduledFor through, which is the send-time personalization hook', async () => {
            const { store, last } = buildStore();
            const when = new Date('2026-08-09T01:30:00.000Z');

            await store.enqueue(BrandVariations.HABITS, {
                userId: 'a2b1c0d9-0000-4000-8000-000000000001',
                type: 'daily-habit-reminder',
                dedupeKey: 'daily:2026-08-09',
                scheduledFor: when,
            });

            expect(last()).to.have.string('2026-08-09T01:30:00.000Z');
        });

        it('goes to the write pool', async () => {
            const { store, queries } = buildStore();

            await store.enqueue(BrandVariations.THERR, {
                userId: 'a2b1c0d9-0000-4000-8000-000000000001',
                type: 'new-like-received',
                dedupeKey: 'like:post-2',
            });

            expect(queries[queries.length - 1].pool).to.equal('write');
        });
    });

    describe('claimDue', () => {
        it('claims with FOR UPDATE SKIP LOCKED so two workers cannot send the same row', async () => {
            const { store, last } = buildStore();

            await store.claimDue(BrandVariations.HABITS, 25);

            expect(last()).to.have.string('FOR UPDATE SKIP LOCKED');
        });

        it('only claims rows that are pending and actually due', async () => {
            const { store, last } = buildStore();

            await store.claimDue(BrandVariations.HABITS, 25);

            const sql = last();
            expect(sql).to.have.string(`"status" = 'pending'`);
            expect(sql).to.have.string('"scheduledFor" <= now()');
        });

        it('scopes the claim to one brand', async () => {
            const { store, last } = buildStore();

            await store.claimDue(BrandVariations.HABITS, 25);

            expect(last()).to.have.string(`"brandVariation" = 'habits'`);
        });

        it('counts the attempt at claim time, so a crashed worker cannot retry forever', async () => {
            const { store, last } = buildStore();

            await store.claimDue(BrandVariations.HABITS, 25);

            const sql = last();
            expect(sql).to.have.string('"attempts" = q."attempts" + 1');
            // Claimed rows land in a terminal, visible state rather than a
            // 'processing' limbo that would need its own reaper.
            expect(sql).to.have.string(`SET "status" = 'failed'`);
        });

        it('honors the batch limit', async () => {
            const { store, last } = buildStore();

            await store.claimDue(BrandVariations.HABITS, 7);

            expect(last()).to.have.string('LIMIT 7');
        });
    });

    describe('requeueFailed', () => {
        it('is bounded by attempts so a permanently broken row stops being retried', async () => {
            const { store, last } = buildStore();

            await store.requeueFailed(BrandVariations.HABITS, 3, 25);

            const sql = last();
            expect(sql).to.have.string('"attempts" <');
            expect(sql).to.have.string('3');
            expect(sql).to.have.string(`SET "status" = 'pending'`);
        });
    });

    describe('countSentSince', () => {
        it('counts only rows actually sent, scoped to the brand and user', async () => {
            const { store, last, queries } = buildStore();

            await store.countSentSince(
                BrandVariations.HABITS,
                'a2b1c0d9-0000-4000-8000-000000000001',
                new Date('2026-08-07T00:00:00.000Z'),
            );

            const sql = last();
            expect(sql).to.have.string(`"status" = 'sent'`);
            expect(sql).to.have.string(`"brandVariation" = 'habits'`);
            expect(sql).to.have.string('2026-08-07T00:00:00.000Z');
            // The rate check is a read — it must not burden the write pool on
            // every single send.
            expect(queries[queries.length - 1].pool).to.equal('read');
        });
    });

    describe('deleteCompletedBefore', () => {
        it('only ever removes terminal rows, never pending work', async () => {
            const { store, last } = buildStore();

            await store.deleteCompletedBefore(new Date('2026-07-01T00:00:00.000Z'), 500);

            const sql = last();
            expect(sql).to.have.string(`IN ('sent', 'skipped')`);
            expect(sql).to.not.have.string("'pending'");
        });
    });
});
