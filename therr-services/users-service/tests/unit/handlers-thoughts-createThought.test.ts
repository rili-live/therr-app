/**
 * `parentId` is a privilege-bearing claim, and this handler is where it is minted.
 *
 * Everything downstream trusts "this thought is a reply of X" to decide what its author may see
 * of X — most sharply `getThoughtDetails`, which skips the activation check entirely for the
 * caller's own content. So an unchecked `parentId` here is enough on its own to reach a private
 * thought: reply to it, then open your own reply. The gate has to reject at create time, because
 * by the time the row exists the claim is indistinguishable from a legitimate one.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import * as internalRestRequestModule from 'therr-js-utilities/internal-rest-request';
import * as achievements from '../../src/handlers/helpers/achievements';
import * as reactionsApi from '../../src/api/reactions';
import { createThought } from '../../src/handlers/thoughts';
import Store from '../../src/store';

const AUTHOR_USER_ID = 'author-user-id';
const OTHER_USER_ID = 'other-user-id';
const PARENT_ID = 'parent-thought-id';

describe('handlers/thoughts createThought (replying to a thought you cannot see)', () => {
    let getByIdStub: sinon.SinonStub;
    let createStub: sinon.SinonStub;
    let hasUserReactedStub: sinon.SinonStub;
    let res: any;

    const postReply = async (body: any = { message: 'my reply', parentId: PARENT_ID }) => {
        await createThought({
            headers: {
                authorization: 'Bearer test-token',
                'x-userid': AUTHOR_USER_ID,
                'x-brand-variation': 'therr',
                'x-localecode': 'en-us',
            },
            body,
        } as any, res);

        return res.status.firstCall?.args[0];
    };

    /** `getById` is brand-scoped, so "no row" covers both a bad id and another brand's thought. */
    const withParent = (parent: any) => getByIdStub.resolves({ thoughts: parent ? [parent] : [], users: {} });

    beforeEach(() => {
        res = {};
        res.status = sinon.stub().returns(res);
        res.send = sinon.stub().returns(res);

        getByIdStub = sinon.stub(Store.thoughts, 'getById');
        sinon.stub(Store.thoughts, 'get').resolves([]);
        // Resolved without a parentId so the post-create chain takes its short branch — what is
        // under test is whether the gate let the request reach `create` at all.
        createStub = sinon.stub(Store.thoughts, 'create').resolves([{ id: 'new-reply-id' }] as any);
        sinon.stub(Store.users, 'getUserById').resolves([{ userName: 'replier' }] as any);

        hasUserReactedStub = sinon.stub(reactionsApi, 'hasUserReacted').resolves(false);
        sinon.stub(achievements, 'createOrUpdateAchievement').resolves({} as any);
        sinon.stub(internalRestRequestModule, 'internalRestRequest').resolves({ data: {} } as any);
    });

    afterEach(() => {
        sinon.restore();
    });

    it('refuses to attach a reply to a private thought the caller has not activated', async () => {
        withParent({
            id: PARENT_ID,
            fromUserId: OTHER_USER_ID,
            isPublic: false,
            message: 'the private original',
        });
        hasUserReactedStub.resolves(false);

        const statusCode = await postReply();

        // `getById` is only reached from the gate itself — asserting it ran keeps this test
        // failing loudly if the check is ever removed rather than merely reordered.
        expect(getByIdStub.called).to.equal(true);
        expect(statusCode).to.equal(403);
        expect(createStub.called).to.equal(false);
    });

    it('refuses to attach a reply to a thought that does not exist in the caller brand', async () => {
        withParent(null);

        const statusCode = await postReply();

        expect(statusCode).to.equal(404);
        expect(createStub.called).to.equal(false);
    });

    it('allows a reply to a public thought without a reaction lookup', async () => {
        withParent({
            id: PARENT_ID,
            fromUserId: OTHER_USER_ID,
            isPublic: true,
            message: 'the public original',
        });

        const statusCode = await postReply();

        expect(createStub.called).to.equal(true);
        expect(hasUserReactedStub.called).to.equal(false);
        expect(statusCode).to.equal(201);
    });

    it('allows a reply to a private thought the caller has activated', async () => {
        // The ordinary path into a thread: opening a private thought requires activating it, and
        // opening it activates its replies — so a real reader always satisfies this.
        withParent({
            id: PARENT_ID,
            fromUserId: OTHER_USER_ID,
            isPublic: false,
            message: 'the private original',
        });
        hasUserReactedStub.resolves(true);

        await postReply();

        expect(createStub.called).to.equal(true);
    });

    it('allows a reply to the caller own private thought', async () => {
        withParent({
            id: PARENT_ID,
            fromUserId: AUTHOR_USER_ID,
            isPublic: false,
            message: 'my own original',
        });

        await postReply();

        expect(createStub.called).to.equal(true);
        expect(hasUserReactedStub.called).to.equal(false);
    });

    it('does not gate a top-level thought', async () => {
        await postReply({ message: 'a root thought' });

        expect(getByIdStub.called).to.equal(false);
        expect(createStub.called).to.equal(true);
    });
});
