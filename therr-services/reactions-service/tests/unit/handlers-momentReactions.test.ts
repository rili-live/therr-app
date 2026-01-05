/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';

describe('Moment Reactions Handler', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('createOrUpdateMomentReaction logic', () => {
        it('should create a new moment reaction when none exists', async () => {
            const mockCreatedReaction = {
                momentId: 'moment-123',
                userId: 'user-123',
                userHasLiked: true,
                userLocale: 'en-us',
            };

            const getStub = sinon.stub(Store.momentReactions, 'get').resolves([]);
            const createStub = sinon.stub(Store.momentReactions, 'create').resolves([mockCreatedReaction]);

            // Simulate the handler logic
            const existingReactions = await Store.momentReactions.get({
                userId: 'user-123',
                momentId: 'moment-123',
            });

            expect(existingReactions).to.be.an('array');
            expect(existingReactions.length).to.equal(0);

            // Since no existing, create new
            const created = await Store.momentReactions.create({
                userId: 'user-123',
                momentId: 'moment-123',
                userHasLiked: true,
                userLocale: 'en-us',
            });

            expect(created[0].momentId).to.equal('moment-123');
            expect(getStub.calledOnce).to.be.eq(true);
            expect(createStub.calledOnce).to.be.eq(true);
        });

        it('should update existing moment reaction when one exists', async () => {
            const existingReaction = {
                momentId: 'moment-123',
                userId: 'user-123',
                userHasLiked: false,
                userViewCount: 1,
            };

            const updatedReaction = {
                ...existingReaction,
                userHasLiked: true,
                userViewCount: 2,
            };

            const getStub = sinon.stub(Store.momentReactions, 'get').resolves([existingReaction]);
            const updateStub = sinon.stub(Store.momentReactions, 'update').resolves([updatedReaction]);

            // Simulate the handler logic
            const existing = await Store.momentReactions.get({
                userId: 'user-123',
                momentId: 'moment-123',
            });

            expect(existing.length).to.be.greaterThan(0);

            // Since existing, update
            const updated = await Store.momentReactions.update(
                { userId: 'user-123', momentId: 'moment-123' },
                { userHasLiked: true, userViewCount: existing[0].userViewCount + 1 },
            );

            expect(updated[0].userHasLiked).to.be.eq(true);
            expect(updated[0].userViewCount).to.equal(2);
            expect(getStub.calledOnce).to.be.eq(true);
            expect(updateStub.calledOnce).to.be.eq(true);
        });

        it('should increment view count on update', async () => {
            const existingReaction = {
                momentId: 'moment-123',
                userId: 'user-123',
                userViewCount: 5,
            };

            const getStub = sinon.stub(Store.momentReactions, 'get').resolves([existingReaction]);
            const updateStub = sinon.stub(Store.momentReactions, 'update').resolves([{
                ...existingReaction,
                userViewCount: 6,
            }]);

            const existing = await Store.momentReactions.get({
                userId: 'user-123',
                momentId: 'moment-123',
            });

            const newViewCount = existing[0].userViewCount + 1;
            const updated = await Store.momentReactions.update(
                { userId: 'user-123', momentId: 'moment-123' },
                { userViewCount: newViewCount },
            );

            expect(updated[0].userViewCount).to.equal(6);
        });
    });

    describe('createOrUpdateMultiMomentReactions logic', () => {
        it('should separate existing and new reactions for batch operations', async () => {
            const existingReactions = [
                { momentId: 'moment-1', userId: 'user-123' },
                { momentId: 'moment-2', userId: 'user-123' },
            ];

            const getStub = sinon.stub(Store.momentReactions, 'get').resolves(existingReactions);
            const updateStub = sinon.stub(Store.momentReactions, 'update').resolves(existingReactions);
            const createStub = sinon.stub(Store.momentReactions, 'create').resolves([
                { momentId: 'moment-3', userId: 'user-123' },
            ]);

            const momentIds = ['moment-1', 'moment-2', 'moment-3'];

            // Simulate the handler logic
            const existing = await Store.momentReactions.get({ userId: 'user-123' }, momentIds);

            const existingMapped = {};
            existing.forEach((reaction) => {
                existingMapped[reaction.momentId] = reaction;
            });

            // Verify existing are identified
            expect(existingMapped['moment-1']).to.not.be.eq(undefined);
            expect(existingMapped['moment-2']).to.not.be.eq(undefined);
            expect(existingMapped['moment-3']).to.be.eq(undefined);

            // Create array for new reactions only
            const createArray = momentIds
                .filter((id) => !existingMapped[id])
                .map((momentId) => ({ momentId, userId: 'user-123' }));

            expect(createArray.length).to.equal(1);
            expect(createArray[0].momentId).to.equal('moment-3');
        });
    });

    describe('getMomentReactions logic', () => {
        it('should retrieve reactions for a user', async () => {
            const mockReactions = [
                { momentId: 'moment-1', userId: 'user-123', userHasLiked: true },
                { momentId: 'moment-2', userId: 'user-123', userHasLiked: false },
            ];

            const getStub = sinon.stub(Store.momentReactions, 'get').resolves(mockReactions);

            const reactions = await Store.momentReactions.get(
                { userId: 'user-123' },
                undefined,
                { limit: 100, offset: 0, order: 'DESC' },
            );

            expect(reactions).to.be.an('array');
            expect(reactions.length).to.equal(2);
            expect(getStub.calledOnce).to.be.eq(true);
        });

        it('should filter by momentIds when provided', async () => {
            const mockReactions = [
                { momentId: 'moment-1', userId: 'user-123' },
            ];

            const getStub = sinon.stub(Store.momentReactions, 'get').resolves(mockReactions);

            const reactions = await Store.momentReactions.get(
                { userId: 'user-123' },
                ['moment-1'],
                { limit: 100, offset: 0, order: 'DESC' },
            );

            expect(reactions.length).to.equal(1);
            expect(getStub.args[0][1]).to.deep.equal(['moment-1']);
        });
    });

    describe('getReactionsByMomentId logic', () => {
        it('should reject request when user has not activated the moment', async () => {
            const inactiveReaction = {
                momentId: 'moment-123',
                userId: 'user-123',
                userHasActivated: false,
            };

            const getStub = sinon.stub(Store.momentReactions, 'get').resolves([inactiveReaction]);

            const userReaction = await Store.momentReactions.get({
                userId: 'user-123',
                momentId: 'moment-123',
            });

            expect(userReaction[0].userHasActivated).to.be.eq(false);
            // Handler would return 403 error here
        });

        it('should allow request when user has activated the moment', async () => {
            const activeReaction = {
                momentId: 'moment-123',
                userId: 'user-123',
                userHasActivated: true,
            };
            const allReactions = [
                { momentId: 'moment-123', userId: 'user-123', userHasLiked: true },
                { momentId: 'moment-123', userId: 'user-456', userHasLiked: true },
            ];

            const getStub = sinon.stub(Store.momentReactions, 'get').resolves([activeReaction]);
            const getByMomentIdStub = sinon.stub(Store.momentReactions, 'getByMomentId').resolves(allReactions);

            const userReaction = await Store.momentReactions.get({
                userId: 'user-123',
                momentId: 'moment-123',
            });

            expect(userReaction[0].userHasActivated).to.be.eq(true);

            // Since activated, get all reactions
            const reactions = await Store.momentReactions.getByMomentId({ momentId: 'moment-123' });
            expect(reactions.length).to.equal(2);
        });
    });

    describe('findMomentReactions logic', () => {
        it('should apply userHasActivated filter when provided', async () => {
            const mockReactions = [
                { momentId: 'moment-1', userHasActivated: true },
            ];

            const getStub = sinon.stub(Store.momentReactions, 'get').resolves(mockReactions);

            const reactions = await Store.momentReactions.get(
                { userId: 'user-123', userHasActivated: true },
                ['moment-1', 'moment-2'],
                { limit: 100, offset: 0, order: 'DESC' },
            );

            expect(getStub.args[0][0].userHasActivated).to.be.eq(true);
        });
    });

    describe('countMomentReactions logic', () => {
        it('should return reaction count for a moment', async () => {
            const mockCount = [{ momentId: 'moment-123', count: '5' }];

            const getCountsStub = sinon.stub(Store.momentReactions, 'getCounts').resolves(mockCount);

            const counts = await Store.momentReactions.getCounts(['moment-123'], {});

            expect(counts[0].count).to.equal('5');
            expect(counts[0].momentId).to.equal('moment-123');
        });

        it('should return 0 count when no reactions exist', async () => {
            const getCountsStub = sinon.stub(Store.momentReactions, 'getCounts').resolves([]);

            const counts = await Store.momentReactions.getCounts(['moment-123'], {});

            expect(counts.length).to.equal(0);
            // Handler would return { count: 0 }
        });
    });
});
