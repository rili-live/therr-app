import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';
import * as shareCheckinMedia from '../../src/utilities/shareCheckinMedia';
import * as handlerHelpers from '../../src/handlers/helpers';
import { shareCheckin } from '../../src/handlers/habitCheckins';

/**
 * Sharing a check-in as a public post.
 *
 * The case that matters here is the one that fails silently: `ThoughtsStore.create`
 * does not take `isPublic: true` at its word — it re-runs the lead-in text through
 * `isTextUnsafe` and forces the post private when that trips. A private thought is
 * not a share, and because the handler stamps `sharedThoughtId` (which makes every
 * later share a no-op), getting this wrong tells the user their check-in was shared,
 * shows it in no feed, and gives them no way to retry.
 */
const makeRes = () => {
    const res: any = {
        statusCode: undefined,
        body: undefined,
        status(code: number) {
            res.statusCode = code;
            return res;
        },
        send(payload: any) {
            res.body = payload;
            return res;
        },
    };
    return res;
};

const makeReq = (overrides: any = {}) => ({
    headers: {
        'x-userid': 'user-1',
        'x-localecode': 'en-us',
        'x-brand-variation': 'habits',
        ...(overrides.headers || {}),
    },
    params: { id: 'checkin-1', ...(overrides.params || {}) },
    body: { message: 'Day 12 done', ...(overrides.body || {}) },
});

describe('HABITS check-in public share', () => {
    let createThoughtStub: sinon.SinonStub;
    let deleteThoughtsStub: sinon.SinonStub;
    let updateCheckinStub: sinon.SinonStub;
    let deletePublicObjectStub: sinon.SinonStub;

    beforeEach(() => {
        sinon.stub(Store.habitCheckins, 'getById').resolves({
            id: 'checkin-1',
            userId: 'user-1',
            habitGoalId: 'goal-1',
            hasProof: true,
            notes: 'felt good',
            sharedThoughtId: null,
        } as any);
        sinon.stub(Store.proofs, 'getByCheckinId').resolves([
            { id: 'proof-1', mediaPath: 'user-1/proofs/p1.jpg', mediaType: 'image' },
        ] as any);
        sinon.stub(Store.habitGoals, 'getById').resolves({ id: 'goal-1', name: 'Run daily' } as any);

        sinon.stub(shareCheckinMedia, 'copyProofToPublicBucket').resolves({
            path: 'user-1/content/shared_checkin_checkin-1.jpg',
            type: 'user.image.public',
        });
        deletePublicObjectStub = sinon.stub(shareCheckinMedia, 'deleteSharedCheckinPublicObject').resolves();

        sinon.stub(handlerHelpers, 'checkIsMediaSafeForWork').resolves(true);

        createThoughtStub = sinon.stub(Store.thoughts, 'create');
        deleteThoughtsStub = sinon.stub(Store.thoughts, 'deleteThoughts').resolves([] as any);
        updateCheckinStub = sinon.stub(Store.habitCheckins, 'update').resolves({} as any);
    });

    afterEach(() => {
        sinon.restore();
    });

    it('records the link and returns the post when the thought is created public', async () => {
        createThoughtStub.resolves([{ id: 'thought-1', isPublic: true }]);

        const res = makeRes();
        await shareCheckin(makeReq() as any, res, (() => {}) as any);

        expect(res.statusCode).to.equal(201);
        expect(res.body.sharedThoughtId).to.equal('thought-1');
        expect(updateCheckinStub.calledOnce).to.equal(true);
        expect(updateCheckinStub.firstCall.args[1]).to.deep.equal({ sharedThoughtId: 'thought-1' });
    });

    it('refuses the share when the created thought came back private', async () => {
        // What text moderation does: honours neither `isPublic: true` nor the caller's
        // intent, and hands back a post nothing will ever render.
        createThoughtStub.resolves([{ id: 'thought-1', isPublic: false, isMatureContent: true }]);

        const res = makeRes();
        await shareCheckin(makeReq() as any, res, (() => {}) as any);

        expect(res.statusCode).to.equal(422);
    });

    it('does not stamp sharedThoughtId when the post came back private, so a retry is possible', async () => {
        createThoughtStub.resolves([{ id: 'thought-1', isPublic: false }]);

        const res = makeRes();
        await shareCheckin(makeReq() as any, res, (() => {}) as any);

        expect(updateCheckinStub.called).to.equal(false);
    });

    it('rolls back the private post and its public image copy', async () => {
        createThoughtStub.resolves([{ id: 'thought-1', isPublic: false }]);

        const res = makeRes();
        await shareCheckin(makeReq() as any, res, (() => {}) as any);

        expect(deleteThoughtsStub.calledOnce).to.equal(true);
        expect(deleteThoughtsStub.firstCall.args[0]).to.deep.equal({
            fromUserId: 'user-1',
            ids: ['thought-1'],
        });
        expect(deletePublicObjectStub.calledWith('user-1/content/shared_checkin_checkin-1.jpg')).to.equal(true);
    });
});
