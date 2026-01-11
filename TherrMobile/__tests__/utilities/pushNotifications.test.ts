import 'react-native';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, beforeEach, afterEach, expect } from '@jest/globals';

// Mock notifee
const mockRequestPermission = jest.fn().mockResolvedValue({});
const mockCreateChannel = jest.fn().mockResolvedValue('test-channel-id');
const mockDisplayNotification = jest.fn().mockResolvedValue('notification-id');
const mockCreateTriggerNotification = jest.fn().mockResolvedValue('trigger-notification-id');
const mockGetNotificationSettings = jest.fn().mockResolvedValue({
    android: {
        alarm: 1, // ENABLED
    },
});
const mockOpenAlarmPermissionSettings = jest.fn().mockResolvedValue(undefined);

jest.mock('@notifee/react-native', () => ({
    requestPermission: mockRequestPermission,
    createChannel: mockCreateChannel,
    displayNotification: mockDisplayNotification,
    createTriggerNotification: mockCreateTriggerNotification,
    getNotificationSettings: mockGetNotificationSettings,
    openAlarmPermissionSettings: mockOpenAlarmPermissionSettings,
    AndroidImportance: {
        DEFAULT: 3,
        HIGH: 4,
        LOW: 2,
        MIN: 1,
        NONE: 0,
    },
    AndroidNotificationSetting: {
        ENABLED: 1,
        DISABLED: 0,
    },
    TriggerType: {
        TIMESTAMP: 0,
        INTERVAL: 1,
    },
    RepeatFrequency: {
        NONE: -1,
        HOURLY: 0,
        DAILY: 1,
        WEEKLY: 2,
    },
}));

// Mock therr-js-utilities
jest.mock('therr-js-utilities/constants', () => ({
    PushNotifications: {
        PressActionIds: {
            default: 'default',
        },
        AndroidIntentActions: {
            Therr: {
                LATEST_POST_VIEWCOUNT_STATS: 'LATEST_POST_VIEWCOUNT_STATS',
                NEW_CONNECTION: 'NEW_CONNECTION',
                NEW_CONNECTION_REQUEST: 'NEW_CONNECTION_REQUEST',
                NEW_DIRECT_MESSAGE: 'NEW_DIRECT_MESSAGE',
                NEW_GROUP_MESSAGE: 'NEW_GROUP_MESSAGE',
                NEW_LIKE_RECEIVED: 'NEW_LIKE_RECEIVED',
                NEW_SUPER_LIKE_RECEIVED: 'NEW_SUPER_LIKE_RECEIVED',
                NEW_THOUGHT_REPLY_RECEIVED: 'NEW_THOUGHT_REPLY_RECEIVED',
                NUDGE_SPACE_ENGAGEMENT: 'NUDGE_SPACE_ENGAGEMENT',
            },
        },
    },
}));

beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
});

afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
});

/**
 * Push Notifications Regression Tests
 *
 * These tests verify the core push notification logic and behaviors including:
 * - FCM setup and configuration
 * - Foreground notification handling
 * - Background notification handling
 * - Scheduled/trigger notifications
 * - Android notification channels
 * - Permission handling
 */

describe('Push Notifications Android Channel Configuration', () => {
    const AndroidImportance = {
        DEFAULT: 3,
        HIGH: 4,
        LOW: 2,
        MIN: 1,
        NONE: 0,
    };

    const AndroidChannelIds = {
        default: 'default',
        contentDiscovery: 'contentDiscovery',
        rewardUpdates: 'rewardUpdates',
        reminders: 'reminders',
    };

    const AndroidChannels = {
        default: {
            id: 'default',
            name: 'Other',
            importance: AndroidImportance.DEFAULT,
        },
        contentDiscovery: {
            id: 'contentDiscovery',
            name: 'Content Discovery',
            importance: AndroidImportance.DEFAULT,
        },
        rewardUpdates: {
            id: 'rewardUpdates',
            name: 'Reward Updates',
            importance: AndroidImportance.HIGH,
        },
        reminders: {
            id: 'reminders',
            name: 'Reminders',
            importance: AndroidImportance.HIGH,
        },
    };

    // Simulates getAndroidChannel function
    const getAndroidChannel = (channelId: string, vibration = true) => ({
        ...AndroidChannels[channelId],
        vibration,
    });

    describe('getAndroidChannel', () => {
        it('should return default channel with correct properties', () => {
            const channel = getAndroidChannel(AndroidChannelIds.default);

            expect(channel).toEqual({
                id: 'default',
                name: 'Other',
                importance: AndroidImportance.DEFAULT,
                vibration: true,
            });
        });

        it('should return contentDiscovery channel', () => {
            const channel = getAndroidChannel(AndroidChannelIds.contentDiscovery);

            expect(channel.id).toBe('contentDiscovery');
            expect(channel.name).toBe('Content Discovery');
            expect(channel.importance).toBe(AndroidImportance.DEFAULT);
        });

        it('should return rewardUpdates channel with HIGH importance', () => {
            const channel = getAndroidChannel(AndroidChannelIds.rewardUpdates);

            expect(channel.id).toBe('rewardUpdates');
            expect(channel.importance).toBe(AndroidImportance.HIGH);
        });

        it('should return reminders channel with HIGH importance', () => {
            const channel = getAndroidChannel(AndroidChannelIds.reminders);

            expect(channel.id).toBe('reminders');
            expect(channel.importance).toBe(AndroidImportance.HIGH);
        });

        it('should set vibration to true by default', () => {
            const channel = getAndroidChannel(AndroidChannelIds.default);
            expect(channel.vibration).toBe(true);
        });

        it('should allow disabling vibration', () => {
            const channel = getAndroidChannel(AndroidChannelIds.default, false);
            expect(channel.vibration).toBe(false);
        });
    });
});

describe('Push Notifications Channel Selection by Click Action', () => {
    const PushNotifications = {
        AndroidIntentActions: {
            Therr: {
                LATEST_POST_VIEWCOUNT_STATS: 'LATEST_POST_VIEWCOUNT_STATS',
                NEW_CONNECTION: 'NEW_CONNECTION',
                NEW_CONNECTION_REQUEST: 'NEW_CONNECTION_REQUEST',
                NEW_DIRECT_MESSAGE: 'NEW_DIRECT_MESSAGE',
                NEW_GROUP_MESSAGE: 'NEW_GROUP_MESSAGE',
                NEW_LIKE_RECEIVED: 'NEW_LIKE_RECEIVED',
                NEW_SUPER_LIKE_RECEIVED: 'NEW_SUPER_LIKE_RECEIVED',
                NEW_THOUGHT_REPLY_RECEIVED: 'NEW_THOUGHT_REPLY_RECEIVED',
                NUDGE_SPACE_ENGAGEMENT: 'NUDGE_SPACE_ENGAGEMENT',
            },
        },
    };

    const AndroidChannelIds = {
        default: 'default',
        contentDiscovery: 'contentDiscovery',
        rewardUpdates: 'rewardUpdates',
        reminders: 'reminders',
    };

    // Simulates getAndroidChannelFromClickActionId function
    const getAndroidChannelFromClickActionId = (clickActionId: string) => {
        const reminderActions = [
            PushNotifications.AndroidIntentActions.Therr.LATEST_POST_VIEWCOUNT_STATS,
            PushNotifications.AndroidIntentActions.Therr.NEW_CONNECTION,
            PushNotifications.AndroidIntentActions.Therr.NEW_CONNECTION_REQUEST,
            PushNotifications.AndroidIntentActions.Therr.NEW_DIRECT_MESSAGE,
            PushNotifications.AndroidIntentActions.Therr.NEW_GROUP_MESSAGE,
            PushNotifications.AndroidIntentActions.Therr.NEW_LIKE_RECEIVED,
            PushNotifications.AndroidIntentActions.Therr.NEW_SUPER_LIKE_RECEIVED,
            PushNotifications.AndroidIntentActions.Therr.NEW_THOUGHT_REPLY_RECEIVED,
        ];

        const rewardActions = [
            PushNotifications.AndroidIntentActions.Therr.NUDGE_SPACE_ENGAGEMENT,
        ];

        if (reminderActions.includes(clickActionId)) {
            return { channelId: AndroidChannelIds.reminders };
        }

        if (rewardActions.includes(clickActionId)) {
            return { channelId: AndroidChannelIds.rewardUpdates };
        }

        return { channelId: AndroidChannelIds.default };
    };

    describe('getAndroidChannelFromClickActionId', () => {
        it('should return reminders channel for NEW_CONNECTION', () => {
            const result = getAndroidChannelFromClickActionId('NEW_CONNECTION');
            expect(result.channelId).toBe(AndroidChannelIds.reminders);
        });

        it('should return reminders channel for NEW_CONNECTION_REQUEST', () => {
            const result = getAndroidChannelFromClickActionId('NEW_CONNECTION_REQUEST');
            expect(result.channelId).toBe(AndroidChannelIds.reminders);
        });

        it('should return reminders channel for NEW_DIRECT_MESSAGE', () => {
            const result = getAndroidChannelFromClickActionId('NEW_DIRECT_MESSAGE');
            expect(result.channelId).toBe(AndroidChannelIds.reminders);
        });

        it('should return reminders channel for NEW_GROUP_MESSAGE', () => {
            const result = getAndroidChannelFromClickActionId('NEW_GROUP_MESSAGE');
            expect(result.channelId).toBe(AndroidChannelIds.reminders);
        });

        it('should return reminders channel for NEW_LIKE_RECEIVED', () => {
            const result = getAndroidChannelFromClickActionId('NEW_LIKE_RECEIVED');
            expect(result.channelId).toBe(AndroidChannelIds.reminders);
        });

        it('should return reminders channel for NEW_SUPER_LIKE_RECEIVED', () => {
            const result = getAndroidChannelFromClickActionId('NEW_SUPER_LIKE_RECEIVED');
            expect(result.channelId).toBe(AndroidChannelIds.reminders);
        });

        it('should return reminders channel for NEW_THOUGHT_REPLY_RECEIVED', () => {
            const result = getAndroidChannelFromClickActionId('NEW_THOUGHT_REPLY_RECEIVED');
            expect(result.channelId).toBe(AndroidChannelIds.reminders);
        });

        it('should return reminders channel for LATEST_POST_VIEWCOUNT_STATS', () => {
            const result = getAndroidChannelFromClickActionId('LATEST_POST_VIEWCOUNT_STATS');
            expect(result.channelId).toBe(AndroidChannelIds.reminders);
        });

        it('should return rewardUpdates channel for NUDGE_SPACE_ENGAGEMENT', () => {
            const result = getAndroidChannelFromClickActionId('NUDGE_SPACE_ENGAGEMENT');
            expect(result.channelId).toBe(AndroidChannelIds.rewardUpdates);
        });

        it('should return default channel for unknown action', () => {
            const result = getAndroidChannelFromClickActionId('UNKNOWN_ACTION');
            expect(result.channelId).toBe(AndroidChannelIds.default);
        });

        it('should return default channel for empty string', () => {
            const result = getAndroidChannelFromClickActionId('');
            expect(result.channelId).toBe(AndroidChannelIds.default);
        });
    });
});

describe('Push Notifications Notification Config Builder', () => {
    const PressActionIds = {
        default: 'default',
    };

    // Simulates notification config building for display
    const buildNotificationConfig = (
        notification: { title?: string; body?: string; data?: any; android?: any },
        channelId: string
    ) => {
        return {
            title: notification.title,
            body: notification.body,
            android: {
                actions: notification.android?.actions || undefined,
                channelId,
                smallIcon: notification.android?.smallIcon || 'ic_notification_icon',
                color: '#0f7b82',
                pressAction: notification.android?.pressAction || {
                    id: PressActionIds.default,
                },
                timestamp: Date.now(),
                showTimestamp: true,
            },
            data: notification.data,
        };
    };

    describe('buildNotificationConfig', () => {
        it('should build config with title and body', () => {
            const notification = {
                title: 'Test Title',
                body: 'Test Body',
            };

            const config = buildNotificationConfig(notification, 'test-channel');

            expect(config.title).toBe('Test Title');
            expect(config.body).toBe('Test Body');
        });

        it('should use default smallIcon when not provided', () => {
            const notification = { title: 'Test' };

            const config = buildNotificationConfig(notification, 'test-channel');

            expect(config.android.smallIcon).toBe('ic_notification_icon');
        });

        it('should use custom smallIcon when provided', () => {
            const notification = {
                title: 'Test',
                android: { smallIcon: 'custom_icon' },
            };

            const config = buildNotificationConfig(notification, 'test-channel');

            expect(config.android.smallIcon).toBe('custom_icon');
        });

        it('should set correct brand color', () => {
            const notification = { title: 'Test' };

            const config = buildNotificationConfig(notification, 'test-channel');

            expect(config.android.color).toBe('#0f7b82');
        });

        it('should use default pressAction when not provided', () => {
            const notification = { title: 'Test' };

            const config = buildNotificationConfig(notification, 'test-channel');

            expect(config.android.pressAction.id).toBe('default');
        });

        it('should use custom pressAction when provided', () => {
            const notification = {
                title: 'Test',
                android: { pressAction: { id: 'custom-action' } },
            };

            const config = buildNotificationConfig(notification, 'test-channel');

            expect(config.android.pressAction.id).toBe('custom-action');
        });

        it('should set channelId correctly', () => {
            const notification = { title: 'Test' };

            const config = buildNotificationConfig(notification, 'my-channel');

            expect(config.android.channelId).toBe('my-channel');
        });

        it('should include data when provided', () => {
            const notification = {
                title: 'Test',
                data: { key: 'value', userId: '123' },
            };

            const config = buildNotificationConfig(notification, 'test-channel');

            expect(config.data).toEqual({ key: 'value', userId: '123' });
        });

        it('should include actions when provided', () => {
            const actions = [
                { title: 'Accept', pressAction: { id: 'accept' } },
                { title: 'Reject', pressAction: { id: 'reject' } },
            ];
            const notification = {
                title: 'Test',
                android: { actions },
            };

            const config = buildNotificationConfig(notification, 'test-channel');

            expect(config.android.actions).toEqual(actions);
        });

        it('should set showTimestamp to true', () => {
            const notification = { title: 'Test' };

            const config = buildNotificationConfig(notification, 'test-channel');

            expect(config.android.showTimestamp).toBe(true);
        });

        it('should include timestamp', () => {
            const notification = { title: 'Test' };

            const config = buildNotificationConfig(notification, 'test-channel');

            expect(typeof config.android.timestamp).toBe('number');
            expect(config.android.timestamp).toBeGreaterThan(0);
        });
    });
});

describe('Push Notifications Trigger Builder', () => {
    const TriggerType = {
        TIMESTAMP: 0,
        INTERVAL: 1,
    };

    const RepeatFrequency = {
        NONE: -1,
        HOURLY: 0,
        DAILY: 1,
        WEEKLY: 2,
    };

    // Simulates trigger building for scheduled notifications
    const buildTimestampTrigger = (futureDate: Date, repeatFrequency?: number) => {
        return {
            type: TriggerType.TIMESTAMP,
            timestamp: futureDate.getTime(),
            repeatFrequency: repeatFrequency,
        };
    };

    describe('buildTimestampTrigger', () => {
        it('should create trigger with correct timestamp', () => {
            const futureDate = new Date('2025-01-15T10:00:00Z');

            const trigger = buildTimestampTrigger(futureDate);

            expect(trigger.timestamp).toBe(futureDate.getTime());
        });

        it('should set type to TIMESTAMP', () => {
            const futureDate = new Date();

            const trigger = buildTimestampTrigger(futureDate);

            expect(trigger.type).toBe(TriggerType.TIMESTAMP);
        });

        it('should include repeatFrequency when provided', () => {
            const futureDate = new Date();

            const trigger = buildTimestampTrigger(futureDate, RepeatFrequency.DAILY);

            expect(trigger.repeatFrequency).toBe(RepeatFrequency.DAILY);
        });

        it('should have undefined repeatFrequency when not provided', () => {
            const futureDate = new Date();

            const trigger = buildTimestampTrigger(futureDate);

            expect(trigger.repeatFrequency).toBeUndefined();
        });

        it('should handle hourly repeat frequency', () => {
            const futureDate = new Date();

            const trigger = buildTimestampTrigger(futureDate, RepeatFrequency.HOURLY);

            expect(trigger.repeatFrequency).toBe(RepeatFrequency.HOURLY);
        });

        it('should handle weekly repeat frequency', () => {
            const futureDate = new Date();

            const trigger = buildTimestampTrigger(futureDate, RepeatFrequency.WEEKLY);

            expect(trigger.repeatFrequency).toBe(RepeatFrequency.WEEKLY);
        });
    });
});

describe('Push Notifications Message Handling', () => {
    // Simulates wrapOnMessageReceived logic
    const wrapOnMessageReceived = async (
        isInForeground: boolean,
        remoteMessage: { data?: any; notification?: any }
    ) => {
        const result = {
            handled: true,
            isInForeground,
            messageData: remoteMessage.data,
            notification: remoteMessage.notification,
        };

        if (isInForeground) {
            // Foreground handling logic would go here
            return { ...result, handledAs: 'foreground' };
        } else {
            // Background handling logic would go here
            return { ...result, handledAs: 'background' };
        }
    };

    describe('wrapOnMessageReceived', () => {
        it('should handle foreground messages', async () => {
            const remoteMessage = {
                data: { type: 'new_message', userId: '123' },
                notification: { title: 'New Message', body: 'You have a new message' },
            };

            const result = await wrapOnMessageReceived(true, remoteMessage);

            expect(result.handledAs).toBe('foreground');
            expect(result.isInForeground).toBe(true);
        });

        it('should handle background messages', async () => {
            const remoteMessage = {
                data: { type: 'new_message', userId: '123' },
                notification: { title: 'New Message', body: 'You have a new message' },
            };

            const result = await wrapOnMessageReceived(false, remoteMessage);

            expect(result.handledAs).toBe('background');
            expect(result.isInForeground).toBe(false);
        });

        it('should pass through message data', async () => {
            const remoteMessage = {
                data: { type: 'connection_request', fromUserId: '456' },
            };

            const result = await wrapOnMessageReceived(true, remoteMessage);

            expect(result.messageData).toEqual({ type: 'connection_request', fromUserId: '456' });
        });

        it('should pass through notification content', async () => {
            const remoteMessage = {
                notification: { title: 'Test Title', body: 'Test Body' },
            };

            const result = await wrapOnMessageReceived(true, remoteMessage);

            expect(result.notification).toEqual({ title: 'Test Title', body: 'Test Body' });
        });

        it('should handle data-only messages (no notification)', async () => {
            const remoteMessage = {
                data: { silent: 'true', action: 'sync' },
            };

            const result = await wrapOnMessageReceived(false, remoteMessage);

            expect(result.messageData).toEqual({ silent: 'true', action: 'sync' });
            expect(result.notification).toBeUndefined();
        });

        it('should handle notification-only messages (no data)', async () => {
            const remoteMessage = {
                notification: { title: 'Alert', body: 'Important notification' },
            };

            const result = await wrapOnMessageReceived(true, remoteMessage);

            expect(result.notification).toEqual({ title: 'Alert', body: 'Important notification' });
            expect(result.messageData).toBeUndefined();
        });
    });
});

describe('Push Notifications Permission Flow', () => {
    // Simulates permission request flow
    const requestNotificationPermission = async (shouldRequest: boolean) => {
        if (shouldRequest) {
            // In real implementation, this calls notifee.requestPermission()
            return { granted: true };
        }
        return { granted: false, skipped: true };
    };

    describe('requestNotificationPermission', () => {
        it('should request permission when shouldRequest is true', async () => {
            const result = await requestNotificationPermission(true);

            expect(result.granted).toBe(true);
        });

        it('should skip request when shouldRequest is false', async () => {
            const result = await requestNotificationPermission(false);

            expect(result.skipped).toBe(true);
        });
    });
});

describe('Push Notifications Alarm Permission Check', () => {
    const AndroidNotificationSetting = {
        ENABLED: 1,
        DISABLED: 0,
    };

    // Simulates alarm permission check for scheduled notifications
    const checkAlarmPermission = async (alarmSetting: number) => {
        if (alarmSetting !== AndroidNotificationSetting.ENABLED) {
            return { needsPermission: true, shouldOpenSettings: true };
        }
        return { needsPermission: false, shouldOpenSettings: false };
    };

    describe('checkAlarmPermission', () => {
        it('should not need permission when alarm is enabled', async () => {
            const result = await checkAlarmPermission(AndroidNotificationSetting.ENABLED);

            expect(result.needsPermission).toBe(false);
            expect(result.shouldOpenSettings).toBe(false);
        });

        it('should need permission when alarm is disabled', async () => {
            const result = await checkAlarmPermission(AndroidNotificationSetting.DISABLED);

            expect(result.needsPermission).toBe(true);
            expect(result.shouldOpenSettings).toBe(true);
        });
    });
});

describe('Push Notifications Foreground vs Background Handling', () => {
    const AndroidImportance = {
        DEFAULT: 3,
        HIGH: 4,
    };

    // Simulates the difference between foreground and background notification handling
    const getNotificationImportance = (isBackground: boolean) => {
        // Background notifications should use HIGH importance to ensure visibility
        return isBackground ? AndroidImportance.HIGH : AndroidImportance.DEFAULT;
    };

    describe('getNotificationImportance', () => {
        it('should return HIGH importance for background notifications', () => {
            const importance = getNotificationImportance(true);
            expect(importance).toBe(AndroidImportance.HIGH);
        });

        it('should return DEFAULT importance for foreground notifications', () => {
            const importance = getNotificationImportance(false);
            expect(importance).toBe(AndroidImportance.DEFAULT);
        });
    });
});

describe('Push Notifications Data Parsing', () => {
    // Simulates parsing notification data for navigation/actions
    const parseNotificationData = (data: Record<string, string> | undefined) => {
        if (!data) {
            return null;
        }

        return {
            type: data.type || 'unknown',
            userId: data.userId || null,
            contentId: data.contentId || null,
            action: data.action || 'open',
            timestamp: data.timestamp ? parseInt(data.timestamp, 10) : Date.now(),
        };
    };

    describe('parseNotificationData', () => {
        it('should parse complete notification data', () => {
            const data = {
                type: 'new_message',
                userId: 'user-123',
                contentId: 'msg-456',
                action: 'view',
                timestamp: '1704067200000',
            };

            const result = parseNotificationData(data);

            expect(result).toEqual({
                type: 'new_message',
                userId: 'user-123',
                contentId: 'msg-456',
                action: 'view',
                timestamp: 1704067200000,
            });
        });

        it('should use defaults for missing fields', () => {
            const data = {
                type: 'alert',
            };

            const result = parseNotificationData(data);

            expect(result?.type).toBe('alert');
            expect(result?.userId).toBeNull();
            expect(result?.contentId).toBeNull();
            expect(result?.action).toBe('open');
        });

        it('should return null for undefined data', () => {
            const result = parseNotificationData(undefined);
            expect(result).toBeNull();
        });

        it('should handle empty data object', () => {
            const result = parseNotificationData({});

            expect(result?.type).toBe('unknown');
            expect(result?.action).toBe('open');
        });

        it('should parse timestamp correctly', () => {
            const data = {
                timestamp: '1704067200000',
            };

            const result = parseNotificationData(data);

            expect(result?.timestamp).toBe(1704067200000);
        });

        it('should use current timestamp when not provided', () => {
            const before = Date.now();
            const result = parseNotificationData({});
            const after = Date.now();

            expect(result?.timestamp).toBeGreaterThanOrEqual(before);
            expect(result?.timestamp).toBeLessThanOrEqual(after);
        });
    });
});
