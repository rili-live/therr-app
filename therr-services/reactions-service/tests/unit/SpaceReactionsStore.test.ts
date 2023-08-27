import { expect } from 'chai';
import sinon from 'sinon';
import SpaceReactionsStore from '../../src/store/SpaceReactionsStore';

describe('SpaceReactionsStore', () => {
    describe('getRatingsBySpaceId', () => {
        it('queries for ratings with default limit', async () => {
            const expectedQuery = `select "rating" from "main"."spaceReactions" where "rating" is not null limit 1000`;
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new SpaceReactionsStore(mockStore);
            store.getRatingsBySpaceId({ someCondition: true });
            expect(mockStore.read.query.args[0][0]).to.be.equal(expectedQuery);
        });
        it('restricts the limit to 5000', async () => {
            const expectedQuery = `select "rating" from "main"."spaceReactions" where "rating" is not null limit 5000`;
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new SpaceReactionsStore(mockStore);
            store.getRatingsBySpaceId({}, 6000);
            expect(mockStore.read.query.args[0][0]).to.be.equal(expectedQuery);
        });
    });
});
