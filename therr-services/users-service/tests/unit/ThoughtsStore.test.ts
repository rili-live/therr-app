/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations } from 'therr-js-utilities/constants';
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
});
