/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import ForumsStore from '../../src/store/ForumsStore';
import ForumMessagesStore from '../../src/store/ForumMessagesStore';
import ForumReadStatesStore, { FORUM_READ_TRACKING_STARTED_AT } from '../../src/store/ForumReadStatesStore';
import ForumReportsStore, { FORUM_REPORT_HIDE_THRESHOLD } from '../../src/store/ForumReportsStore';
import * as usersService from '../../src/api/usersService';
import { markForumRead, reportForum, searchForums } from '../../src/handlers/forums';

const FORUM_ID = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const OTHER_FORUM_ID = '7a2d3b4c-5e6f-4a71-9b8c-0d1e2f3a4b5c';
const VIEWER_ID = '11111111-2222-4333-8444-555555555555';
const AUTHOR_ID = '99999999-8888-4777-8666-555555555555';

const buildMockDb = (rows: any[] = [], rowCount = 0) => ({
    read: { query: sinon.stub().callsFake(() => Promise.resolve({ rows, rowCount })) },
    write: { query: sinon.stub().callsFake(() => Promise.resolve({ rows, rowCount })) },
});

const buildMockRes = () => {
    const res: any = {};
    res.status = sinon.stub().returns(res);
    res.send = sinon.stub().returns(res);
    return res;
};

const authedHeaders = {
    'x-userid': VIEWER_ID,
    'x-localecode': 'en-us',
    'x-brand-variation': 'therr',
};

// Handlers return the promise chain, so awaiting the call is enough to observe the response.
const run = (handler: any, req: any) => {
    const res = buildMockRes();
    return Promise.resolve(handler(req, res, () => {})).then(() => res);
};

describe('Groups: read state, reports and Discover ranking', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('ForumReadStatesStore.markRead', () => {
        it('upserts and keeps the later watermark so a stale device cannot un-read', async () => {
            const mockDb = buildMockDb([{ lastReadAt: '2026-11-20T00:00:00.000Z' }]);
            const store = new ForumReadStatesStore(mockDb as any);
            await store.markRead(FORUM_ID, VIEWER_ID, new Date('2026-11-20T00:00:00.000Z'));

            const sql = mockDb.write.query.args[0][0];
            expect(sql).to.contain('insert into "main"."forumReadStates"');
            expect(sql).to.contain('on conflict ("userId", "forumId") do update');
            expect(sql).to.contain('GREATEST("forumReadStates"."lastReadAt", EXCLUDED."lastReadAt")');
        });

        it('deletes only the given user\'s rows', async () => {
            const mockDb = buildMockDb();
            const store = new ForumReadStatesStore(mockDb as any);
            await store.deleteByUserId(VIEWER_ID);

            expect(mockDb.write.query.args[0][0]).to.equal(`delete from "main"."forumReadStates" where "userId" = '${VIEWER_ID}'`);
        });
    });

    describe('ForumReportsStore', () => {
        it('ignores a repeat report from the same person instead of failing', async () => {
            const mockDb = buildMockDb([], 0);
            const store = new ForumReportsStore(mockDb as any);
            const isNew = await store.create(FORUM_ID, VIEWER_ID, 'spam');

            expect(mockDb.write.query.args[0][0]).to.contain('on conflict ("forumId", "reportedByUserId") do nothing');
            expect(isNew).to.equal(false);
        });

        it('hides groups with enough distinct reporters, plus those the viewer reported', async () => {
            const mockDb = buildMockDb([{ forumId: FORUM_ID }]);
            const store = new ForumReportsStore(mockDb as any);
            const ids = await store.getHiddenFromDiscoverIds(VIEWER_ID);

            const sql = mockDb.read.query.args[0][0];
            expect(sql).to.equal(`select "forumId" from "main"."forumReports" group by "forumId" having COUNT(*) >= ${FORUM_REPORT_HIDE_THRESHOLD} OR BOOL_OR("reportedByUserId" = '${VIEWER_ID}')`);
            expect(ids).to.deep.equal([FORUM_ID]);
        });

        // Regression: an earlier UNION form let knex attach the HAVING to the viewer branch only,
        // so the first branch returned every group with any report and one report hid a group for all.
        it('applies the threshold to every group, never a bare list of reported groups', async () => {
            const mockDb = buildMockDb();
            const store = new ForumReportsStore(mockDb as any);
            await store.getHiddenFromDiscoverIds();

            const sql = mockDb.read.query.args[0][0];
            expect(sql).to.equal(`select "forumId" from "main"."forumReports" group by "forumId" having COUNT(*) >= ${FORUM_REPORT_HIDE_THRESHOLD}`);
            expect(sql).to.not.contain('union');
        });
    });

    describe('ForumMessagesStore inbox queries', () => {
        it('reads the newest message per forum with DISTINCT ON, scoped to the brand', async () => {
            const mockDb = buildMockDb();
            const store = new ForumMessagesStore(mockDb as any);
            await store.getLatestByForums('therr', [FORUM_ID, OTHER_FORUM_ID]);

            const sql = mockDb.read.query.args[0][0];
            expect(sql).to.contain('select distinct on ("main"."forumMessages"."forumId")');
            expect(sql).to.contain(`"main"."forumMessages"."brandVariation" = 'therr'`);
            expect(sql).to.contain('"main"."forumMessages"."isAnnouncement" = false');
            expect(sql).to.contain('order by "main"."forumMessages"."forumId" asc, "main"."forumMessages"."createdAt" desc');
        });

        it('skips the query for an empty forum list', async () => {
            const mockDb = buildMockDb();
            const store = new ForumMessagesStore(mockDb as any);
            const rows = await store.getLatestByForums('therr', []);

            expect(rows).to.deep.equal([]);
            expect(mockDb.read.query.called).to.equal(false);
        });

        it('counts only others\' messages newer than the watermark, falling back for members with no row', async () => {
            const mockDb = buildMockDb([{ forumId: FORUM_ID, count: '4' }]);
            const store = new ForumMessagesStore(mockDb as any);
            const counts = await store.countUnreadByForum('therr', [FORUM_ID], VIEWER_ID, FORUM_READ_TRACKING_STARTED_AT);

            const sql = mockDb.read.query.args[0][0];
            expect(sql).to.contain('left join "main"."forumReadStates"');
            expect(sql).to.contain(`"main"."forumReadStates"."userId" = '${VIEWER_ID}'`);
            expect(sql).to.contain(`"main"."forumMessages"."fromUserId" <> '${VIEWER_ID}'`);
            expect(sql).to.contain(`"main"."forumMessages"."createdAt" > COALESCE("main"."forumReadStates"."lastReadAt", '${FORUM_READ_TRACKING_STARTED_AT.toISOString()}'::timestamptz)`);
            expect(counts).to.deep.equal({ [FORUM_ID]: 4 });
        });
    });

    describe('ForumsStore.searchForums ranking', () => {
        const conditions = { pagination: { itemsPerPage: 50, pageNumber: 1 }, order: 'desc' };

        it('ranks Discover by distinct recent posters, then recent messages, then last edit', async () => {
            const mockDb = buildMockDb();
            const store = new ForumsStore(mockDb as any);
            await store.searchForums('therr', conditions, [], { rankByActivity: true, excludeForumIds: [FORUM_ID] });

            const sql = mockDb.read.query.args[0][0];
            expect(sql).to.contain('count(distinct "main"."forumMessages"."fromUserId") as "activePosters"');
            expect(sql).to.contain(`INTERVAL '30 days'`);
            expect(sql).to.contain('order by COALESCE("forumActivity"."activePosters", 0) DESC, COALESCE("forumActivity"."recentMessages", 0) DESC, "main"."forums"."updatedAt" desc, "main"."forums"."id" asc');
            expect(sql).to.contain(`"main"."forums"."id" not in ('${FORUM_ID}')`);
        });

        it('keeps the last-edit order when not ranking (Your Groups)', async () => {
            const mockDb = buildMockDb();
            const store = new ForumsStore(mockDb as any);
            await store.searchForums('therr', conditions, [], { forumIds: [FORUM_ID] });

            const sql = mockDb.read.query.args[0][0];
            expect(sql).to.not.contain('forumActivity');
            expect(sql).to.contain('order by "main"."forums"."updatedAt" desc, "main"."forums"."id" asc');
        });
    });

    describe('reportForum handler', () => {
        it('rejects an id that is not a UUID without touching the database', async () => {
            const getForumStub = sinon.stub(Store.forums, 'getForum');
            const res = await run(reportForum, { headers: authedHeaders, params: { forumId: 'not-a-uuid' }, body: {} });

            expect(res.status.args[0][0]).to.equal(404);
            expect(getForumStub.called).to.equal(false);
        });

        it('refuses to let the creator report their own group', async () => {
            sinon.stub(Store.forums, 'getForum').resolves([{ id: FORUM_ID, authorId: VIEWER_ID }]);
            const createStub = sinon.stub(Store.forumReports, 'create');
            const res = await run(reportForum, { headers: authedHeaders, params: { forumId: FORUM_ID }, body: {} });

            expect(res.status.args[0][0]).to.equal(400);
            expect(createStub.called).to.equal(false);
        });

        it('records the report, dropping an unknown reason', async () => {
            sinon.stub(Store.forums, 'getForum').resolves([{ id: FORUM_ID, authorId: AUTHOR_ID }]);
            const createStub = sinon.stub(Store.forumReports, 'create').resolves(true);
            sinon.stub(Store.forumReports, 'countReporters').resolves(1);
            const res = await run(reportForum, { headers: authedHeaders, params: { forumId: FORUM_ID }, body: { reason: 'free-text' } });

            expect(createStub.calledOnceWith(FORUM_ID, VIEWER_ID, undefined)).to.equal(true);
            expect(res.status.args[0][0]).to.equal(200);
            expect(res.send.args[0][0]).to.deep.equal({ forumId: FORUM_ID, isReported: true });
        });

        it('passes a known reason through', async () => {
            sinon.stub(Store.forums, 'getForum').resolves([{ id: FORUM_ID, authorId: AUTHOR_ID }]);
            const createStub = sinon.stub(Store.forumReports, 'create').resolves(true);
            sinon.stub(Store.forumReports, 'countReporters').resolves(3);
            await run(reportForum, { headers: authedHeaders, params: { forumId: FORUM_ID }, body: { reason: 'scam' } });

            expect(createStub.calledOnceWith(FORUM_ID, VIEWER_ID, 'scam')).to.equal(true);
        });
    });

    describe('markForumRead handler', () => {
        it('404s for a group that does not exist in this brand', async () => {
            sinon.stub(Store.forums, 'getForum').resolves([]);
            const markStub = sinon.stub(Store.forumReadStates, 'markRead');
            const res = await run(markForumRead, { headers: authedHeaders, params: { forumId: FORUM_ID } });

            expect(res.status.args[0][0]).to.equal(404);
            expect(markStub.called).to.equal(false);
        });

        it('moves the caller\'s watermark', async () => {
            sinon.stub(Store.forums, 'getForum').resolves([{ id: FORUM_ID }]);
            const markStub = sinon.stub(Store.forumReadStates, 'markRead').resolves(new Date('2026-11-20T00:00:00.000Z'));
            const res = await run(markForumRead, { headers: authedHeaders, params: { forumId: FORUM_ID } });

            expect(markStub.calledOnceWith(FORUM_ID, VIEWER_ID)).to.equal(true);
            expect(res.status.args[0][0]).to.equal(200);
        });
    });

    describe('searchForums handler', () => {
        const stubUsersService = (userGroups: any[]) => {
            sinon.stub(usersService, 'getUserForums').resolves({ data: { userGroups } } as any);
            sinon.stub(usersService, 'findUsers').resolves({ data: [{ id: AUTHOR_ID, userName: 'alex' }] } as any);
            sinon.stub(usersService, 'countForumMembers').resolves({ data: { [FORUM_ID]: 5, [OTHER_FORUM_ID]: 2 } } as any);
        };

        it('Your Groups: attaches the last message and unread count, newest activity first', async () => {
            stubUsersService([
                { groupId: FORUM_ID, status: 'approved' },
                { groupId: OTHER_FORUM_ID, status: 'approved' },
            ]);
            sinon.stub(Store.forums, 'searchForums').callsFake((brand, cond, ret, options: any) => Promise.resolve(options.usersInvitedForumIds
                ? []
                : [
                    {
                        id: FORUM_ID, authorId: AUTHOR_ID, isPublic: true, createdAt: new Date('2026-01-01T00:00:00Z'),
                    },
                    {
                        id: OTHER_FORUM_ID, authorId: AUTHOR_ID, isPublic: true, createdAt: new Date('2026-01-02T00:00:00Z'),
                    },
                ]));
            sinon.stub(Store.forumMessages, 'getLatestByForums').resolves([
                {
                    forumId: FORUM_ID, id: 'm1', message: 'See you Friday', fromUserId: AUTHOR_ID, createdAt: new Date('2026-11-18T10:00:00Z'),
                },
            ]);
            const unreadStub = sinon.stub(Store.forumMessages, 'countUnreadByForum').resolves({ [FORUM_ID]: 3 });

            const res = await run(searchForums, {
                headers: authedHeaders,
                query: { itemsPerPage: 50, pageNumber: 1 },
                body: { forumIds: [FORUM_ID, OTHER_FORUM_ID] },
            });

            const { results } = res.send.args[0][0];
            expect(results.map((r) => r.id)).to.deep.equal([FORUM_ID, OTHER_FORUM_ID]);
            expect(results[0].unreadCount).to.equal(3);
            expect(results[0].lastMessage).to.include({ text: 'See you Friday', fromUserId: AUTHOR_ID, fromUserName: 'alex' });
            expect(results[1].unreadCount).to.equal(0);
            expect(results[1].lastMessage).to.equal(null);
            expect(unreadStub.args[0][3]).to.equal(FORUM_READ_TRACKING_STARTED_AT);
        });

        it('Your Groups: still answers when the inbox queries fail (migration not yet run)', async () => {
            stubUsersService([{ groupId: FORUM_ID, status: 'approved' }]);
            sinon.stub(Store.forums, 'searchForums').callsFake((brand, cond, ret, options: any) => Promise.resolve(options.usersInvitedForumIds
                ? []
                : [{
                    id: FORUM_ID, authorId: AUTHOR_ID, isPublic: true, createdAt: new Date(),
                }]));
            sinon.stub(Store.forumMessages, 'getLatestByForums').resolves([]);
            sinon.stub(Store.forumMessages, 'countUnreadByForum').rejects(new Error('relation "main.forumReadStates" does not exist'));

            const res = await run(searchForums, {
                headers: authedHeaders,
                query: { itemsPerPage: 50, pageNumber: 1 },
                body: { forumIds: [FORUM_ID] },
            });

            expect(res.status.args[0][0]).to.equal(200);
            expect(res.send.args[0][0].results[0].id).to.equal(FORUM_ID);
        });

        it('Discover: ranks by activity, excludes reported groups, and moves joined groups to the end', async () => {
            stubUsersService([{ groupId: FORUM_ID, status: 'approved' }]);
            sinon.stub(Store.forumReports, 'getHiddenFromDiscoverIds').resolves(['spam-id']);
            const searchStub = sinon.stub(Store.forums, 'searchForums').callsFake((brand, cond, ret, options: any) => Promise.resolve(options.usersInvitedForumIds
                ? []
                : [
                    {
                        id: FORUM_ID, authorId: AUTHOR_ID, isPublic: true, createdAt: new Date(),
                    },
                    {
                        id: OTHER_FORUM_ID, authorId: AUTHOR_ID, isPublic: true, createdAt: new Date(),
                    },
                ]));

            const res = await run(searchForums, {
                headers: authedHeaders,
                query: { itemsPerPage: 50, pageNumber: 1 },
                body: {},
            });

            const discoverCall = searchStub.getCalls().find((call) => !(call.args[3] as any).usersInvitedForumIds);
            expect((discoverCall?.args[3] as any).rankByActivity).to.equal(true);
            expect((discoverCall?.args[3] as any).excludeForumIds).to.deep.equal(['spam-id']);
            expect(res.send.args[0][0].results.map((r) => r.id)).to.deep.equal([OTHER_FORUM_ID, FORUM_ID]);
        });

        it('Discover: falls back to an unfiltered list when the reports table is unavailable', async () => {
            stubUsersService([]);
            sinon.stub(Store.forumReports, 'getHiddenFromDiscoverIds').rejects(new Error('relation does not exist'));
            const searchStub = sinon.stub(Store.forums, 'searchForums').resolves([]);

            const res = await run(searchForums, {
                headers: authedHeaders,
                query: { itemsPerPage: 50, pageNumber: 1 },
                body: {},
            });

            expect(res.status.args[0][0]).to.equal(200);
            const discoverCall = searchStub.getCalls().find((call) => !(call.args[3] as any).usersInvitedForumIds);
            expect((discoverCall?.args[3] as any).excludeForumIds).to.deep.equal([]);
        });
    });
});
