/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import DirectMessagesStore, { DIRECT_MESSAGES_TABLE_NAME } from '../../src/store/DirectMessagesStore';

describe('DirectMessagesStore', () => {
    describe('countRecords', () => {
        it('queries for total records', () => {
            const expected = `select count(*) from "main"."directMessages" where "isUnread" = false`;
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new DirectMessagesStore(mockStore);
            store.countRecords({
                filterBy: 'isUnread',
                query: false,
            });

            expect(mockStore.read.query.args[0][0]).to.be.equal(expected);
        });
    });

    describe('searchMoments', () => {
        it('queries and paginates response', () => {
            const expected = `select * from "main"."directMessages" where "toUserId" = 10 and "main"."directMessages"."toUserId" > 7 order by "main"."directMessages"."updatedAt" asc limit 100 offset 100`;
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new DirectMessagesStore(mockStore);
            store.searchDirectMessages(10, {
                pagination: {
                    itemsPerPage: 100,
                    pageNumber: 2,
                },
                filterBy: `${DIRECT_MESSAGES_TABLE_NAME}.toUserId`,
                filterOperator: '>',
                query: 7,
            }, []);

            expect(mockStore.read.query.args[0][0]).to.be.equal(expected);
        });
    });
});
