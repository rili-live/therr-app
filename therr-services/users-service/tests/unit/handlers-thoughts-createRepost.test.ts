/* eslint-disable quotes */
import { expect } from 'chai';
import sinon from 'sinon';
import { ErrorCodes } from 'therr-js-utilities/constants';
import { createThought } from '../../src/handlers/thoughts';
import Store from '../../src/store';

const USER_ID = 'reposter-user-id';
const AUTHOR_USER_ID = 'author-user-id';

/**
 * The repost resolution rules in `createThought`. All four exist because getting them wrong is
 * not recoverable after the insert: the row is already in the feed pointing at the wrong thing.
 */
describe('handlers/thoughts createThought reposts', () => {
    let getByIdStub: sinon.SinonStub;
    let getStub: sinon.SinonStub;
    let createStub: sinon.SinonStub;

    const buildRes = () => {
        const res: any = {};
        res.status = sinon.stub().returns(res);
        res.send = sinon.stub().returns(res);
        return res;
    };

    const run = async (body: any) => {
        const res = buildRes();
        await createThought({
            headers: { 'x-userid': USER_ID, 'x-localecode': 'en-us' },
            body: { fromUserId: USER_ID, message: '', ...body },
        } as any, res);
        return res;
    };

    beforeEach(() => {
        getByIdStub = sinon.stub(Store.thoughts, 'getById');
        getStub = sinon.stub(Store.thoughts, 'get').resolves([]);
        // Rejecting here stops the handler right after the insert, before it fans out to
        // reactions/achievements/notifications — none of which this suite is about.
        createStub = sinon.stub(Store.thoughts, 'create').rejects(new Error('stop-after-create'));
    });

    afterEach(() => {
        sinon.restore();
    });

    it('404s when the thought being reposted does not exist', async () => {
        getByIdStub.resolves({ thoughts: [] });

        const res = await run({ repostThoughtId: 'missing-thought' });

        expect(res.status.firstCall.args[0]).to.equal(404);
        expect(createStub.called).to.equal(false);
    });

    it('403s when reposting somebody else\'s non-public thought', async () => {
        // Reposting puts the original in front of the reposter's audience, so a reader who was
        // merely granted access to a private post must not be able to broadcast it.
        getByIdStub.resolves({
            thoughts: [{ id: 'original-1', fromUserId: AUTHOR_USER_ID, isPublic: false }],
        });

        const res = await run({ repostThoughtId: 'original-1' });

        expect(res.status.firstCall.args[0]).to.equal(403);
        expect(res.send.firstCall.args[0].errorCode).to.equal(ErrorCodes.THOUGHT_ACCESS_RESTRICTED);
        expect(createStub.called).to.equal(false);
    });

    it('allows an author to repost their own non-public thought', async () => {
        getByIdStub.resolves({
            thoughts: [{ id: 'original-1', fromUserId: USER_ID, isPublic: false }],
        });

        await run({ repostThoughtId: 'original-1' });

        expect(createStub.calledOnce).to.equal(true);
        expect(createStub.firstCall.args[1].repostThoughtId).to.equal('original-1');
    });

    it('collapses a repost of a repost onto the root thought', async () => {
        // Chains would make the embed recursive (attachRepostDetails only hydrates one level)
        // and would credit the intermediate reposter rather than the original author.
        getByIdStub.withArgs(sinon.match.any, 'intermediate-1').resolves({
            thoughts: [{
                id: 'intermediate-1', fromUserId: AUTHOR_USER_ID, isPublic: true, repostThoughtId: 'root-1',
            }],
        });
        getByIdStub.withArgs(sinon.match.any, 'root-1').resolves({
            thoughts: [{ id: 'root-1', fromUserId: 'root-author', isPublic: true }],
        });

        await run({ repostThoughtId: 'intermediate-1' });

        expect(createStub.firstCall.args[1].repostThoughtId).to.equal('root-1');
    });

    it('falls back to the intermediate repost when the root is unreadable', async () => {
        getByIdStub.withArgs(sinon.match.any, 'intermediate-1').resolves({
            thoughts: [{
                id: 'intermediate-1', fromUserId: AUTHOR_USER_ID, isPublic: true, repostThoughtId: 'root-1',
            }],
        });
        getByIdStub.withArgs(sinon.match.any, 'root-1').resolves({ thoughts: [] });

        await run({ repostThoughtId: 'intermediate-1' });

        expect(createStub.firstCall.args[1].repostThoughtId).to.equal('intermediate-1');
    });

    it('drops parentId so a repost is never filed as a reply', async () => {
        // ThoughtsStore.find never surfaces rows with a parentId, so a repost carrying one
        // would be created successfully and then be invisible in every feed.
        getByIdStub.resolves({
            thoughts: [{ id: 'original-1', fromUserId: AUTHOR_USER_ID, isPublic: true }],
        });

        await run({ repostThoughtId: 'original-1', parentId: 'some-parent' });

        expect(createStub.firstCall.args[1].parentId).to.equal(undefined);
    });

    it('keys the duplicate check on the resolved repost target', async () => {
        getByIdStub.withArgs(sinon.match.any, 'intermediate-1').resolves({
            thoughts: [{
                id: 'intermediate-1', fromUserId: AUTHOR_USER_ID, isPublic: true, repostThoughtId: 'root-1',
            }],
        });
        getByIdStub.withArgs(sinon.match.any, 'root-1').resolves({
            thoughts: [{ id: 'root-1', fromUserId: 'root-author', isPublic: true }],
        });

        await run({ repostThoughtId: 'intermediate-1' });

        expect(getStub.firstCall.args[1].repostThoughtId).to.equal('root-1');
    });

    it('400s with the repost-specific message when the same thought is reposted twice', async () => {
        getByIdStub.resolves({
            thoughts: [{ id: 'original-1', fromUserId: AUTHOR_USER_ID, isPublic: true }],
        });
        getStub.resolves([{ id: 'existing-repost' }]);

        const res = await run({ repostThoughtId: 'original-1' });

        expect(res.status.firstCall.args[0]).to.equal(400);
        expect(res.send.firstCall.args[0].errorCode).to.equal(ErrorCodes.DUPLICATE_POST);
        expect(createStub.called).to.equal(false);
    });

    it('leaves an ordinary post untouched by any of the repost resolution', async () => {
        await run({ message: 'just a post' });

        expect(getByIdStub.called).to.equal(false);
        expect(getStub.firstCall.args[1].repostThoughtId).to.equal(undefined);
        expect(createStub.firstCall.args[1].repostThoughtId).to.equal(undefined);
    });
});
