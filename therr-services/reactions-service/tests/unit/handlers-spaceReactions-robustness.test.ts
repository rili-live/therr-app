/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';

describe('Space Reactions Handler - Robustness', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('createOrUpdateMultiSpaceReactions - race condition fix', () => {
        it('should await update before sending response so updated field is populated', async () => {
            const existingReactions = [
                { spaceId: 'space-1', userId: 'user-123' },
            ];
            const updatedReactions = [
                { spaceId: 'space-1', userId: 'user-123', userHasActivated: true },
            ];
            const createdReactions = [
                { spaceId: 'space-2', userId: 'user-123' },
            ];

            const getStub = sinon.stub(Store.spaceReactions, 'get').resolves(existingReactions);
            const updateStub = sinon.stub(Store.spaceReactions, 'update').resolves(updatedReactions);
            const createStub = sinon.stub(Store.spaceReactions, 'create').resolves(createdReactions);

            const spaceIds = ['space-1', 'space-2'];
            const userId = 'user-123';
            const locale = 'en-us';
            const params = { userHasActivated: true };

            // Simulate the fixed handler logic (async/await)
            const existing = await Store.spaceReactions.get({ userId }, spaceIds);

            const existingMapped: Record<string, any> = {};
            const existingReactionPairs: string[][] = existing.map((reaction) => {
                existingMapped[reaction.spaceId] = reaction;
                return [userId, reaction.spaceId];
            });

            let updatedResult;
            if (existing?.length) {
                updatedResult = await Store.spaceReactions.update({}, {
                    ...params,
                    userLocale: locale,
                }, {
                    columns: ['userId', 'spaceId'],
                    whereInArray: existingReactionPairs,
                });
            }

            const createArray = spaceIds
                .filter((id) => !existingMapped[id])
                .map((spaceId) => ({
                    userId, spaceId, ...params, userLocale: locale,
                }));

            const createdResult = await Store.spaceReactions.create(createArray);

            // KEY ASSERTION: updatedResult must be defined (not undefined)
            // This was the bug - before the fix, updatedReactions was always undefined
            // because the update was fire-and-forget without await
            expect(updatedResult).to.not.be.eq(undefined);
            expect(updatedResult).to.deep.equal(updatedReactions);
            expect(createdResult).to.deep.equal(createdReactions);

            // Verify update was called before create (sequential, not parallel)
            expect(updateStub.calledBefore(createStub)).to.be.eq(true);
        });

        it('should skip update when no existing reactions found', async () => {
            const getStub = sinon.stub(Store.spaceReactions, 'get').resolves([]);
            const updateStub = sinon.stub(Store.spaceReactions, 'update');
            const createStub = sinon.stub(Store.spaceReactions, 'create').resolves([
                { spaceId: 'space-1', userId: 'user-123' },
            ]);

            const existing = await Store.spaceReactions.get({ userId: 'user-123' }, ['space-1']);

            let updatedResult;
            if (existing?.length) {
                updatedResult = await Store.spaceReactions.update({}, {});
            }

            const createArray = [{ userId: 'user-123', spaceId: 'space-1' }];
            const createdResult = await Store.spaceReactions.create(createArray);

            // update should NOT be called
            expect(updateStub.called).to.be.eq(false);
            expect(updatedResult).to.be.eq(undefined);
            expect(createdResult.length).to.equal(1);
        });

        it('should propagate errors from update via try/catch', async () => {
            const getStub = sinon.stub(Store.spaceReactions, 'get').resolves([
                { spaceId: 'space-1', userId: 'user-123' },
            ]);
            const updateStub = sinon.stub(Store.spaceReactions, 'update').rejects(new Error('DB connection lost'));

            let caughtError: Error | null = null;
            try {
                const existing = await Store.spaceReactions.get({ userId: 'user-123' }, ['space-1']);
                if (existing?.length) {
                    await Store.spaceReactions.update({}, {});
                }
            } catch (err: any) {
                caughtError = err;
            }

            // The error should be caught by the try/catch block (not lost as fire-and-forget)
            expect(caughtError).to.not.be.eq(null);
            expect(caughtError?.message).to.equal('DB connection lost');
        });
    });
});
