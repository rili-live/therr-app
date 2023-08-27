import { expect } from 'chai';
import sinon from 'sinon';
import SpaceReactionsStore, { SPACE_REACTIONS_TABLE_NAME } from '../../src/store/SpaceReactionsStore';

describe('SpaceReactionsStore', () => {
    describe('getRatingsBySpaceId', () => {
        it('queries for ratings with default limit', async () => {
            const expectedQuery = `select "rating" from "${SPACE_REACTIONS_TABLE_NAME}" where "rating" is not null limit 1000`; // Adjust based on actual SQL query
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            
            const store = new SpaceReactionsStore(mockStore);
            store.getRatingsBySpaceId({ someCondition: true });
            
            expect(mockStore.read.query.calledOnceWith(expectedQuery)).to.be.true;
        });

        it('restricts the limit to 5000', async () => {
            const expectedQuery = `select "rating" from "${SPACE_REACTIONS_TABLE_NAME}" where "rating" is not null limit 5000`;
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            
            const store = new SpaceReactionsStore(mockStore);
            await store.getRatingsBySpaceId({}, 6000);
            
            expect(mockStore.read.query.calledOnceWith(expectedQuery)).to.be.true;
        });

    });
});
