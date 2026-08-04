/**
 * Rebuilding a user's stream after they switch content algorithms.
 *
 * The ordering assertions here are the point of the file. Both side effects are
 * fire-and-forget, so nothing downstream can observe a wrong order except the user, as a
 * silently unranked feed — which is exactly the failure this utility exists to prevent.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import { ContentAlgorithms } from 'therr-js-utilities/content-ranking';
import * as reactionsApi from '../../src/api/reactions';
import * as redisClient from '../../src/store/redisClient';
import handleContentAlgorithmChange from '../../src/utilities/handleContentAlgorithmChange';

const HEADERS: any = {
    'x-userid': 'user-1',
    'x-brand-variation': 'therr',
};

/** A promise whose settlement this test controls, so in-flight order is observable. */
const deferred = () => {
    let resolve: (value?: any) => void = () => undefined;
    let reject: (err: any) => void = () => undefined;
    const promise = new Promise((res, rej) => {
        resolve = res as any;
        reject = rej;
    });
    return { promise, resolve, reject };
};

/** Lets every already-queued microtask (the util's unawaited chain) run to completion. */
const flush = () => new Promise((resolve) => { setImmediate(resolve); });

describe('handleContentAlgorithmChange', () => {
    let resetStub: sinon.SinonStub;
    let clearGateStub: sinon.SinonStub;

    beforeEach(() => {
        resetStub = sinon.stub(reactionsApi, 'resetThoughtRelevance');
        clearGateStub = sinon.stub(redisClient, 'clearDistributorRun').resolves();
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('ordering', () => {
        // Regression: the two side effects used to be started concurrently. The gate release
        // is a single Redis DEL while the reset is a cross-service round trip plus a bulk
        // UPDATE, so the gate reliably won — opening a window where the next notifications
        // poll re-seeded and re-scored the stream, and the still-in-flight reset then NULLed
        // the scores it had just written. `resetRelevanceScores` clears every scored activated
        // row regardless of algorithmKey, so it cannot tell new rows from old ones.
        it('does not release the distributor gate while the relevance reset is still in flight', async () => {
            const reset = deferred();
            resetStub.returns(reset.promise);

            handleContentAlgorithmChange(HEADERS, 'user-1', ContentAlgorithms.PULSE, ContentAlgorithms.FOCUS);
            await flush();

            expect(resetStub.calledOnce).to.be.eq(true);
            expect(clearGateStub.called).to.be.eq(false);

            reset.resolve({ data: { resetCount: 3 } });
            await flush();

            expect(clearGateStub.calledOnceWith('user-1')).to.be.eq(true);
        });

        // Leaving the gate closed would strand the user on the old ordering until the window
        // expires (15 min by default), which is worse than re-seeding over stale scores.
        it('still releases the gate when the relevance reset fails', async () => {
            const reset = deferred();
            resetStub.returns(reset.promise);

            handleContentAlgorithmChange(HEADERS, 'user-1', ContentAlgorithms.PULSE, ContentAlgorithms.FOCUS);
            await flush();

            reset.reject(new Error('reactions-service down'));
            await flush();

            expect(clearGateStub.calledOnceWith('user-1')).to.be.eq(true);
        });

        it('never rejects, so it cannot fail the settings save that triggered it', async () => {
            resetStub.rejects(new Error('reactions-service down'));
            clearGateStub.rejects(new Error('redis down'));

            expect(() => handleContentAlgorithmChange(
                HEADERS,
                'user-1',
                ContentAlgorithms.PULSE,
                ContentAlgorithms.FOCUS,
            )).to.not.throw();
            await flush();
        });
    });

    // Resetting the stream is destructive — it discards every relevance score the user has.
    // Each guard below is the difference between "a no-op save" and "an unranked feed".
    describe('guards against a needless reset', () => {
        it('does nothing when the request did not touch the setting at all', async () => {
            handleContentAlgorithmChange(HEADERS, 'user-1', ContentAlgorithms.PULSE, undefined);
            await flush();

            expect(resetStub.called).to.be.eq(false);
            expect(clearGateStub.called).to.be.eq(false);
        });

        it('does nothing when the user re-saves the algorithm they were already on', async () => {
            resetStub.resolves({ data: {} });

            handleContentAlgorithmChange(HEADERS, 'user-1', ContentAlgorithms.FOCUS, ContentAlgorithms.FOCUS);
            await flush();

            expect(resetStub.called).to.be.eq(false);
            expect(clearGateStub.called).to.be.eq(false);
        });

        // A row that predates the column reads as null, which normalizes to the default. Saving
        // the default from that state is not a change, and must not wipe the user's ranking.
        it('treats a legacy null previous value as the default rather than a change', async () => {
            resetStub.resolves({ data: {} });

            handleContentAlgorithmChange(HEADERS, 'user-1', null, ContentAlgorithms.PULSE);
            await flush();

            expect(resetStub.called).to.be.eq(false);
            expect(clearGateStub.called).to.be.eq(false);
        });

        it('does nothing without a user id, rather than resetting an unknown stream', async () => {
            handleContentAlgorithmChange(HEADERS, '', ContentAlgorithms.PULSE, ContentAlgorithms.FOCUS);
            await flush();

            expect(resetStub.called).to.be.eq(false);
            expect(clearGateStub.called).to.be.eq(false);
        });
    });
});
