/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import DirectMessagesStore from '../../src/store/DirectMessagesStore';
import ForumMessagesStore from '../../src/store/ForumMessagesStore';
import ForumsStore from '../../src/store/ForumsStore';
import Store from '../../src/store';
import deleteUserData from '../../src/handlers/deleteUserData';
import { SUPER_ADMIN_ID } from '../../src/constants';

const buildMockDb = () => ({
    read: {
        query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
    },
    write: {
        query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
    },
});

const buildMockRes = () => {
    const res: any = {};
    res.status = sinon.stub().returns(res);
    res.send = sinon.stub().returns(res);
    return res;
};

describe('Messages Delete User Data', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('DirectMessagesStore.deleteByUserId', () => {
        it('deletes messages the user sent AND received', async () => {
            const mockDb = buildMockDb();
            const store = new DirectMessagesStore(mockDb as any);
            await store.deleteByUserId('user-1');

            const sql = mockDb.write.query.args[0][0];
            expect(sql).to.contain('delete from "main"."directMessages"');
            expect(sql).to.contain('"fromUserId" = \'user-1\'');
            expect(sql).to.contain('"toUserId" = \'user-1\'');
            expect(sql).to.contain('or');
        });

        // The whole point of the account-deletion fan-out: rows under every brand the user
        // belonged to must go, not just the brand whose app happened to issue the request.
        it('does not scope the delete to a brand', async () => {
            const mockDb = buildMockDb();
            const store = new DirectMessagesStore(mockDb as any);
            await store.deleteByUserId('user-1');

            expect(mockDb.write.query.args[0][0]).to.not.contain('brandVariation');
        });
    });

    describe('ForumMessagesStore.deleteByUserId', () => {
        it('deletes only messages the user authored', async () => {
            const mockDb = buildMockDb();
            const store = new ForumMessagesStore(mockDb as any);
            await store.deleteByUserId('user-1');

            const sql = mockDb.write.query.args[0][0];
            expect(sql).to.contain('delete from "main"."forumMessages"');
            expect(sql).to.contain('"fromUserId" = \'user-1\'');
            expect(sql).to.not.contain('brandVariation');
        });
    });

    describe('ForumsStore.reassignByAuthorId', () => {
        // Reassign, never delete — other members' messages live inside these forums.
        it('updates authorId instead of deleting the forum', async () => {
            const mockDb = buildMockDb();
            const store = new ForumsStore(mockDb as any);
            await store.reassignByAuthorId('user-1', 'super-admin-1');

            const sql = mockDb.write.query.args[0][0];
            expect(sql).to.contain('update "main"."forums"');
            expect(sql).to.contain('"authorId" = \'super-admin-1\'');
            expect(sql).to.contain('where "authorId" = \'user-1\'');
            expect(sql).to.not.contain('delete');
            expect(sql).to.not.contain('brandVariation');
        });
    });

    describe('deleteUserData handler', () => {
        it('rejects a request with no user id rather than deleting nothing quietly', async () => {
            const res = buildMockRes();
            await deleteUserData({ headers: {} }, res);

            expect(res.status.args[0][0]).to.equal(401);
        });

        it('deletes messages and hands forums to the super admin', async () => {
            const dmStub = sinon.stub(Store.directMessages, 'deleteByUserId').resolves([{ id: 'dm-1' }]);
            const fmStub = sinon.stub(Store.forumMessages, 'deleteByUserId').resolves([{ id: 'fm-1' }]);
            const forumStub = sinon.stub(Store.forums, 'reassignByAuthorId').resolves([{ id: 'forum-1' }]);
            const res = buildMockRes();

            await deleteUserData({ headers: { 'x-userid': 'user-1' } }, res);

            expect(dmStub.calledOnceWith('user-1')).to.be.eq(true);
            expect(fmStub.calledOnceWith('user-1')).to.be.eq(true);
            expect(forumStub.calledOnceWith('user-1', SUPER_ADMIN_ID)).to.be.eq(true);
            expect(res.status.args[0][0]).to.equal(202);
            expect(res.send.args[0][0]).to.deep.equal({
                directMessages: [{ id: 'dm-1' }],
                forumMessages: [{ id: 'fm-1' }],
                forums: [{ id: 'forum-1' }],
            });
        });

        // Message content is the sensitive half; ownership metadata is not. If the run dies
        // between the two, the surviving state should be an orphaned forum, not orphaned messages.
        it('deletes forum messages before reassigning the forums', async () => {
            const callOrder: string[] = [];
            sinon.stub(Store.directMessages, 'deleteByUserId').callsFake(() => {
                callOrder.push('directMessages');
                return Promise.resolve([]);
            });
            sinon.stub(Store.forumMessages, 'deleteByUserId').callsFake(() => {
                callOrder.push('forumMessages');
                return Promise.resolve([]);
            });
            sinon.stub(Store.forums, 'reassignByAuthorId').callsFake(() => {
                callOrder.push('forums');
                return Promise.resolve([]);
            });

            await deleteUserData({ headers: { 'x-userid': 'user-1' } }, buildMockRes());

            expect(callOrder).to.deep.equal(['directMessages', 'forumMessages', 'forums']);
        });
    });
});
