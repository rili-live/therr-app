/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import NotificationsStore, { NOTIFICATIONS_TABLE_NAME } from '../../src/store/NotificationsStore';

const buildMockConnection = () => {
    const readStub = sinon.stub().callsFake(() => Promise.resolve({ rows: [] }));
    const writeStub = sinon.stub().callsFake(() => Promise.resolve({ rows: [] }));
    return {
        connection: {
            read: { query: readStub } as any,
            write: { query: writeStub } as any,
        },
        readStub,
        writeStub,
    };
};

describe('NotificationsStore', () => {
    describe('countRecords', () => {
        it('queries for total records scoped by brand', () => {
            // BrandScopedStore injects brandVariation into defaultConditions, so the count query
            // sees both the user-supplied filter (isUnread = true) AND the brand filter.
            const expected = `select count(*) from "main"."notifications" where "main"."notifications"."brandVariation" = 'therr' and "isUnread" = true`;
            const { connection, readStub } = buildMockConnection();
            const store = new NotificationsStore(connection);
            store.countRecords('therr', {
                filterBy: 'isUnread',
                query: true,
            });

            expect(readStub.args[0][0]).to.be.equal(expected);
        });
    });

    describe('searchNotifications', () => {
        it('joins on userConnections and applies brand filter', () => {
            // Brand filter is appended via withBrand → andWhere, so it lands after the userId clause.
            const expected = `select "main"."notifications"."id", "main"."notifications"."userId", "main"."notifications"."type", "main"."notifications"."associationId", "main"."notifications"."isUnread", "main"."notifications"."messageLocaleKey", "main"."notifications"."messageParams", "main"."notifications"."createdAt", "main"."notifications"."updatedAt", "main"."userConnections"."requestingUserId" as "userConnection.requestingUserId", "main"."userConnections"."acceptingUserId" as "userConnection.acceptingUserId", "main"."userConnections"."requestStatus" as "userConnection.requestStatus", "main"."userConnections"."updatedAt" as "userConnection.updatedAt" from "main"."notifications" left join "main"."userConnections" on "main"."notifications"."associationId" = "main"."userConnections".id AND (main.notifications.type = 'CONNECTION_REQUEST_ACCEPTED' OR main.notifications.type = 'CONNECTION_REQUEST_RECEIVED') where "main"."notifications"."userId" = 5 and "main"."notifications"."brandVariation" = 'therr' order by "main"."notifications"."updatedAt" desc limit 100 offset 100`;
            const { connection, readStub } = buildMockConnection();
            const store = new NotificationsStore(connection);
            store.searchNotifications('therr', 5, {
                pagination: {
                    itemsPerPage: 100,
                    pageNumber: 2,
                },
                filterBy: `${NOTIFICATIONS_TABLE_NAME}.associationId`, // Deprecated. This should be ignored and instead we will use the x-userid for security
                filterOperator: '>',
                query: 5,
                order: 'desc',
            });

            expect(readStub.args[0][0]).to.be.equal(expected);
        });
    });
});
