/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import UserConnectionsStore, { USER_CONNECTIONS_TABLE_NAME } from '../../src/store/UserConnectionsStore';

describe('UserConnectionsStore', () => {
    describe('countRecords', () => {
        it('queries for total records', () => {
            const expected = `select count(*) from "main"."userConnections" inner join "main"."users" on ("main"."users"."id" = "main"."userConnections"."requestingUserId" or "main"."users"."id" = "main"."userConnections"."acceptingUserId") where "isConnectionBroken" = false and "requestStatus" = 'complete' and ("requestingUserId" = true)`;
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new UserConnectionsStore(mockStore);
            store.countRecords({
                filterBy: 'isUnread',
                query: true,
            });

            expect(mockStore.read.query.args[0][0]).to.be.equal(expected);
        });
    });

    describe('searchUserConnections', () => {
        it('joins on userConnections', () => {
            const expected = `select "main"."userConnections"."id", "main"."userConnections"."requestingUserId", "main"."userConnections"."acceptingUserId", "main"."userConnections"."interactionCount", "main"."userConnections"."requestStatus", "main"."userConnections"."isConnectionBroken", "main"."userConnections"."createdAt", "main"."userConnections"."updatedAt", "main"."users"."id" as "users[].id", "main"."users"."userName" as "users[].userName", "main"."users"."firstName" as "users[].firstName", "main"."users"."lastName" as "users[].lastName" from "main"."userConnections" inner join "main"."users" on ("main"."users"."id" = "main"."userConnections"."requestingUserId" or "main"."users"."id" = "main"."userConnections"."acceptingUserId") where "isConnectionBroken" = false and "requestStatus" = 'complete' and ("requestingUserId" > 5) limit 100 offset 100`;
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new UserConnectionsStore(mockStore);
            store.searchUserConnections({
                pagination: {
                    itemsPerPage: 100,
                    pageNumber: 2,
                },
                filterBy: `${USER_CONNECTIONS_TABLE_NAME}.associationId`,
                filterOperator: '>',
                query: 5,
                order: 'desc',
            }, []);

            expect(mockStore.read.query.args[0][0]).to.be.equal(expected);
        });
    });
});
