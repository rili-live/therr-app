/* eslint-disable quotes */
import { expect } from 'chai';
import sinon from 'sinon';
import UserInterestsStore from '../../src/store/UserInterestsStore';

describe('UserInterestsStore', () => {
    const createMockConnection = () => ({
        read: {
            query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
        },
        write: {
            query: sinon.stub().callsFake(() => Promise.resolve({ rows: [] })),
        },
    });

    describe('incrementUserInterestsByKey', () => {
        // Engagement used to arrive one content view at a time, each its own cross-service
        // request and its own UPDATE. Callers now coalesce a user's views and flush a map,
        // which requires a different amount per key in a single statement.
        it('applies a different increment per interest key in one statement', async () => {
            const connection = createMockConnection();
            const store = new UserInterestsStore(connection);

            await store.incrementUserInterestsByKey('11111111-1111-1111-1111-111111111111', {
                'interests.foodDrink.coffee': 6,
                'interests.sports.soccer': 2,
            });

            expect(connection.write.query.callCount).to.eq(1);
            const query = connection.write.query.args[0][0];
            expect(query).to.include("('interests.foodDrink.coffee', 6::integer)");
            expect(query).to.include("('interests.sports.soccer', 2::integer)");
            expect(query).to.include(`ui."userId" = '11111111-1111-1111-1111-111111111111'::uuid`);
        });

        // Unquoted main.userInterests would fold to "userinterests" in raw SQL and fail.
        it('quotes the camelCase table identifier', async () => {
            const connection = createMockConnection();
            const store = new UserInterestsStore(connection);

            await store.incrementUserInterestsByKey('11111111-1111-1111-1111-111111111111', {
                'interests.foodDrink.coffee': 1,
            });

            const query = connection.write.query.args[0][0];
            expect(query).to.include('main."userInterests"');
            expect(query).to.not.include('main.userInterests ');
        });

        it('does not query when there is nothing to increment', async () => {
            const connection = createMockConnection();
            const store = new UserInterestsStore(connection);

            const result = await store.incrementUserInterestsByKey('user-1', {});

            expect(result).to.deep.equal([]);
            expect(connection.write.query.called).to.be.eq(false);
        });

        it('drops non-positive and non-numeric increments rather than emitting invalid SQL', async () => {
            const connection = createMockConnection();
            const store = new UserInterestsStore(connection);

            await store.incrementUserInterestsByKey('11111111-1111-1111-1111-111111111111', {
                'interests.foodDrink.coffee': 3,
                'interests.sports.soccer': 0,
                'interests.arts.museums': (undefined as any),
                'interests.outdoors.hiking': -5,
            });

            const query = connection.write.query.args[0][0];
            expect(query).to.include('interests.foodDrink.coffee');
            expect(query).to.not.include('interests.sports.soccer');
            expect(query).to.not.include('interests.arts.museums');
            expect(query).to.not.include('interests.outdoors.hiking');
        });

        it('requires a user id', async () => {
            const connection = createMockConnection();
            const store = new UserInterestsStore(connection);

            const result = await store.incrementUserInterestsByKey('', { 'interests.foodDrink.coffee': 1 });

            expect(result).to.deep.equal([]);
            expect(connection.write.query.called).to.be.eq(false);
        });
    });
});
