/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import NotificationsStore, { NOTIFICATIONS_TABLE_NAME } from '../../src/store/NotificationsStore';

describe('NotificationsStore', () => {
    describe('countRecords', () => {
        it('queries for total records', () => {
            const expected = `select count(*) from "main"."notifications" where "isUnread" = true`;
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new NotificationsStore(mockStore);
            store.countRecords({
                filterBy: 'isUnread',
                query: true,
            });

            expect(mockStore.read.query.args[0][0]).to.be.equal(expected);
        });
    });

    describe('searchNotifications', () => {
        it('joins on userConnections', () => {
            const expected = `select "main"."notifications"."id", "main"."notifications"."userId", "main"."notifications"."type", "main"."notifications"."associationId", "main"."notifications"."isUnread", "main"."notifications"."messageLocaleKey", "main"."notifications"."messageParams", "main"."notifications"."createdAt", "main"."notifications"."updatedAt", "main"."userConnections"."requestingUserId" as "userConnection.requestingUserId", "main"."userConnections"."acceptingUserId" as "userConnection.acceptingUserId", "main"."userConnections"."requestStatus" as "userConnection.requestStatus", "main"."userConnections"."updatedAt" as "userConnection.updatedAt" from "main"."notifications" left join "main"."userConnections" on "main"."notifications"."associationId" = "main"."userConnections".id AND (main.notifications.type = 'CONNECTION_REQUEST_ACCEPTED' OR main.notifications.type = 'CONNECTION_REQUEST_RECEIVED') where "main"."notifications"."userId" = 5 order by "main"."notifications"."updatedAt" desc limit 100 offset 100`;
            const mockStore = {
                read: {
                    query: sinon.stub().callsFake(() => Promise.resolve({})),
                },
            };
            const store = new NotificationsStore(mockStore);
            store.searchNotifications(5, {
                pagination: {
                    itemsPerPage: 100,
                    pageNumber: 2,
                },
                filterBy: `${NOTIFICATIONS_TABLE_NAME}.associationId`, // Deprecated. This should be ignored and instead we will use the x-userid for security
                filterOperator: '>',
                query: 5,
                order: 'desc',
            });

            expect(mockStore.read.query.args[0][0]).to.be.equal(expected);
        });
    });
});
