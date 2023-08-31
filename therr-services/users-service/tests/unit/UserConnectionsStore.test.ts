/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import { UserConnectionTypes } from 'therr-js-utilities/constants';
import UserConnectionsStore from '../../src/store/UserConnectionsStore';
import { USER_CONNECTIONS_TABLE_NAME } from '../../src/store/tableNames';

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
            const expected = `select "main"."userConnections"."id", "main"."userConnections"."requestingUserId", "main"."userConnections"."acceptingUserId", "main"."userConnections"."interactionCount", "main"."userConnections"."requestStatus", "main"."userConnections"."isConnectionBroken", "main"."userConnections"."createdAt", "main"."userConnections"."updatedAt", "main"."users"."id" as "users[].id", "main"."users"."userName" as "users[].userName", "main"."users"."firstName" as "users[].firstName", "main"."users"."lastName" as "users[].lastName", "main"."users"."media" as "users[].media" from "main"."userConnections" inner join "main"."users" on ("main"."users"."id" = "main"."userConnections"."requestingUserId" or "main"."users"."id" = "main"."userConnections"."acceptingUserId") where "isConnectionBroken" = false and "requestStatus" = 'complete' and ("requestingUserId" > 5) limit 100 offset 100`;
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

    describe('findUserConnections', () => {
        it('joins on userConnections', () => {
            const expected = `select "acceptingUserId", "requestingUserId" from "main"."userConnections" where ("requestingUserId" = 'abc' and "acceptingUserId" in ('def', 'ghi')) or ("acceptingUserId" = 'abc' and "requestingUserId" in ('def', 'ghi'))`;
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new UserConnectionsStore(mockStore);
            store.findUserConnections('abc', ['def', 'ghi']);

            expect(mockStore.read.query.args[0][0]).to.be.equal(expected);
        });
    });

    describe('createUserConnections', () => {
        it('joins on userConnections', () => {
            const expected = `insert into "main"."userConnections" ("acceptingUserId", "requestStatus", "requestingUserId") values ('def', 'pending', 'abc'), ('ghi', 'pending', 'abc') returning "id", "acceptingUserId", "requestingUserId"`;
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new UserConnectionsStore(mockStore);
            store.createUserConnections('abc', ['def', 'ghi']);

            expect(mockStore.write.query.args[0][0]).to.be.equal(expected);
        });
    });

    describe('updateUserConnection', () => {
        it('joins on userConnections', () => {
            const expected1 = `update "main"."userConnections" set "interactionCount" = 5, "isConnectionBroken" = false, "requestStatus" = 'complete', "updatedAt" =`;
            const expected2 = `where "requestingUserId" = 'abc' and "acceptingUserId" = 'abc' returning *`;
            const mockStore = {
                write: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new UserConnectionsStore(mockStore);
            store.updateUserConnection({
                requestingUserId: 'abc',
                acceptingUserId: 'abc',
            }, {
                interactionCount: 5,
                isConnectionBroken: false,
                requestStatus: UserConnectionTypes.COMPLETE,
            });

            expect(mockStore.write.query.args[0][0].includes(expected1)).to.be.equal(true);
            expect(mockStore.write.query.args[0][0].includes(expected2)).to.be.equal(true);
        });
    });
});
