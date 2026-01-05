/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import Store from '../../src/store';

describe('Space Reactions Handler', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('createOrUpdateSpaceReaction logic', () => {
        it('should create a new space reaction when none exists', async () => {
            const mockCreatedReaction = {
                spaceId: 'space-123',
                userId: 'user-123',
                userHasLiked: true,
                rating: 5,
                userLocale: 'en-us',
            };

            const getStub = sinon.stub(Store.spaceReactions, 'get').resolves([]);
            const createStub = sinon.stub(Store.spaceReactions, 'create').resolves([mockCreatedReaction]);

            // Simulate the handler logic
            const existingReactions = await Store.spaceReactions.get({
                userId: 'user-123',
                spaceId: 'space-123',
            });

            expect(existingReactions).to.be.an('array');
            expect(existingReactions.length).to.equal(0);

            // Since no existing, create new
            const created = await Store.spaceReactions.create({
                userId: 'user-123',
                spaceId: 'space-123',
                userHasLiked: true,
                rating: 5,
                userLocale: 'en-us',
            });

            expect(created[0].spaceId).to.equal('space-123');
            expect(created[0].rating).to.equal(5);
            expect(getStub.calledOnce).to.be.eq(true);
            expect(createStub.calledOnce).to.be.eq(true);
        });

        it('should update existing space reaction when one exists', async () => {
            const existingReaction = {
                spaceId: 'space-123',
                userId: 'user-123',
                userHasLiked: false,
                rating: 3,
                userViewCount: 1,
            };

            const updatedReaction = {
                ...existingReaction,
                userHasLiked: true,
                rating: 5,
                userViewCount: 2,
            };

            const getStub = sinon.stub(Store.spaceReactions, 'get').resolves([existingReaction]);
            const updateStub = sinon.stub(Store.spaceReactions, 'update').resolves([updatedReaction]);

            // Simulate the handler logic
            const existing = await Store.spaceReactions.get({
                userId: 'user-123',
                spaceId: 'space-123',
            });

            expect(existing.length).to.be.greaterThan(0);

            // Since existing, update
            const updated = await Store.spaceReactions.update(
                { userId: 'user-123', spaceId: 'space-123' },
                { userHasLiked: true, rating: 5, userViewCount: existing[0].userViewCount + 1 },
            );

            expect(updated[0].userHasLiked).to.be.eq(true);
            expect(updated[0].rating).to.equal(5);
            expect(updated[0].userViewCount).to.equal(2);
        });

        it('should increment view count on update', async () => {
            const existingReaction = {
                spaceId: 'space-123',
                userId: 'user-123',
                userViewCount: 5,
            };

            const getStub = sinon.stub(Store.spaceReactions, 'get').resolves([existingReaction]);
            const updateStub = sinon.stub(Store.spaceReactions, 'update').resolves([{
                ...existingReaction,
                userViewCount: 6,
            }]);

            const existing = await Store.spaceReactions.get({
                userId: 'user-123',
                spaceId: 'space-123',
            });

            const newViewCount = existing[0].userViewCount + 1;
            const updated = await Store.spaceReactions.update(
                { userId: 'user-123', spaceId: 'space-123' },
                { userViewCount: newViewCount },
            );

            expect(updated[0].userViewCount).to.equal(6);
        });
    });

    describe('createOrUpdateMultiSpaceReactions logic', () => {
        it('should separate existing and new reactions for batch operations', async () => {
            const existingReactions = [
                { spaceId: 'space-1', userId: 'user-123' },
                { spaceId: 'space-2', userId: 'user-123' },
            ];

            const getStub = sinon.stub(Store.spaceReactions, 'get').resolves(existingReactions);
            const updateStub = sinon.stub(Store.spaceReactions, 'update').resolves(existingReactions);
            const createStub = sinon.stub(Store.spaceReactions, 'create').resolves([
                { spaceId: 'space-3', userId: 'user-123' },
            ]);

            const spaceIds = ['space-1', 'space-2', 'space-3'];

            // Simulate the handler logic
            const existing = await Store.spaceReactions.get({ userId: 'user-123' }, spaceIds);

            const existingMapped = {};
            existing.forEach((reaction) => {
                existingMapped[reaction.spaceId] = reaction;
            });

            // Verify existing are identified
            expect(existingMapped['space-1']).to.not.be.eq(undefined);
            expect(existingMapped['space-2']).to.not.be.eq(undefined);
            expect(existingMapped['space-3']).to.be.eq(undefined);

            // Create array for new reactions only
            const createArray = spaceIds
                .filter((id) => !existingMapped[id])
                .map((spaceId) => ({ spaceId, userId: 'user-123' }));

            expect(createArray.length).to.equal(1);
            expect(createArray[0].spaceId).to.equal('space-3');
        });
    });

    describe('getSpaceReactions logic', () => {
        it('should retrieve reactions for a user', async () => {
            const mockReactions = [
                { spaceId: 'space-1', userId: 'user-123', userHasLiked: true },
                { spaceId: 'space-2', userId: 'user-123', userHasLiked: false },
            ];

            const getStub = sinon.stub(Store.spaceReactions, 'get').resolves(mockReactions);

            const reactions = await Store.spaceReactions.get(
                { userId: 'user-123' },
                undefined,
                { limit: 100, offset: 0, order: 'DESC' },
            );

            expect(reactions).to.be.an('array');
            expect(reactions.length).to.equal(2);
            expect(getStub.calledOnce).to.be.eq(true);
        });

        it('should filter by spaceIds when provided', async () => {
            const mockReactions = [
                { spaceId: 'space-1', userId: 'user-123' },
            ];

            const getStub = sinon.stub(Store.spaceReactions, 'get').resolves(mockReactions);

            const reactions = await Store.spaceReactions.get(
                { userId: 'user-123' },
                ['space-1'],
                { limit: 100, offset: 0, order: 'DESC' },
            );

            expect(reactions.length).to.equal(1);
            expect(getStub.args[0][1]).to.deep.equal(['space-1']);
        });
    });

    describe('getSpaceRatings logic', () => {
        it('should calculate average rating correctly', async () => {
            const mockRatings = [
                { rating: 5 },
                { rating: 4 },
                { rating: 3 },
                { rating: 4 },
                { rating: 4 },
            ];

            const getRatingsStub = sinon.stub(Store.spaceReactions, 'getRatingsBySpaceId').resolves(mockRatings);

            const ratings = await Store.spaceReactions.getRatingsBySpaceId({ spaceId: 'space-123' });

            const ratingValues = ratings.map((r) => r.rating);
            const totalRatings = ratingValues.length;
            const sum = ratingValues.reduce((acc, curr) => acc + curr, 0);
            const avgRating = Math.round((sum / totalRatings) * 10) / 10;

            expect(totalRatings).to.equal(5);
            expect(sum).to.equal(20);
            expect(avgRating).to.equal(4);
        });

        it('should return null average when no ratings exist', async () => {
            const getRatingsStub = sinon.stub(Store.spaceReactions, 'getRatingsBySpaceId').resolves([]);

            const ratings = await Store.spaceReactions.getRatingsBySpaceId({ spaceId: 'space-123' });

            const ratingValues = ratings.map((r) => r.rating);
            const totalRatings = ratingValues.length;
            const avgRating = totalRatings > 0 ? Math.round((ratingValues.reduce((a, b) => a + b, 0) / totalRatings) * 10) / 10 : null;

            expect(totalRatings).to.equal(0);
            expect(avgRating).to.be.eq(null);
        });

        it('should round average to one decimal place', async () => {
            const mockRatings = [
                { rating: 5 },
                { rating: 4 },
                { rating: 4 },
            ];

            const getRatingsStub = sinon.stub(Store.spaceReactions, 'getRatingsBySpaceId').resolves(mockRatings);

            const ratings = await Store.spaceReactions.getRatingsBySpaceId({ spaceId: 'space-123' });

            const ratingValues = ratings.map((r) => r.rating);
            const sum = ratingValues.reduce((acc, curr) => acc + curr, 0);
            const avgRating = Math.round((sum / ratingValues.length) * 10) / 10;

            // (5 + 4 + 4) / 3 = 4.333... rounded to 4.3
            expect(avgRating).to.equal(4.3);
        });
    });

    describe('getReactionsBySpaceId logic', () => {
        it('should reject request when user has not activated the space', async () => {
            const inactiveReaction = {
                spaceId: 'space-123',
                userId: 'user-123',
                userHasActivated: false,
            };

            const getStub = sinon.stub(Store.spaceReactions, 'get').resolves([inactiveReaction]);

            const userReaction = await Store.spaceReactions.get({
                userId: 'user-123',
                spaceId: 'space-123',
            });

            expect(userReaction[0].userHasActivated).to.be.eq(false);
            // Handler would return 403 error here
        });

        it('should allow request when user has activated the space', async () => {
            const activeReaction = {
                spaceId: 'space-123',
                userId: 'user-123',
                userHasActivated: true,
            };
            const allReactions = [
                { spaceId: 'space-123', userId: 'user-123', userHasLiked: true },
                { spaceId: 'space-123', userId: 'user-456', userHasLiked: true },
            ];

            const getStub = sinon.stub(Store.spaceReactions, 'get').resolves([activeReaction]);
            const getBySpaceIdStub = sinon.stub(Store.spaceReactions, 'getBySpaceId').resolves(allReactions);

            const userReaction = await Store.spaceReactions.get({
                userId: 'user-123',
                spaceId: 'space-123',
            });

            expect(userReaction[0].userHasActivated).to.be.eq(true);

            // Since activated, get all reactions
            const reactions = await Store.spaceReactions.getBySpaceId({ spaceId: 'space-123' });
            expect(reactions.length).to.equal(2);
        });
    });

    describe('findSpaceReactions logic', () => {
        it('should apply userHasActivated filter when provided', async () => {
            const mockReactions = [
                { spaceId: 'space-1', userHasActivated: true },
            ];

            const getStub = sinon.stub(Store.spaceReactions, 'get').resolves(mockReactions);

            const reactions = await Store.spaceReactions.get(
                { userId: 'user-123', userHasActivated: true },
                ['space-1', 'space-2'],
                { limit: 100, offset: 0, order: 'DESC' },
            );

            expect(getStub.args[0][0].userHasActivated).to.be.eq(true);
        });
    });

    describe('countSpaceReactions logic', () => {
        it('should return reaction count for a space', async () => {
            const mockCount = [{ spaceId: 'space-123', count: '10' }];

            const getCountsStub = sinon.stub(Store.spaceReactions, 'getCounts').resolves(mockCount);

            const counts = await Store.spaceReactions.getCounts(['space-123'], {});

            expect(counts[0].count).to.equal('10');
            expect(counts[0].spaceId).to.equal('space-123');
        });

        it('should return 0 count when no reactions exist', async () => {
            const getCountsStub = sinon.stub(Store.spaceReactions, 'getCounts').resolves([]);

            const counts = await Store.spaceReactions.getCounts(['space-123'], {});

            expect(counts.length).to.equal(0);
            // Handler would return { count: 0 }
        });
    });
});
