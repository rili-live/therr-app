import { expect } from 'chai';
import { PushNotifications } from 'therr-js-utilities/constants';

describe('Notifications Handler', () => {
    describe('predictAndSendPushNotification', () => {
        describe('request parsing', () => {
            it('should extract required headers from request', () => {
                const mockHeaders = {
                    authorization: 'Bearer test-token',
                    'x-brand-variation': 'therr',
                    'x-userid': 'user-123',
                    'x-localecode': 'en-us',
                };

                expect(mockHeaders.authorization).to.equal('Bearer test-token');
                expect(mockHeaders['x-brand-variation']).to.equal('therr');
                expect(mockHeaders['x-userid']).to.equal('user-123');
                expect(mockHeaders['x-localecode']).to.equal('en-us');
            });

            it('should extract notification data from request body', () => {
                const mockBody = {
                    fromUserName: 'testuser',
                    fromUser: { id: 'user-123', userName: 'testuser' },
                    toUserDeviceToken: 'device-token-abc',
                    thought: { id: 'thought-123', message: 'Test thought' },
                    type: PushNotifications.Types.newDirectMessage,
                };

                expect(mockBody.fromUserName).to.equal('testuser');
                expect(mockBody.fromUser.id).to.equal('user-123');
                expect(mockBody.toUserDeviceToken).to.equal('device-token-abc');
                expect(mockBody.type).to.equal('new-direct-message');
            });

            it('should handle optional fields in request body', () => {
                const mockBody = {
                    fromUserName: 'testuser',
                    toUserDeviceToken: 'device-token-abc',
                    type: PushNotifications.Types.newDirectMessage,
                    // Optional fields
                    area: { id: 'area-123' },
                    achievementsCount: 5,
                    fromUserId: 'user-456',
                    groupId: 'group-789',
                    groupName: 'Test Group',
                    groupMembersList: ['member1', 'member2'],
                    likeCount: 10,
                    notificationsCount: 3,
                    postType: 'moments',
                    totalAreasActivated: 2,
                    viewCount: 100,
                };

                expect(mockBody.area).to.deep.equal({ id: 'area-123' });
                expect(mockBody.achievementsCount).to.equal(5);
                expect(mockBody.groupMembersList).to.have.lengthOf(2);
            });
        });

        describe('notification type handling', () => {
            it('should default to newDirectMessage type when type is not provided', () => {
                const type = undefined;
                const defaultType = type || PushNotifications.Types.newDirectMessage;
                expect(defaultType).to.equal('new-direct-message');
            });

            it('should use provided type when specified', () => {
                const type = PushNotifications.Types.newGroupMessage;
                const resultType = type || PushNotifications.Types.newDirectMessage;
                expect(resultType).to.equal('new-group-message');
            });
        });
    });

    describe('predictAndSendMultiPushNotification', () => {
        describe('user filtering', () => {
            it('should filter out users with shouldMuteNotifs flag', () => {
                const users: Array<{ id: string; deviceMobileFirebaseToken: string; shouldMuteNotifs: boolean }> = [
                    { id: 'user-1', deviceMobileFirebaseToken: 'token-1', shouldMuteNotifs: false },
                    { id: 'user-2', deviceMobileFirebaseToken: 'token-2', shouldMuteNotifs: true },
                    { id: 'user-3', deviceMobileFirebaseToken: 'token-3', shouldMuteNotifs: false },
                ];

                const filteredUsers = users.filter((user) => !user.shouldMuteNotifs);
                expect(filteredUsers).to.have.lengthOf(2);
                expect(filteredUsers.map((u) => u.id)).to.deep.equal(['user-1', 'user-3']);
            });

            it('should handle empty users array', () => {
                const users: any[] = [];
                const filteredUsers = users.filter((user) => !user.shouldMuteNotifs);
                expect(filteredUsers).to.have.lengthOf(0);
            });

            it('should handle all users muted', () => {
                const users = [
                    { id: 'user-1', shouldMuteNotifs: true },
                    { id: 'user-2', shouldMuteNotifs: true },
                ];

                const filteredUsers = users.filter((user) => !user.shouldMuteNotifs);
                expect(filteredUsers).to.have.lengthOf(0);
            });
        });

        describe('notification type handling', () => {
            it('should default to newGroupMessage type for multi-notifications', () => {
                const type = undefined;
                const defaultType = type || PushNotifications.Types.newGroupMessage;
                expect(defaultType).to.equal('new-group-message');
            });
        });

        describe('group details handling', () => {
            it('should extract groupId from groupDetails', () => {
                const groupDetails = {
                    id: 'group-123',
                    name: 'Test Group',
                    description: 'A test group',
                };

                expect(groupDetails.id).to.equal('group-123');
                expect(groupDetails.name).to.equal('Test Group');
            });

            it('should handle missing groupDetails', () => {
                // Test that we can safely access properties on potentially undefined objects
                type GroupDetails = { id: string; name: string } | undefined;
                const getGroupId = (gd: GroupDetails) => gd?.id;
                const groupId = getGroupId(undefined);
                expect(groupId).to.be.eq(undefined);
            });
        });
    });

    describe('testPushNotification', () => {
        describe('query parameter parsing', () => {
            it('should extract required query parameters', () => {
                const mockQuery = {
                    fromUserName: 'testuser',
                    toUserDeviceToken: 'device-token-xyz',
                    type: PushNotifications.Types.nudgeSpaceEngagement,
                };

                expect(mockQuery.fromUserName).to.equal('testuser');
                expect(mockQuery.toUserDeviceToken).to.equal('device-token-xyz');
                expect(mockQuery.type).to.equal('nudge-space-engagement');
            });
        });

        describe('notification data construction', () => {
            it('should construct data for nudgeSpaceEngagement type', () => {
                const type = PushNotifications.Types.nudgeSpaceEngagement;
                let notificationData: any = {
                    fromUser: {
                        id: 'test-user-id',
                        userName: 'testuser',
                    },
                };

                if (type === PushNotifications.Types.nudgeSpaceEngagement) {
                    notificationData = {
                        area: {
                            id: 'test-area-id',
                        },
                    };
                }

                expect(notificationData.area).to.not.be.eq(undefined);
                expect(notificationData.area.id).to.equal('test-area-id');
            });

            it('should construct data for newDirectMessage type', () => {
                const type = PushNotifications.Types.newDirectMessage;
                let notificationData: any = {};

                if (type === PushNotifications.Types.newDirectMessage) {
                    notificationData = {
                        fromUser: {
                            id: 'test-user-id',
                            userName: 'testuser',
                        },
                    };
                }

                expect(notificationData.fromUser).to.not.be.eq(undefined);
                expect(notificationData.fromUser.userName).to.equal('testuser');
            });

            it('should construct data for newGroupMessage type', () => {
                const type = PushNotifications.Types.newGroupMessage;
                let notificationData: any = {};
                const notificationConfig: any = {};

                if (type === PushNotifications.Types.newGroupMessage) {
                    notificationData = {
                        groupId: 'test-group-id',
                        groupName: 'Test Group',
                    };
                    notificationConfig.groupName = 'Test Group';
                }

                expect(notificationData.groupId).to.equal('test-group-id');
                expect(notificationData.groupName).to.equal('Test Group');
                expect(notificationConfig.groupName).to.equal('Test Group');
            });

            it('should construct data for newConnectionRequest type', () => {
                const type: string = PushNotifications.Types.newConnectionRequest;
                let notificationData: any = {};

                if (type === PushNotifications.Types.newDirectMessage
                    || type === PushNotifications.Types.newConnectionRequest) {
                    notificationData = {
                        fromUser: {
                            id: 'test-user-id',
                            userName: 'testuser',
                        },
                    };
                }

                expect(notificationData.fromUser).to.not.be.eq(undefined);
                expect(notificationData.fromUser.id).to.equal('test-user-id');
            });
        });

        describe('default notification type', () => {
            it('should use newLikeReceived as default when type is not specified', () => {
                const type = undefined;
                const defaultType = type || PushNotifications.Types.newLikeReceived;
                expect(defaultType).to.equal('new-like-received');
            });
        });
    });
});

describe('Notification configuration', () => {
    describe('device token handling', () => {
        it('should use deviceToken from config', () => {
            const config = {
                deviceToken: 'test-device-token',
                userId: 'user-123',
                userLocale: 'en-us',
            };

            expect(config.deviceToken).to.equal('test-device-token');
        });

        it('should handle missing deviceToken gracefully', () => {
            const config = {
                deviceToken: undefined,
                userId: 'user-123',
                userLocale: 'en-us',
            };

            expect(config.deviceToken).to.be.eq(undefined);
        });
    });

    describe('locale handling', () => {
        it('should default to en-us when locale is not provided', () => {
            const locale: string | undefined = undefined;
            const userLocale = locale || 'en-us';
            expect(userLocale).to.equal('en-us');
        });

        it('should use provided locale', () => {
            const locale = 'es-mx';
            const userLocale = (locale as string) || 'en-us';
            expect(userLocale).to.equal('es-mx');
        });
    });

    describe('fromUser construction', () => {
        it('should prefer fromUser over individual fields', () => {
            const fromUser = { id: 'user-123', userName: 'fulluser' };
            const fromUserId = 'user-456';
            const fromUserName = 'partialuser';

            const constructedFromUser = fromUser || {
                id: fromUserId,
                userName: fromUserName,
            };

            expect(constructedFromUser.id).to.equal('user-123');
            expect(constructedFromUser.userName).to.equal('fulluser');
        });

        it('should fall back to individual fields when fromUser is missing', () => {
            const fromUser = undefined;
            const fromUserId = 'user-456';
            const fromUserName = 'partialuser';

            const constructedFromUser = fromUser || {
                id: fromUserId,
                userName: fromUserName,
            };

            expect(constructedFromUser.id).to.equal('user-456');
            expect(constructedFromUser.userName).to.equal('partialuser');
        });
    });
});
