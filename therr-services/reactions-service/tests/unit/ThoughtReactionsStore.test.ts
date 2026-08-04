/* eslint-disable quotes */
import { expect } from 'chai';
import sinon from 'sinon';
import ThoughtReactionsStore from '../../src/store/ThoughtReactionsStore';

describe('ThoughtReactionsStore', () => {
    const createMockStore = () => ({
        read: {
            query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
        },
        write: {
            query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
        },
    });

    describe('getCounts', () => {
        it('returns empty array when no thought IDs provided', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            const result = await store.getCounts([], {});

            expect(result).to.deep.equal([]);
            expect(mockStore.read.query.called).to.be.eq(false);
        });

        it('generates query with correct table and groupBy', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.getCounts(['thought-1', 'thought-2'], {});

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('from "main"."thoughtReactions"');
            expect(query).to.include('group by "thoughtId"');
            expect(query).to.include('"userHasLiked" = true');
            expect(query).to.include("'thought-1'");
            expect(query).to.include("'thought-2'");
        });

        it('uses custom countBy parameter', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.getCounts(['thought-1'], {}, 'userHasSuperLiked');

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"userHasSuperLiked" = true');
        });

        it('includes additional conditions in query', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.getCounts(['thought-1'], { someCondition: true });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"someCondition" = true');
        });
    });

    describe('get', () => {
        it('generates query with conditions and ordering', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.get({ userId: 'user-1' });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('select *');
            expect(query).to.include('from "main"."thoughtReactions"');
            expect(query).to.include('"userId" = \'user-1\'');
            expect(query).to.include('order by "createdAt"');
            expect(query).to.include('limit 100');
        });

        it('restricts limit to 1000', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.get({ userId: 'user-1' }, undefined, { limit: 5000, offset: 0, order: 'DESC' });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('limit 1000');
            expect(query).to.not.include('limit 5000');
        });

        it('includes thoughtIds filter when provided', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.get({ userId: 'user-1' }, ['t-1', 't-2']);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"thoughtId" in');
            expect(query).to.include("'t-1'");
            expect(query).to.include("'t-2'");
        });

        it('includes bookmark filter when withBookmark is true', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.get({ userId: 'user-1' }, undefined, { limit: 100, offset: 0, order: 'DESC' }, { withBookmark: true });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('"userBookmarkCategory" is not null');
        });

        it('applies custom offset and order', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.get({ userId: 'user-1' }, undefined, { limit: 50, offset: 10, order: 'ASC' });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('limit 50');
            expect(query).to.include('offset 10');
            expect(query).to.include('ASC');
        });

        // The activated stream is ordered by the score the distributor assigned at activation.
        // Ordering by reaction createdAt left intra-batch order arbitrary, because a
        // distributor run activates 7-20 rows with effectively identical timestamps.
        it('orders by relevance score when requested, sinking unscored rows', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.get({ userId: 'user-1' }, undefined, {
                limit: 21, offset: 0, order: 'DESC', orderBy: 'relevance',
            });

            const query = mockStore.read.query.args[0][0];
            // NULLS LAST: rows activated before scoring existed must not lead the feed.
            expect(query).to.include('order by "relevanceScore" DESC NULLS LAST');
            // thoughtId tiebreak keeps offset pagination stable across equal scores.
            expect(query).to.include('"createdAt" DESC, "thoughtId" DESC');
        });

        it('defaults to createdAt ordering so non-feed callers are unaffected', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.get({ userId: 'user-1' }, undefined, { limit: 21, offset: 0, order: 'DESC' });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.not.include('relevanceScore');
            expect(query).to.include('order by "createdAt"');
        });

        // `order` arrives straight from a request body and is interpolated into raw SQL on
        // the relevance branch.
        it('rejects an injected sort direction', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.get({ userId: 'user-1' }, undefined, {
                limit: 21,
                offset: 0,
                order: 'DESC; DROP TABLE main."thoughtReactions"; --',
                orderBy: 'relevance',
            });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.not.include('DROP TABLE');
            expect(query).to.include('"createdAt" DESC, "thoughtId" DESC');
        });
    });

    // Called when a user switches content algorithms. Scores from two profiles are on
    // different scales (PULSE weights the hot term at 1.0, FOCUS at 0.3 plus an interest
    // term), so the old ones are discarded rather than interleaved with the new.
    describe('resetRelevanceScores', () => {
        it('does nothing without a user, rather than clearing every row in the table', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            const result = await store.resetRelevanceScores('');

            expect(result).to.deep.equal([]);
            expect(mockStore.write.query.called).to.be.eq(false);
        });

        it('nulls the score, its timestamp, and the algorithm that produced it', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.resetRelevanceScores('user-123');

            const query = mockStore.write.query.args[0][0];
            expect(query).to.include('"relevanceScore" = NULL');
            expect(query).to.include('"scoredAt" = NULL');
            expect(query).to.include('"algorithmKey" = NULL');
        });

        it('scopes to one user and to activated rows only', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.resetRelevanceScores('user-123');

            const query = mockStore.write.query.args[0][0];
            expect(query).to.include("'user-123'");
            // The feed only ever reads activated rows; rewriting the rest is write
            // amplification for an ordering nothing can observe.
            expect(query).to.include('"userHasActivated" = true');
            // Already-null rows are skipped for the same reason.
            expect(query).to.include('"relevanceScore" IS NOT NULL');
        });
    });

    describe('updateRelevanceScores', () => {
        it('sets a different score per thought in a single statement', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            await store.updateRelevanceScores('11111111-1111-1111-1111-111111111111', {
                '22222222-2222-2222-2222-222222222222': 3.5,
                '33333333-3333-3333-3333-333333333333': 1.25,
            });

            expect(mockStore.write.query.callCount).to.eq(1);
            const query = mockStore.write.query.args[0][0];
            expect(query).to.include('UPDATE main."thoughtReactions"');
            expect(query).to.include("'22222222-2222-2222-2222-222222222222'::uuid, 3.5::double precision");
            expect(query).to.include("'33333333-3333-3333-3333-333333333333'::uuid, 1.25::double precision");
            // Scoped to the one user — a score is per (user, thought), not global.
            expect(query).to.include(`tr."userId" = '11111111-1111-1111-1111-111111111111'::uuid`);
        });

        it('does not query when there is nothing to score', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            const result = await store.updateRelevanceScores('user-1', {});

            expect(result).to.deep.equal([]);
            expect(mockStore.write.query.called).to.be.eq(false);
        });

        // algorithmKey travels with the score. It used to ride in the caller's shared param
        // set, which stamped it onto every row in the batch — including rows this run did not
        // score — so a row could name a profile that never ranked it.
        it('records the algorithm alongside the score it produced', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            await store.updateRelevanceScores('11111111-1111-1111-1111-111111111111', {
                '22222222-2222-2222-2222-222222222222': 3.5,
            }, 'focus');

            const query = mockStore.write.query.args[0][0];
            expect(query).to.include('"algorithmKey" = \'focus\'');
            // Still bound to the right user, i.e. the extra binding did not shift the others.
            expect(query).to.include(`tr."userId" = '11111111-1111-1111-1111-111111111111'::uuid`);
            expect(query).to.include("'22222222-2222-2222-2222-222222222222'::uuid, 3.5::double precision");
        });

        it('leaves an already-recorded algorithm alone when the caller supplies none', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            await store.updateRelevanceScores('11111111-1111-1111-1111-111111111111', {
                '22222222-2222-2222-2222-222222222222': 3.5,
            });

            const query = mockStore.write.query.args[0][0];
            // Absent from SET entirely rather than set to NULL — an older caller that does not
            // know about profiles should not erase what a newer one recorded.
            expect(query).to.not.include('"algorithmKey"');
            expect(query).to.include(`tr."userId" = '11111111-1111-1111-1111-111111111111'::uuid`);
        });

        it('drops non-numeric scores rather than emitting invalid SQL', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            await store.updateRelevanceScores('11111111-1111-1111-1111-111111111111', {
                '22222222-2222-2222-2222-222222222222': 2,
                '33333333-3333-3333-3333-333333333333': (undefined as any),
            });

            const query = mockStore.write.query.args[0][0];
            expect(query).to.include('22222222-2222-2222-2222-222222222222');
            expect(query).to.not.include('33333333-3333-3333-3333-333333333333');
        });
    });

    describe('getByThoughtId', () => {
        it('generates query with conditions and default limit', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.getByThoughtId({ thoughtId: 'thought-123' });

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('select *');
            expect(query).to.include('from "main"."thoughtReactions"');
            expect(query).to.include('"thoughtId" = \'thought-123\'');
            expect(query).to.include('limit 100');
        });

        it('restricts limit to 1000', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.getByThoughtId({ thoughtId: 'thought-123' }, 5000);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('limit 1000');
        });

        it('uses provided limit when under 1000', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.getByThoughtId({ thoughtId: 'thought-123' }, 50);

            const query = mockStore.read.query.args[0][0];
            expect(query).to.include('limit 50');
        });
    });

    describe('create', () => {
        it('generates insert query for single reaction', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.create({
                thoughtId: 'thought-1',
                userId: 'user-1',
                userHasLiked: true,
            });

            const query = mockStore.write.query.args[0][0];
            expect(query).to.include('insert into "main"."thoughtReactions"');
            expect(query).to.include("'thought-1'");
            expect(query).to.include("'user-1'");
            expect(query).to.include('returning *');
        });

        it('generates insert query for batch reactions', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.create([
                { thoughtId: 'thought-1', userId: 'user-1' },
                { thoughtId: 'thought-2', userId: 'user-1' },
            ]);

            const query = mockStore.write.query.args[0][0];
            expect(query).to.include('insert into "main"."thoughtReactions"');
            expect(query).to.include("'thought-1'");
            expect(query).to.include("'thought-2'");
            expect(query).to.include('returning *');
        });

        // knex renders `.insert([])` as an empty string. The multi-create path reaches this
        // whenever every requested thought already has a reaction row, which is routine when
        // the distributor re-selects the same hot thoughts.
        it('does not issue an empty query for an empty batch', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            const result = await store.create([]);

            expect(result).to.deep.equal([]);
            expect(mockStore.write.query.called).to.be.eq(false);
        });
    });

    describe('update', () => {
        it('generates update query with conditions', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.update(
                { thoughtId: 'thought-1', userId: 'user-1' },
                { userHasLiked: true },
            );

            const query = mockStore.write.query.args[0][0];
            expect(query).to.include('update "main"."thoughtReactions"');
            expect(query).to.include('"userHasLiked" = true');
            expect(query).to.include('"thoughtId" = \'thought-1\'');
            expect(query).to.include('"userId" = \'user-1\'');
            expect(query).to.include('returning *');
        });

        it('includes whereIn clause when provided', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.update(
                {},
                { userHasLiked: true },
                {
                    columns: ['userId', 'thoughtId'],
                    whereInArray: [['user-1', 'thought-1'], ['user-2', 'thought-2']],
                },
            );

            const query = mockStore.write.query.args[0][0];
            expect(query).to.include('("userId", "thoughtId") in');
            expect(query).to.include("'user-1'");
            expect(query).to.include("'thought-1'");
        });
    });

    describe('delete', () => {
        it('generates delete query', async () => {
            const mockStore = createMockStore();
            const store = new ThoughtReactionsStore(mockStore);

            store.delete('user-123');

            const query = mockStore.write.query.args[0][0];
            expect(query).to.include('delete from "main"."thoughtReactions"');
            expect(query).to.include('"userId" = \'user-123\'');
        });
    });
});
