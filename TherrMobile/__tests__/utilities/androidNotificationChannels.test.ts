// Note: import explicitly to use the types shipped with jest.
import {
    it, describe, expect, beforeEach, afterEach, jest,
} from '@jest/globals';

/**
 * Eager Android channel registration.
 *
 * Channels used to be created only as a side effect of Notifee rendering a
 * notification — i.e. only on the data-only push path and the local trigger
 * notifications. push-notifications-service also sends *display* notifications
 * (createNotificationMessage) that name a channelId in the FCM payload and are
 * rendered by the OS with no JS involved: dailyHabitReminder, morningMotivation,
 * eveningCheckIn, streakBroken and pactDeclined all name `reminders`.
 *
 * On a fresh install that had not yet received a data-only push, `reminders` did
 * not exist, so the OS posted those on the FCM SDK's auto-created "Miscellaneous"
 * channel at DEFAULT importance — no heads-up banner, and a name the user cannot
 * recognize in Android notification settings. On HABITS that is the whole daily
 * reminder loop.
 */

const mockCreateChannels = jest.fn();

const AndroidImportanceMock = {
    NONE: 0, MIN: 1, LOW: 2, DEFAULT: 3, HIGH: 4,
};

jest.mock('@notifee/react-native', () => ({
    __esModule: true,
    default: {
        createChannels: (...args: any[]) => mockCreateChannels(...args),
        createChannel: jest.fn(),
        requestPermission: jest.fn(),
        displayNotification: jest.fn(),
        createTriggerNotification: jest.fn(),
    },
    AndroidImportance: AndroidImportanceMock,
    AndroidNotificationSetting: { ENABLED: 1 },
    RepeatFrequency: { NONE: -1 },
    TriggerType: { TIMESTAMP: 0 },
}));

const loadFor = (os: 'android' | 'ios') => {
    jest.doMock('react-native', () => ({ Platform: { OS: os } }));

    return {
        pushNotifications: require('../../main/utilities/pushNotifications'),
        constants: require('../../main/constants'),
    };
};

describe('getAllAndroidChannels', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('returns every channel the app declares, so none can be left unregistered', () => {
        const { constants } = loadFor('android');
        const ids = constants.getAllAndroidChannels().map((channel: any) => channel.id).sort();

        expect(ids).toEqual(['contentDiscovery', 'default', 'reminders', 'rewardUpdates']);
        // Guards against a new AndroidChannelIds entry that nothing registers.
        expect(ids).toHaveLength(Object.keys(constants.AndroidChannelIds).length);
    });

    it('carries each channel\'s declared importance, not a flat default', () => {
        const { constants } = loadFor('android');
        const byId = new Map<string, any>(
            constants.getAllAndroidChannels().map((channel: any) => [channel.id, channel]),
        );

        // The two channels that must be able to show a heads-up banner. Android
        // locks importance at creation, so registering the wrong value here is
        // permanent for the life of the install.
        expect(byId.get('reminders').importance).toBe(AndroidImportanceMock.HIGH);
        expect(byId.get('rewardUpdates').importance).toBe(AndroidImportanceMock.HIGH);
        expect(byId.get('default').importance).toBe(AndroidImportanceMock.DEFAULT);
        expect(byId.get('contentDiscovery').importance).toBe(AndroidImportanceMock.DEFAULT);
    });

    it('gives every channel a user-facing name, so none reads as "Miscellaneous"', () => {
        const { constants } = loadFor('android');

        constants.getAllAndroidChannels().forEach((channel: any) => {
            expect(typeof channel.name).toBe('string');
            expect(channel.name.length).toBeGreaterThan(0);
        });
    });
});

describe('createAndroidNotificationChannels', () => {
    let logSpy: any;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        mockCreateChannels.mockResolvedValue(undefined as never);
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    it('registers all four channels up front on Android', async () => {
        const { pushNotifications, constants } = loadFor('android');

        await pushNotifications.createAndroidNotificationChannels();

        expect(mockCreateChannels).toHaveBeenCalledTimes(1);
        const registered = mockCreateChannels.mock.calls[0][0] as any[];
        expect(registered.map((channel) => channel.id).sort())
            .toEqual(constants.getAllAndroidChannels().map((channel: any) => channel.id).sort());
    });

    it('registers `reminders` — the channel display-only pushes name in their payload', async () => {
        const { pushNotifications } = loadFor('android');

        await pushNotifications.createAndroidNotificationChannels();

        const registered = mockCreateChannels.mock.calls[0][0] as any[];
        const reminders = registered.find((channel) => channel.id === 'reminders');

        expect(reminders).toBeDefined();
        expect(reminders.importance).toBe(AndroidImportanceMock.HIGH);
    });

    it('is a no-op on iOS, where channels do not exist', async () => {
        const { pushNotifications } = loadFor('ios');

        await pushNotifications.createAndroidNotificationChannels();

        expect(mockCreateChannels).not.toHaveBeenCalled();
    });

    it('resolves even when the native call rejects, so app start never breaks', async () => {
        mockCreateChannels.mockRejectedValue(new Error('native module unavailable') as never);
        const { pushNotifications } = loadFor('android');

        await expect(pushNotifications.createAndroidNotificationChannels()).resolves.toBeUndefined();
    });
});
