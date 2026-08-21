/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations } from 'therr-js-utilities/constants';
import { ContentAlgorithms, getAlgorithmProfile } from 'therr-js-utilities/content-ranking';
import ThoughtsStore from '../../src/store/ThoughtsStore';

const buildMockConnection = () => {
    const readStub = sinon.stub().callsFake(() => Promise.resolve({ rows: [] }));
    const writeStub = sinon.stub().callsFake(() => Promise.resolve({ rows: [] }));
    return {
        connection: {
            read: { query: readStub } as any,
            write: { query: writeStub } as any,
        },
        readStub,
        writeStub,
    };
};

const stubUsersStore: any = {
    findUsers: () => Promise.resolve([]),
};

describe('ThoughtsStore brand filtering', () => {
    describe('search', () => {
        it('does NOT add a brand filter when caller is therr (allowlist=all)', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.search(BrandVariations.THERR, {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
            }, undefined as any, []);

            const sql = readStub.args[0][0] as string;
            expect(sql).to.not.include('brandVariation');
        });

        it('restricts to HABITS rows when caller is habits', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.search(BrandVariations.HABITS, {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
            }, undefined as any, []);

            const sql = readStub.args[0][0] as string;
            expect(sql).to.include(`"main"."thoughts"."brandVariation" in ('habits')`);
        });

        it('restricts to TEEM rows when caller is teem', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.search(BrandVariations.TEEM, {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
            }, undefined as any, []);

            const sql = readStub.args[0][0] as string;
            expect(sql).to.include(`"main"."thoughts"."brandVariation" in ('teem')`);
            expect(sql).to.not.include(`'habits'`);
        });

        it('falls back to a self-only allowlist for unknown brands', () => {
            // An unknown/empty brand should NEVER fall through to "see everything" —
            // the helper returns [brand] so the where clause is "brandVariation = '<unknown>'",
            // which matches no rows. This is the safe direction.
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.search('mystery-brand' as any, {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
            }, undefined as any, []);

            const sql = readStub.args[0][0] as string;
            expect(sql).to.include(`"main"."thoughts"."brandVariation" in ('mystery-brand')`);
        });
    });

    describe('find', () => {
        it('omits brand filter for therr (allowlist=all)', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.find(BrandVariations.THERR, [], { limit: 21, before: '2026-04-27T00:00:00.000Z' });

            const sql = readStub.args[0][0] as string;
            expect(sql).to.not.include('brandVariation');
        });

        it('applies brand filter for habits AND mirrors it onto the reply self-join', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.find(BrandVariations.HABITS, ['t1'], {
                limit: 21,
                before: '2026-04-27T00:00:00.000Z',
            }, { withReplies: true });

            const sql = readStub.args[0][0] as string;
            // Top-level brand filter
            expect(sql).to.include(`"main"."thoughts"."brandVariation" in ('habits')`);
            // Self-join brand filter (closing leak: HABITS reader must not see therr replies on a habits parent)
            expect(sql).to.include(`replies."brandVariation" IN ('habits')`);
        });

        it('caps reply previews via LATERAL and reports the true total as replyCount', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.find(BrandVariations.THERR, ['t1'], {
                limit: 21,
                before: '2026-04-27T00:00:00.000Z',
            }, { withReplies: true });

            const sql = readStub.args[0][0] as string;
            expect(sql).to.include('LEFT JOIN LATERAL');
            expect(sql).to.include('LIMIT 3');
            // Window count runs before LIMIT, so it reflects the full reply total
            expect(sql).to.include(`COUNT(*) OVER () AS "totalReplies"`);
            expect(sql).to.include(`"replies"."totalReplies" as "replyCount"`);
            // Preview fields needed to render an inline reply
            expect(sql).to.include(`"replies"."message" as "replies[].message"`);
            expect(sql).to.include(`"replies"."fromUserId" as "replies[].fromUserId"`);
        });

        it('pages parents before attaching reply previews (LIMIT applies to parents, not joined rows)', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.find(BrandVariations.THERR, ['t1'], {
                limit: 21,
                before: '2026-04-27T00:00:00.000Z',
            }, { withReplies: true });

            const sql = readStub.args[0][0] as string;
            // The parent page closes inside the subquery...
            expect(sql).to.include(`limit 21) as "parents"`);
            // ...and the lateral join hangs off the already-paged set
            expect(sql).to.include(`replies."parentId" = parents.id`);
            // No outer LIMIT that joined reply rows could consume
            const afterJoin = sql.slice(sql.indexOf('ON TRUE'));
            expect(afterJoin).to.not.include('limit');
        });

        it('computes isLastPage from parent count, not raw joined rows', async () => {
            // 2 parents x 3 reply-preview rows = 6 raw rows; with limit 5 the old
            // rows-based check (6 < 5) wrongly claimed another page exists
            const rows = ['p1', 'p2'].flatMap((id) => [1, 2, 3].map((n) => ({
                id,
                fromUserId: 'author-1',
                replyCount: '3',
                'replies[].id': `${id}-r${n}`,
                'replies[].fromUserId': 'replier-1',
                'replies[].message': 'a reply',
                'replies[].createdAt': '2026-04-26T00:00:00.000Z',
            })));
            const readStub = sinon.stub().callsFake(() => Promise.resolve({ rows }));
            const store = new ThoughtsStore({
                read: { query: readStub } as any,
                write: { query: sinon.stub() } as any,
            }, stubUsersStore);

            const result = await store.find(BrandVariations.THERR, ['p1', 'p2'], {
                limit: 5,
                before: '2026-04-27T00:00:00.000Z',
            }, { withReplies: true });

            expect(result.thoughts).to.have.length(2);
            expect(result.isLastPage).to.equal(true);
            expect(result.thoughts[0].replyCount).to.equal(3);
            expect(result.thoughts[0].replies).to.have.length(3);
        });

        it('does NOT filter reply previews on isPublic (visibility follows the parent)', () => {
            // Deliberate policy, not an oversight: clients mint every reply with
            // isPublic=false (TherrMobile ViewThought handleSubmitReply), so an isPublic
            // filter here would blank out every thread preview in the app.
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.find(BrandVariations.THERR, ['t1'], {
                limit: 21,
                before: '2026-04-27T00:00:00.000Z',
            }, { withReplies: true, shouldHideMatureContent: true });

            const sql = readStub.args[0][0] as string;
            expect(sql).to.not.include(`replies."isPublic" =`);
        });

        it('excludes mature replies from previews when shouldHideMatureContent is set', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.find(BrandVariations.THERR, ['t1'], {
                limit: 21,
                before: '2026-04-27T00:00:00.000Z',
            }, { withReplies: true, shouldHideMatureContent: true });

            const sql = readStub.args[0][0] as string;
            expect(sql).to.include(`replies."isMatureContent" = false`);
        });
    });

    describe('getRecentThoughts (activation candidates)', () => {
        it('ranks a bounded recent pool by reply-count hot score', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.getRecentThoughts(BrandVariations.THERR, 10);

            const sql = readStub.args[0][0] as string;
            // Inner query bounds the scan to an index-friendly recent pool
            expect(sql).to.include('limit 200');
            // Only parent thoughts compete for stream slots
            expect(sql).to.include(`"parentId" is null`);
            // Gravity-style hot score: engagement dampened by age
            expect(sql).to.include('("replyCount" + 1) / POWER');
            expect(sql).to.include('limit 10');
        });

        it('applies brand and interests filters to the candidate pool', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.getRecentThoughts(BrandVariations.HABITS, 5, ['interests.hiking']);

            const sql = readStub.args[0][0] as string;
            expect(sql).to.include(`"brandVariation" in ('habits')`);
            expect(sql).to.include('interests.hiking');
        });

        // The hot score used to exist only in the ORDER BY, so the ranking was thrown away
        // once candidates were chosen. It is now also selected, and the caller persists it
        // onto the reaction row as relevanceScore.
        it('returns the hot score so the ranking can outlive candidate selection', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.getRecentThoughts(BrandVariations.THERR, 10);

            const sql = readStub.args[0][0] as string;
            expect(sql).to.include('AS "hotScore"');
        });

        it('scores and orders by the identical expression', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.getRecentThoughts(BrandVariations.THERR, 10);

            const sql = readStub.args[0][0] as string;
            const scoreExpression = '("replyCount" + 1) / POWER(GREATEST(EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 3600, 0) + 2, 1.5)';
            // Selected value and sort key must be the same number, or the persisted score
            // would not explain the order the rows came back in.
            expect(sql).to.include(`${scoreExpression} AS "hotScore"`);
            expect(sql).to.include(`order by ${scoreExpression} DESC`);
        });

        // Regression: therr-ai-automator writes thoughts with a future createdAt to drip
        // content out between its runs. Those rows sort to the very top of a createdAt-DESC
        // pool, so they were always present. With an unclamped age the hot score computed
        // POWER(<negative>, 1.5), which Postgres raises as an ERROR rather than returning
        // NULL — aborting the query, tripping the catch in
        // TherrEventEmitter.runThoughtDistributorAlgorithm, and activating nothing at all.
        // Every user's feed then showed no new content until the last post-dated thought
        // aged into the past.
        it('excludes future-dated thoughts from the candidate pool', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.getRecentThoughts(BrandVariations.THERR, 10);

            const sql = readStub.args[0][0] as string;
            // Raw fragment, so the table name is not identifier-quoted the way knex's
            // builder-generated clauses are.
            expect(sql).to.include(`main.thoughts."createdAt" <= NOW()`);
        });

        it('clamps negative age so a future-dated row can never error the score', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.getRecentThoughts(BrandVariations.THERR, 10);

            const sql = readStub.args[0][0] as string;
            // POWER() must never see a negative base.
            expect(sql).to.include('POWER(GREATEST(');
            expect(sql).to.not.include('POWER((EXTRACT');
        });

        // Every assertion above calls getRecentThoughts with no profile, so they all describe
        // the PULSE default — that is deliberate. PULSE reproduces the pre-abstraction ranker
        // exactly, so those tests double as the regression that introducing selectable
        // algorithms did not move anybody's feed.
        describe('algorithm profiles', () => {
            it('leaves the default (PULSE) query byte-identical to an explicit PULSE profile', () => {
                const withDefault = buildMockConnection();
                new ThoughtsStore(withDefault.connection, stubUsersStore)
                    .getRecentThoughts(BrandVariations.THERR, 10, ['interests.hiking']);

                const withPulse = buildMockConnection();
                new ThoughtsStore(withPulse.connection, stubUsersStore)
                    .getRecentThoughts(BrandVariations.THERR, 10, ['interests.hiking'], ['id'], getAlgorithmProfile(ContentAlgorithms.PULSE));

                expect(withPulse.readStub.args[0][0]).to.equal(withDefault.readStub.args[0][0]);
            });

            it('widens the candidate pool under FOCUS', () => {
                const { connection, readStub } = buildMockConnection();
                new ThoughtsStore(connection, stubUsersStore)
                    .getRecentThoughts(BrandVariations.THERR, 10, [], ['id'], getAlgorithmProfile(ContentAlgorithms.FOCUS));

                const sql = readStub.args[0][0] as string;
                expect(sql).to.include('limit 300');
                expect(sql).to.not.include('limit 200');
            });

            it('caps candidates per author under FOCUS, ranked by score so authors keep their best', () => {
                const { connection, readStub } = buildMockConnection();
                new ThoughtsStore(connection, stubUsersStore)
                    .getRecentThoughts(BrandVariations.THERR, 10, [], ['id'], getAlgorithmProfile(ContentAlgorithms.FOCUS));

                const sql = readStub.args[0][0] as string;
                expect(sql).to.include('ROW_NUMBER() OVER (PARTITION BY "fromUserId" ORDER BY');
                expect(sql).to.include('"authorRank" <= 2');
                // fromUserId has to reach the window function through the candidate subquery.
                expect(sql).to.include('"fromUserId"');
            });

            it('emits no author-diversity layer at all under PULSE (uncapped, as production was)', () => {
                const { connection, readStub } = buildMockConnection();
                new ThoughtsStore(connection, stubUsersStore)
                    .getRecentThoughts(BrandVariations.THERR, 10, [], ['id'], getAlgorithmProfile(ContentAlgorithms.PULSE));

                const sql = readStub.args[0][0] as string;
                expect(sql).to.not.include('ROW_NUMBER()');
                expect(sql).to.not.include('authorRank');
            });

            it('adds nothing to the query when no location is supplied', () => {
                const withoutLocation = buildMockConnection();
                new ThoughtsStore(withoutLocation.connection, stubUsersStore)
                    .getRecentThoughts(BrandVariations.THERR, 10, [], ['id'], getAlgorithmProfile(ContentAlgorithms.PULSE));

                const sql = withoutLocation.readStub.args[0][0] as string;
                // A surface with no coordinates must emit no geo SQL at all, not a distance
                // term multiplied by zero — that is what keeps PULSE byte-identical.
                expect(sql).to.not.include('ST_DWithin');
                expect(sql).to.not.include('ST_Distance');
                expect(sql).to.not.include('latitude');
            });

            it('bounds a local query by an indexable box before the exact distance test', () => {
                const { connection, readStub } = buildMockConnection();
                new ThoughtsStore(connection, stubUsersStore)
                    .getRecentThoughts(BrandVariations.THERR, 10, [], ['id'], getAlgorithmProfile(ContentAlgorithms.PULSE), {
                        latitude: 41.8781,
                        longitude: -87.6298,
                        radiusMeters: 60000,
                    });

                const sql = readStub.args[0][0] as string;
                // The box is what the partial (latitude, longitude) index can serve. Without
                // it, ST_DWithin alone sequentially scans every thought ever posted.
                expect(sql).to.include('"main"."thoughts"."latitude" between');
                expect(sql).to.include('"main"."thoughts"."longitude" between');
                // And the exact test trims the corners of the box that fall outside the circle.
                expect(sql).to.include('ST_DWithin(');
                expect(sql).to.include('60000');
                // A NULL latitude can never satisfy the distance test, so it is excluded up front.
                expect(sql).to.include('"main"."thoughts"."latitude" is not null');
            });

            it('passes the point as longitude-then-latitude, the order PostGIS expects', () => {
                const { connection, readStub } = buildMockConnection();
                new ThoughtsStore(connection, stubUsersStore)
                    .getRecentThoughts(BrandVariations.THERR, 10, [], ['id'], getAlgorithmProfile(ContentAlgorithms.PULSE), {
                        latitude: 41.8781,
                        longitude: -87.6298,
                        radiusMeters: 60000,
                    });

                const sql = readStub.args[0][0] as string;
                // Swapping these silently searches the wrong hemisphere rather than failing.
                expect(sql).to.include('ST_MakePoint(-87.6298, 41.8781)');
                expect(sql).to.include('ST_MakePoint(main.thoughts."longitude", main.thoughts."latitude")');
            });

            it('feeds the distance into the score for a profile that weighs geo, by alias', () => {
                const { connection, readStub } = buildMockConnection();
                new ThoughtsStore(connection, stubUsersStore)
                    .getRecentThoughts(BrandVariations.THERR, 10, [], ['id'], getAlgorithmProfile(ContentAlgorithms.WANDER), {
                        latitude: 41.8781,
                        longitude: -87.6298,
                        radiusMeters: 25000,
                    });

                const sql = readStub.args[0][0] as string;
                // Computed once in the candidate query and referenced by alias in the score,
                // so the SELECTed value and the ORDER BY cannot drift apart.
                expect(sql).to.include('AS "distanceMeters"');
                expect(sql).to.include('EXP(-1 * GREATEST("distanceMeters", 0)');
            });

            it('still emits no geo term for a zero-geo-weight profile, even with a location', () => {
                const { connection, readStub } = buildMockConnection();
                new ThoughtsStore(connection, stubUsersStore)
                    .getRecentThoughts(BrandVariations.THERR, 10, [], ['id'], getAlgorithmProfile(ContentAlgorithms.PULSE), {
                        latitude: 41.8781,
                        longitude: -87.6298,
                        radiusMeters: 60000,
                    });

                const sql = readStub.args[0][0] as string;
                // PULSE selects local candidates but ranks them on hotness; the boost that
                // lifts them happens at activation, not in this query.
                expect(sql).to.not.include('EXP(');
            });

            it('ignores an unusable point rather than emitting NaN into SQL', () => {
                const { connection, readStub } = buildMockConnection();
                new ThoughtsStore(connection, stubUsersStore)
                    .getRecentThoughts(BrandVariations.THERR, 10, [], ['id'], getAlgorithmProfile(ContentAlgorithms.PULSE), {
                        latitude: Number.NaN,
                        longitude: -87.6298,
                        radiusMeters: 60000,
                    });

                const sql = readStub.args[0][0] as string;
                // main.userLocations.latitude is nullable, so a half-written row reaches this
                // on the feed's hot path. Degrading to the ordinary query beats a query that
                // errors or matches nothing.
                expect(sql).to.not.include('NaN');
                expect(sql).to.not.include('ST_DWithin');
            });

            it('drops only the longitude bound for a box that wraps the antimeridian', () => {
                const { connection, readStub } = buildMockConnection();
                new ThoughtsStore(connection, stubUsersStore)
                    .getRecentThoughts(BrandVariations.THERR, 10, [], ['id'], getAlgorithmProfile(ContentAlgorithms.PULSE), {
                        latitude: -16.5,
                        longitude: 179.9,
                        radiusMeters: 60000,
                    });

                const sql = readStub.args[0][0] as string;
                // A wrapped range has min > max, so BETWEEN would match nothing at all.
                expect(sql).to.not.include('"main"."thoughts"."longitude" between');
                expect(sql).to.include('"main"."thoughts"."latitude" between');
                expect(sql).to.include('ST_DWithin(');
            });

            it('keeps the clamp and the score/order agreement under FOCUS too', () => {
                const { connection, readStub } = buildMockConnection();
                new ThoughtsStore(connection, stubUsersStore)
                    .getRecentThoughts(BrandVariations.THERR, 10, [], ['id'], getAlgorithmProfile(ContentAlgorithms.FOCUS));

                const sql = readStub.args[0][0] as string;
                expect(sql).to.include('POWER(GREATEST(');
                expect(sql).to.not.include('POWER((EXTRACT');
                // FOCUS dampens engagement to 0.2 and softens gravity to 1.2.
                expect(sql).to.include('(0.2 * "replyCount")');
                expect(sql).to.include(', 1.2)');
            });
        });
    });

    describe('search (deterministic ordering)', () => {
        // This query previously had no ORDER BY at all, which makes LIMIT/OFFSET paging
        // unsound: Postgres may return rows in any order, so pages can repeat and skip.
        it('orders by an indexed column with an id tiebreak', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.search(BrandVariations.THERR, {
                pagination: { itemsPerPage: 20, pageNumber: 1 },
            }, ['id']);

            const sql = readStub.args[0][0] as string;
            expect(sql).to.include('order by "main"."thoughts"."createdAt" desc, "main"."thoughts"."id" desc');
            // updatedAt is unindexed and was measured as slow — it must stay out of the sort.
            expect(sql).to.not.include('"updatedAt" desc');
        });
    });

    describe('getById', () => {
        it('applies brand filter and mirrors onto reply self-join when habits', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.getById(BrandVariations.HABITS, 'thought-1', {}, { withReplies: true });

            const sql = readStub.args[0][0] as string;
            expect(sql).to.include(`"main"."thoughts"."brandVariation" in ('habits')`);
            expect(sql).to.include(`replies."brandVariation" IN ('habits')`);
        });

        it('does not filter by brand for therr', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.getById(BrandVariations.THERR, 'thought-1', {}, { withReplies: true });

            const sql = readStub.args[0][0] as string;
            expect(sql).to.not.include('brandVariation');
        });

        it('selects a nested reply count per reply, brand-restricted to match the reply join', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.getById(BrandVariations.HABITS, 'thought-1', {}, { withReplies: true });

            const sql = readStub.args[0][0] as string;
            expect(sql).to.include('SELECT COUNT(*) FROM main.thoughts AS nested WHERE nested."parentId" = replies.id');
            expect(sql).to.include(`nested."brandVariation" IN ('habits')`);
            expect(sql).to.include('"replies[].replyCount"');
        });

        it('does not select a nested reply count when replies are not requested', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.getById(BrandVariations.THERR, 'thought-1', {}, {});

            const sql = readStub.args[0][0] as string;
            expect(sql).to.not.include('replyCount');
        });

        it('coerces the nested reply count from a pg bigint string to a number', async () => {
            const { connection, readStub } = buildMockConnection();
            readStub.callsFake(() => Promise.resolve({
                rows: [{
                    id: 'thought-1',
                    'replies[].id': 'reply-1',
                    'replies[].replyCount': '3',
                }, {
                    id: 'thought-1',
                    'replies[].id': 'reply-2',
                    'replies[].replyCount': '0',
                }],
            }));
            const store = new ThoughtsStore(connection, stubUsersStore);

            const { thoughts } = await store.getById(BrandVariations.THERR, 'thought-1', {}, { withReplies: true });

            expect(thoughts[0].replies[0].replyCount).to.equal(3);
            expect(thoughts[0].replies[1].replyCount).to.equal(0);
        });

        it('nulls the nested reply count when the left join produced no reply', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.getById(BrandVariations.THERR, 'thought-1', {}, { withReplies: true });

            const sql = readStub.args[0][0] as string;
            // Without this, COUNT(*) returns 0 (never NULL) on the all-NULL join row, which
            // formatSQLJoinAsJSON reads as proof a reply exists.
            expect(sql).to.include('CASE WHEN replies.id IS NULL THEN NULL ELSE');
        });

        it('returns no replies for a thought that has none (no phantom reply row)', async () => {
            const { connection, readStub } = buildMockConnection();
            // The shape pg returns for a left join that matched nothing.
            readStub.callsFake(() => Promise.resolve({
                rows: [{
                    id: 'thought-1',
                    message: 'a reply with no replies of its own',
                    'replies[].replyCount': null,
                    'replies[].id': null,
                    'replies[].message': null,
                }],
            }));
            const store = new ThoughtsStore(connection, stubUsersStore);

            const { thoughts } = await store.getById(BrandVariations.THERR, 'thought-1', {}, { withReplies: true });

            expect(thoughts[0].replies).to.deep.equal([]);
        });

        it('drops id-less reply rows even if a column sneaks through as non-null', async () => {
            const { connection, readStub } = buildMockConnection();
            readStub.callsFake(() => Promise.resolve({
                rows: [{
                    id: 'thought-1',
                    'replies[].replyCount': '0',
                    'replies[].id': null,
                }],
            }));
            const store = new ThoughtsStore(connection, stubUsersStore);

            const { thoughts } = await store.getById(BrandVariations.THERR, 'thought-1', {}, { withReplies: true });

            expect(thoughts[0].replies).to.deep.equal([]);
        });
    });

    describe('getById (parent thread context)', () => {
        const buildParentAwareStub = (parentRow?: any) => {
            const { connection, readStub } = buildMockConnection();
            readStub.onFirstCall().callsFake(() => Promise.resolve({
                rows: [{
                    id: 'reply-1',
                    parentId: 'thought-1',
                    fromUserId: '22',
                    message: 'a reply',
                }],
            }));
            readStub.onSecondCall().callsFake(() => Promise.resolve({
                rows: parentRow ? [parentRow] : [],
            }));

            return { connection, readStub };
        };

        it('does not query for a parent when withParent is not requested', async () => {
            const { connection, readStub } = buildParentAwareStub({ id: 'thought-1' });
            const store = new ThoughtsStore(connection, stubUsersStore);

            const { thoughts } = await store.getById(BrandVariations.THERR, 'reply-1', {}, {});

            expect(readStub.callCount).to.equal(1);
            expect(thoughts[0].parent).to.equal(undefined);
        });

        it('attaches the parent thought when the thought is a reply', async () => {
            const { connection, readStub } = buildParentAwareStub({
                id: 'thought-1',
                parentId: null,
                fromUserId: '11',
                message: 'the original thought',
            });
            const store = new ThoughtsStore(connection, stubUsersStore);

            const { thoughts } = await store.getById(BrandVariations.THERR, 'reply-1', {}, { withParent: true });

            expect(readStub.callCount).to.equal(2);
            expect(readStub.args[1][0]).to.include('in (\'thought-1\')');
            expect(thoughts[0].parent.id).to.equal('thought-1');
            expect(thoughts[0].parent.message).to.equal('the original thought');
        });

        it('restricts the parent lookup to the caller brand', async () => {
            const { connection, readStub } = buildParentAwareStub();
            const store = new ThoughtsStore(connection, stubUsersStore);

            await store.getById(BrandVariations.HABITS, 'reply-1', {}, { withParent: true });

            // Mirrors the reply join: a habits reader must not be linked up to a therr parent.
            expect(readStub.args[1][0]).to.include('"brandVariation" in (\'habits\')');
        });

        it('leaves parent undefined when the parent is filtered out or deleted', async () => {
            const { connection } = buildParentAwareStub();
            const store = new ThoughtsStore(connection, stubUsersStore);

            const { thoughts } = await store.getById(BrandVariations.HABITS, 'reply-1', {}, { withParent: true });

            expect(thoughts[0].parent).to.equal(undefined);
        });

        it('does not query for a parent on a root thought', async () => {
            const { connection, readStub } = buildMockConnection();
            readStub.callsFake(() => Promise.resolve({
                rows: [{ id: 'thought-1', parentId: null }],
            }));
            const store = new ThoughtsStore(connection, stubUsersStore);

            await store.getById(BrandVariations.THERR, 'thought-1', {}, { withParent: true });

            expect(readStub.callCount).to.equal(1);
        });

        it('hydrates the parent author even when the reply author is missing', async () => {
            const { connection } = buildParentAwareStub({
                id: 'thought-1',
                fromUserId: '11',
                message: 'the original thought',
            });
            const usersStore: any = {
                findUsers: () => Promise.resolve([{
                    id: '11',
                    userName: 'original-poster',
                    media: { profilePicture: 'pic' },
                }]),
            };
            const store = new ThoughtsStore(connection, usersStore);

            const { thoughts } = await store.getById(BrandVariations.THERR, 'reply-1', {}, {
                withUser: true,
                withParent: true,
            });

            expect(thoughts[0].fromUserName).to.equal(undefined);
            expect(thoughts[0].parent.fromUserName).to.equal('original-poster');
        });
    });

    describe('create', () => {
        it('stamps the row with the caller brand on insert (habits)', () => {
            const { connection, writeStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.create(BrandVariations.HABITS, {
                fromUserId: 1 as any,
                locale: 'en-us',
                message: 'hello',
            });

            const sql = writeStub.args[0][0] as string;
            expect(sql).to.include(`"brandVariation"`);
            expect(sql).to.include(`'habits'`);
        });

        it('stamps the row with therr when caller is therr (legacy default behavior)', () => {
            // Simulates a legacy token (no x-brand-variation header) that getBrandContext
            // resolved to THERR. The insert MUST stamp 'therr' so the row stays visible to Therr.
            const { connection, writeStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.create(BrandVariations.THERR, {
                fromUserId: 1 as any,
                locale: 'en-us',
                message: 'hello legacy',
            });

            const sql = writeStub.args[0][0] as string;
            expect(sql).to.include(`'therr'`);
        });
    });

    describe('get (duplicate check)', () => {
        it('scopes the duplicate check to the caller brand for habits', () => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.get(BrandVariations.HABITS, {
                fromUserId: 1,
                message: 'hi',
            });

            const sql = readStub.args[0][0] as string;
            expect(sql).to.include(`"main"."thoughts"."brandVariation" in ('habits')`);
        });
    });

    describe('getForJournal', () => {
        const runQuery = (brand: BrandVariations, before: any = null, limit = 51) => {
            const { connection, readStub } = buildMockConnection();
            const store = new ThoughtsStore(connection, stubUsersStore);
            store.getForJournal(brand, 'user-1', before, limit);

            return readStub.args[0][0] as string;
        };

        it('scopes the journal to the caller brand', () => {
            // Unscoped, a HABITS journal would list the user's Therr posts.
            expect(runQuery(BrandVariations.HABITS))
                .to.include(`"main"."thoughts"."brandVariation" in ('habits')`);
        });

        it('returns only the requesting user\'s own top-level posts', () => {
            const sql = runQuery(BrandVariations.HABITS);

            expect(sql).to.include(`"main"."thoughts"."fromUserId" = 'user-1'`);
            // Replies are comments on someone else's post, not goals.
            expect(sql).to.include(`"main"."thoughts"."parentId" is null`);
            expect(sql).to.include(`"main"."thoughts"."isMatureContent" = false`);
        });

        it('excludes future-dated rows', () => {
            // therr-ai-automator drips a run's output out over ~30h by writing
            // future-dated thoughts. A journal must not open a section headed
            // with tomorrow's date.
            expect(runQuery(BrandVariations.HABITS)).to.include(`main.thoughts."createdAt" <= now()`);
        });

        it('orders on (createdAt, id) under C collation so it agrees with the handler merge', () => {
            // The handler re-sorts these rows together with the habits half and
            // compares ids by code point. A locale collation would order the
            // dashes in a uuid differently and let the two halves disagree about
            // what falls after the cursor — silently dropping a row.
            const sql = runQuery(BrandVariations.HABITS);

            expect(sql).to.include(`order by main.thoughts."createdAt" DESC, main.thoughts."id"::text COLLATE "C" DESC`);
            expect(sql).to.include('limit 51');
        });

        it('applies a compound cursor on both legs of the ordering', () => {
            const sql = runQuery(BrandVariations.HABITS, {
                occurredAt: '2026-08-12T00:00:00.000Z',
                id: 'thought-9',
            });

            expect(sql).to.include(`main.thoughts."createdAt" < '2026-08-12T00:00:00.000Z'::timestamptz`);
            expect(sql).to.include(`main.thoughts."id"::text COLLATE "C" < 'thought-9'`);
        });

        it('treats a bare-ISO cursor as timestamp-exclusive', () => {
            // A client mid-scroll across a deploy still holds one; it must keep
            // paging rather than compare against a null id.
            const sql = runQuery(BrandVariations.HABITS, {
                occurredAt: '2026-08-12T00:00:00.000Z',
                id: null,
            });

            expect(sql).to.include(`main.thoughts."createdAt" < '2026-08-12T00:00:00.000Z'::timestamptz`);
            expect(sql).to.not.include('COLLATE "C" <');
        });
    });
});
