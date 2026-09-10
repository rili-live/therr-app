/**
 * Thread context on a reply is an access-control boundary, not a display detail.
 *
 * `createThought` never verifies that the caller may see `parentId` — any authenticated user
 * can POST a reply naming any thought id they know, and then owns that reply. Because the
 * details handler skips the activation check for the caller's own content, that reply is a
 * free pass into the handler. So everything the handler then reveals about, or grants on,
 * the parent has to be gated separately:
 *
 *   - returning `thought.parent` leaks the parent's message and author, and
 *   - activating `parentId` grants *permanent* access to the parent, since a later direct
 *     request for it passes `hasUserReacted`.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import * as reactionsApi from '../../src/api/reactions';
import userMetricsService from '../../src/api/userMetricsService';
import { getThoughtDetails } from '../../src/handlers/thoughts';
import Store from '../../src/store';

const VIEWER_USER_ID = 'viewer-user-id';
const OTHER_USER_ID = 'other-user-id';
const PARENT_ID = 'parent-thought-id';
const REPLY_ID = 'reply-thought-id';

/** A reply authored by the viewer, so the handler's own-content path skips the access check. */
const buildOwnReply = (parent?: any) => ({
    id: REPLY_ID,
    parentId: PARENT_ID,
    fromUserId: VIEWER_USER_ID,
    isPublic: false,
    message: 'a reply',
    replies: [],
    ...(parent ? { parent } : {}),
});

describe('handlers/thoughts getThoughtDetails (parent thread context)', () => {
    let createReactionsStub: sinon.SinonStub;
    let hasUserReactedStub: sinon.SinonStub;
    let getByIdStub: sinon.SinonStub;
    let res: any;

    const runWith = async (thought: any) => {
        getByIdStub.resolves({ thoughts: [thought], users: {} });

        await getThoughtDetails({
            headers: {
                authorization: 'Bearer test-token',
                'x-userid': VIEWER_USER_ID,
                'x-brand-variation': 'therr',
                'x-localecode': 'en-us',
            },
            params: { thoughtId: thought.id },
            body: { withParent: true },
        } as any, res);

        return res.send.firstCall?.args[0];
    };

    beforeEach(() => {
        res = {};
        res.status = sinon.stub().returns(res);
        res.send = sinon.stub().returns(res);

        getByIdStub = sinon.stub(Store.thoughts, 'getById');
        sinon.stub(Store.userMetrics, 'countWhere').resolves([{ count: '0' }] as any);
        sinon.stub(Store.userConnections, 'incrementUserConnection').resolves();
        sinon.stub(userMetricsService, 'uploadMetric').resolves({} as any);

        createReactionsStub = sinon.stub(reactionsApi, 'createReactions').resolves({} as any);
        hasUserReactedStub = sinon.stub(reactionsApi, 'hasUserReacted').resolves(false);
        sinon.stub(reactionsApi, 'countReactions').resolves({ count: '0' } as any);
        sinon.stub(reactionsApi, 'countReactionsByThoughtId').resolves({} as any);
        sinon.stub(reactionsApi, 'findReactionsByUser').resolves({} as any);
    });

    afterEach(() => {
        sinon.restore();
    });

    it('never activates the parent when a reply is viewed', async () => {
        await runWith(buildOwnReply({
            id: PARENT_ID,
            fromUserId: OTHER_USER_ID,
            isPublic: false,
            message: 'the private original',
        }));

        // Activating the parent here would be a permanent grant: the reply is reachable to
        // anyone who authored it, so the parent would become readable on its own afterwards.
        const activatedIds = createReactionsStub.firstCall.args[0];
        expect(activatedIds).to.not.include(PARENT_ID);
        expect(activatedIds).to.include(REPLY_ID);
    });

    it('withholds a private parent from a caller who has not activated it', async () => {
        hasUserReactedStub.resolves(false);

        const payload = await runWith(buildOwnReply({
            id: PARENT_ID,
            fromUserId: OTHER_USER_ID,
            isPublic: false,
            message: 'the private original',
        }));

        expect(payload.thought.parent).to.equal(undefined);
    });

    it('returns the parent when the caller has already activated it', async () => {
        hasUserReactedStub.resolves(true);

        const payload = await runWith(buildOwnReply({
            id: PARENT_ID,
            fromUserId: OTHER_USER_ID,
            isPublic: false,
            message: 'the private original',
        }));

        expect(payload.thought.parent.id).to.equal(PARENT_ID);
        expect(payload.thought.parent.message).to.equal('the private original');
    });

    it('returns a public parent without a reaction lookup', async () => {
        const payload = await runWith(buildOwnReply({
            id: PARENT_ID,
            fromUserId: OTHER_USER_ID,
            isPublic: true,
            message: 'the public original',
        }));

        expect(payload.thought.parent.id).to.equal(PARENT_ID);
        expect(hasUserReactedStub.called).to.equal(false);
    });

    it('returns the parent to its own author', async () => {
        const payload = await runWith(buildOwnReply({
            id: PARENT_ID,
            fromUserId: VIEWER_USER_ID,
            isPublic: false,
            message: 'my own original',
        }));

        expect(payload.thought.parent.id).to.equal(PARENT_ID);
        expect(hasUserReactedStub.called).to.equal(false);
    });

    it('does not pay for a parent lookup when withParent was not requested', async () => {
        getByIdStub.resolves({ thoughts: [buildOwnReply()], users: {} });

        await getThoughtDetails({
            headers: {
                authorization: 'Bearer test-token',
                'x-userid': VIEWER_USER_ID,
                'x-brand-variation': 'therr',
                'x-localecode': 'en-us',
            },
            params: { thoughtId: REPLY_ID },
            body: {},
        } as any, res);

        expect(hasUserReactedStub.called).to.equal(false);
        expect(createReactionsStub.firstCall.args[0]).to.not.include(PARENT_ID);
    });
});
