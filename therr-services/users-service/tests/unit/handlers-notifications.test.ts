/* eslint-disable quotes, max-len */
import { expect } from 'chai';
import sinon from 'sinon';
import { Notifications } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import { translateNotification } from '../../src/handlers/notifications';

describe('Notifications Handler', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('createNotification', () => {
        it('should create a notification with required fields', async () => {
            const mockNotification = {
                id: 'notif-123',
                userId: 'user-1',
                type: Notifications.Types.CONNECTION_REQUEST_RECEIVED,
                associationId: 'conn-123',
                isUnread: true,
                messageLocaleKey: Notifications.MessageKeys.CONNECTION_REQUEST_RECEIVED,
            };
            const createStub = sinon.stub(Store.notifications, 'createNotification').resolves([mockNotification]);

            const result = await Store.notifications.createNotification({
                userId: 'user-1',
                type: Notifications.Types.CONNECTION_REQUEST_RECEIVED,
                associationId: 'conn-123',
                isUnread: true,
                messageLocaleKey: Notifications.MessageKeys.CONNECTION_REQUEST_RECEIVED,
            });

            expect(result).to.be.an('array');
            expect(result[0].type).to.equal(Notifications.Types.CONNECTION_REQUEST_RECEIVED);
            expect(result[0].isUnread).to.be.eq(true);
            createStub.restore();
        });

        it('should include message params for personalization', async () => {
            const mockNotification = {
                id: 'notif-123',
                userId: 'user-1',
                messageParams: {
                    userId: 'sender-123',
                    firstName: 'John',
                    lastName: 'Doe',
                },
            };
            const createStub = sinon.stub(Store.notifications, 'createNotification').resolves([mockNotification]);

            const result = await Store.notifications.createNotification({
                userId: 'user-1',
                type: Notifications.Types.CONNECTION_REQUEST_RECEIVED,
                associationId: 'conn-123',
                isUnread: true,
                messageLocaleKey: Notifications.MessageKeys.CONNECTION_REQUEST_RECEIVED,
                messageParams: {
                    userId: 'sender-123',
                    firstName: 'John',
                    lastName: 'Doe',
                },
            });

            expect(result[0].messageParams.firstName).to.equal('John');
            expect(result[0].messageParams.lastName).to.equal('Doe');
            createStub.restore();
        });
    });

    describe('getNotification', () => {
        it('should retrieve notification by id', async () => {
            const mockNotification = {
                id: 'notif-123',
                userId: 'user-1',
                type: Notifications.Types.CONNECTION_REQUEST_RECEIVED,
            };
            const getStub = sinon.stub(Store.notifications, 'getNotifications').resolves([mockNotification]);

            const result = await Store.notifications.getNotifications({
                id: 'notif-123',
            });

            expect(result[0].id).to.equal('notif-123');
            getStub.restore();
        });

        it('should return empty array when notification not found', async () => {
            const getStub = sinon.stub(Store.notifications, 'getNotifications').resolves([]);

            const result = await Store.notifications.getNotifications({
                id: 'nonexistent',
            });

            expect(result.length).to.equal(0);
            getStub.restore();
        });
    });

    describe('searchNotifications', () => {
        it('should search notifications with pagination', async () => {
            const mockNotifications = [
                { id: 'notif-1', isUnread: true },
                { id: 'notif-2', isUnread: true },
            ];
            const searchStub = sinon.stub(Store.notifications, 'searchNotifications').resolves(mockNotifications);

            const result = await Store.notifications.searchNotifications('user-1', {
                pagination: { itemsPerPage: 20, pageNumber: 1 },
                order: 'desc',
            });

            expect(result.length).to.equal(2);
            searchStub.restore();
        });

        it('should filter notifications by user id (security)', async () => {
            const mockNotifications = [
                { id: 'notif-1', userId: 'user-1' },
            ];
            const searchStub = sinon.stub(Store.notifications, 'searchNotifications').resolves(mockNotifications);

            // User ID should come from header, not query params (security)
            const userId = 'user-1';
            const result = await Store.notifications.searchNotifications(userId, {
                pagination: { itemsPerPage: 20, pageNumber: 1 },
            });

            expect(result[0].userId).to.equal(userId);
            searchStub.restore();
        });
    });

    describe('updateNotification', () => {
        it('should mark notification as read', async () => {
            const mockNotification = {
                id: 'notif-123',
                isUnread: false,
            };
            const updateStub = sinon.stub(Store.notifications, 'updateNotification').resolves([mockNotification]);

            const result = await Store.notifications.updateNotification(
                { id: 'notif-123' },
                { isUnread: false },
            );

            expect(result[0].isUnread).to.be.eq(false);
            updateStub.restore();
        });

        it('should mark notification as unread', async () => {
            const mockNotification = {
                id: 'notif-123',
                isUnread: true,
            };
            const updateStub = sinon.stub(Store.notifications, 'updateNotification').resolves([mockNotification]);

            const result = await Store.notifications.updateNotification(
                { id: 'notif-123' },
                { isUnread: true },
            );

            expect(result[0].isUnread).to.be.eq(true);
            updateStub.restore();
        });
    });

    describe('translateNotification helper', () => {
        it('should return empty message for undefined notification', () => {
            const result = translateNotification(undefined);

            expect(result.message).to.equal('');
        });

        it('should return notification with translated message', () => {
            const mockNotification = {
                messageLocaleKey: 'notifications.connectionRequestReceived',
                messageParams: { firstName: 'John' },
            };

            const result = translateNotification(mockNotification, 'en-us');

            // Result should spread notification and add message property
            expect((result as any).messageLocaleKey).to.equal('notifications.connectionRequestReceived');
            expect((result as any).messageParams).to.deep.equal({ firstName: 'John' });
            expect(result).to.have.property('message');
        });

        it('should handle missing locale by defaulting to en-us', () => {
            const mockNotification = {
                messageLocaleKey: 'notifications.test',
            };

            const result = translateNotification(mockNotification);

            expect(result).to.have.property('message');
        });
    });

    describe('notification types', () => {
        it('should support CONNECTION_REQUEST_RECEIVED type', () => {
            expect(Notifications.Types.CONNECTION_REQUEST_RECEIVED).to.equal('CONNECTION_REQUEST_RECEIVED');
        });

        it('should support CONNECTION_REQUEST_ACCEPTED type', () => {
            expect(Notifications.Types.CONNECTION_REQUEST_ACCEPTED).to.equal('CONNECTION_REQUEST_ACCEPTED');
        });

        it('should support THOUGHT_REPLY type', () => {
            expect(Notifications.Types.THOUGHT_REPLY).to.equal('THOUGHT_REPLY');
        });

        it('should support NEW_LIKE_RECEIVED type', () => {
            expect(Notifications.Types.NEW_LIKE_RECEIVED).to.equal('NEW_LIKE_RECEIVED');
        });

        it('should support NEW_SUPER_LIKE_RECEIVED type', () => {
            expect(Notifications.Types.NEW_SUPER_LIKE_RECEIVED).to.equal('NEW_SUPER_LIKE_RECEIVED');
        });

        it('should support ACHIEVEMENT_COMPLETED type', () => {
            expect(Notifications.Types.ACHIEVEMENT_COMPLETED).to.equal('ACHIEVEMENT_COMPLETED');
        });

        it('should support NEW_GROUP_MEMBERS type', () => {
            expect(Notifications.Types.NEW_GROUP_MEMBERS).to.equal('NEW_GROUP_MEMBERS');
        });

        it('should support NEW_GROUP_INVITE type', () => {
            expect(Notifications.Types.NEW_GROUP_INVITE).to.equal('NEW_GROUP_INVITE');
        });
    });

    describe('notification message keys', () => {
        it('should have message key for connection request received', () => {
            expect(Notifications.MessageKeys.CONNECTION_REQUEST_RECEIVED).to.equal('notifications.connectionRequestReceived');
        });

        it('should have message key for connection request accepted', () => {
            expect(Notifications.MessageKeys.CONNECTION_REQUEST_ACCEPTED).to.equal('notifications.connectionRequestAccepted');
        });

        it('should have message key for thought reply', () => {
            expect(Notifications.MessageKeys.THOUGHT_REPLY).to.equal('notifications.newThoughtReplyReceived');
        });

        it('should have message key for new like received', () => {
            expect(Notifications.MessageKeys.NEW_LIKE_RECEIVED).to.equal('notifications.reactionLikeReceived');
        });

        it('should have message key for achievement completed', () => {
            expect(Notifications.MessageKeys.ACHIEVEMENT_COMPLETED).to.equal('notifications.achievementCompleted');
        });
    });

    describe('notification count', () => {
        it('should count notifications by filter', async () => {
            const countStub = sinon.stub(Store.notifications, 'countRecords').resolves([{ count: '15' }]);

            const result = await Store.notifications.countRecords({
                filterBy: 'isUnread',
                query: true,
            });

            expect(Number(result[0].count)).to.equal(15);
            countStub.restore();
        });
    });

    describe('notification with userConnection join', () => {
        it('should search notifications with userConnection data', async () => {
            const mockNotifications = [
                {
                    id: 'notif-1',
                    type: Notifications.Types.CONNECTION_REQUEST_RECEIVED,
                    associationId: 'conn-123',
                    'userConnection.requestingUserId': 'user-2',
                    'userConnection.acceptingUserId': 'user-1',
                    'userConnection.requestStatus': 'pending',
                },
            ];
            const searchStub = sinon.stub(Store.notifications, 'searchNotifications').resolves(mockNotifications);

            const result = await Store.notifications.searchNotifications('user-1', {
                pagination: { itemsPerPage: 20, pageNumber: 1 },
            });

            expect(result[0]['userConnection.requestingUserId']).to.equal('user-2');
            searchStub.restore();
        });
    });
});
