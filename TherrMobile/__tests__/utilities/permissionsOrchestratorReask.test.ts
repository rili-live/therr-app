import 'react-native';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, beforeEach, jest } from '@jest/globals';

/**
 * `requestOnceMoreIfDeclined`: the single second ask for a user who declined notifications.
 *
 * Push is the only channel that brings a lapsed Friends with Habits user back (comeback
 * pushes were followed by a check-in, comeback emails never were), and the opportunistic
 * triggers stop for good after the first OS ask. Declining once at the first check-in made a
 * user unreachable by push for the life of the install. This guards both ends of the fix:
 * the second ask happens, and it happens only once, only where the OS will show it.
 */

const mockHasPermission = jest.fn();
const mockRequestPermission = jest.fn();
const mockNotifeeRequestPermission = jest.fn();
const mockAndroidRequest = jest.fn();
const mockSecureGetItem = jest.fn();
const mockSecureSetItem = jest.fn();
const mockPlatform: { OS: string; Version: number } = { OS: 'android', Version: 34 };

const AUTHORIZED = 1;
const DENIED = 0;

jest.mock('@react-native-firebase/messaging', () => ({
    AuthorizationStatus: { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 },
    getMessaging: () => ({}),
    hasPermission: (...args: any[]) => mockHasPermission(...args),
    requestPermission: (...args: any[]) => mockRequestPermission(...args),
}));

jest.mock('@notifee/react-native', () => ({
    __esModule: true,
    default: { requestPermission: (...args: any[]) => mockNotifeeRequestPermission(...args) },
}));

jest.mock('../../main/utilities/SecureStorage', () => ({
    __esModule: true,
    default: {
        getItem: (...args: any[]) => mockSecureGetItem(...args),
        setItem: (...args: any[]) => mockSecureSetItem(...args),
    },
}));

jest.mock('react-native-permissions', () => ({
    check: jest.fn(),
    PERMISSIONS: { IOS: {}, ANDROID: {} },
    RESULTS: { GRANTED: 'granted', BLOCKED: 'blocked', DENIED: 'denied' },
}));

jest.mock('../../main/utilities/requestOSPermissions', () => ({
    requestOSCameraPermissions: jest.fn(),
    requestOSContactsPermissions: jest.fn(),
}));

jest.mock('react-native', () => ({
    get Platform() {
        return mockPlatform;
    },
    PermissionsAndroid: {
        PERMISSIONS: { POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS' },
        request: (...args: any[]) => mockAndroidRequest(...args),
    },
}));

const loadOrchestrator = () => require('../../main/utilities/permissionsOrchestrator');

const storedState = (notifications: Record<string, any>) => JSON.stringify({ notifications });

const lastPersisted = () => JSON.parse((mockSecureSetItem.mock.calls.at(-1) as any[])[1]);

/** Registers a primer listener that answers the shared primer modal with `allowed`. */
const answerPrimer = (permissions: any, allowed: boolean) => {
    const listener = jest.fn(({ resolve }: any) => resolve(allowed));
    permissions.registerPrimerListener(listener);
    return listener;
};

describe('permissions.requestOnceMoreIfDeclined', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        mockPlatform.OS = 'android';
        mockPlatform.Version = 34;
        mockSecureSetItem.mockResolvedValue(undefined as never);
        mockAndroidRequest.mockResolvedValue('granted' as never);
        mockNotifeeRequestPermission.mockResolvedValue({} as never);
        mockRequestPermission.mockResolvedValue(AUTHORIZED as never);
    });

    it('asks a user who declined at the OS prompt one more time, through the primer', async () => {
        mockSecureGetItem.mockResolvedValue(storedState({ softAskDismissCount: 0, osAskedAt: 1, lastStatus: 'denied' }) as never);
        mockHasPermission
            .mockResolvedValueOnce(DENIED as never)
            .mockResolvedValueOnce(DENIED as never)
            .mockResolvedValue(AUTHORIZED as never);

        const permissions = loadOrchestrator();
        const primer = answerPrimer(permissions, true);
        const granted = jest.fn();
        permissions.onGranted('notifications', granted);

        await permissions.default.requestOnceMoreIfDeclined('notifications', { trigger: 'streakProtect' });

        expect(primer).toHaveBeenCalledTimes(1);
        expect(mockAndroidRequest).toHaveBeenCalledWith('android.permission.POST_NOTIFICATIONS');
        // The FCM token registers off this listener in Layout.
        expect(granted).toHaveBeenCalledTimes(1);
        expect(lastPersisted().notifications.osReaskedAt).toEqual(expect.any(Number));
    });

    it('never asks a second time', async () => {
        mockSecureGetItem.mockResolvedValue(storedState({
            softAskDismissCount: 0, osAskedAt: 1, osReaskedAt: 2, lastStatus: 'denied',
        }) as never);
        mockHasPermission.mockResolvedValue(DENIED as never);

        const permissions = loadOrchestrator();
        const primer = answerPrimer(permissions, true);

        await permissions.default.requestOnceMoreIfDeclined('notifications', { trigger: 'streakProtect' });

        expect(primer).not.toHaveBeenCalled();
        expect(mockAndroidRequest).not.toHaveBeenCalled();
    });

    it('spends the one chance even when the primer is dismissed', async () => {
        mockSecureGetItem.mockResolvedValue(storedState({ softAskDismissCount: 0, osAskedAt: 1, lastStatus: 'denied' }) as never);
        mockHasPermission.mockResolvedValue(DENIED as never);

        const permissions = loadOrchestrator();
        answerPrimer(permissions, false);

        await permissions.default.requestOnceMoreIfDeclined('notifications', { trigger: 'streakProtect' });
        expect(mockAndroidRequest).not.toHaveBeenCalled();

        const primer = answerPrimer(permissions, true);
        await permissions.default.requestOnceMoreIfDeclined('notifications', { trigger: 'streakProtect' });
        expect(primer).not.toHaveBeenCalled();
    });

    it('does not ask on Android below 13, where the OS dialog would not appear', async () => {
        mockPlatform.Version = 32;
        mockSecureGetItem.mockResolvedValue(storedState({ softAskDismissCount: 0, osAskedAt: 1, lastStatus: 'denied' }) as never);
        mockHasPermission.mockResolvedValue(DENIED as never);

        const permissions = loadOrchestrator();
        const primer = answerPrimer(permissions, true);

        await permissions.default.requestOnceMoreIfDeclined('notifications', { trigger: 'streakProtect' });

        expect(primer).not.toHaveBeenCalled();
    });

    it('does not ask on iOS, where a declined permission only returns from Settings', async () => {
        mockPlatform.OS = 'ios';
        mockSecureGetItem.mockResolvedValue(storedState({ softAskDismissCount: 0, osAskedAt: 1, lastStatus: 'denied' }) as never);
        mockHasPermission.mockResolvedValue(DENIED as never);

        const permissions = loadOrchestrator();
        const primer = answerPrimer(permissions, true);

        await permissions.default.requestOnceMoreIfDeclined('notifications', { trigger: 'streakProtect' });

        expect(primer).not.toHaveBeenCalled();
    });

    it('takes the ordinary path for a user the OS never asked', async () => {
        mockSecureGetItem.mockResolvedValue(null as never);
        // Three reads before the OS dialog: this entry point, requestIfAppropriate, request.
        mockHasPermission
            .mockResolvedValueOnce(DENIED as never)
            .mockResolvedValueOnce(DENIED as never)
            .mockResolvedValueOnce(DENIED as never)
            .mockResolvedValue(AUTHORIZED as never);

        const permissions = loadOrchestrator();
        const primer = answerPrimer(permissions, true);

        await permissions.default.requestOnceMoreIfDeclined('notifications', { trigger: 'streakProtect' });

        expect(primer).toHaveBeenCalledTimes(1);
        // Not the second chance: that is still available after a later OS decline.
        expect(lastPersisted().notifications.osReaskedAt).toBeUndefined();
        expect(lastPersisted().notifications.osAskedAt).toEqual(expect.any(Number));
    });

    it('only fires the granted listeners when notifications are already on', async () => {
        mockSecureGetItem.mockResolvedValue(storedState({ softAskDismissCount: 0, osAskedAt: 1, lastStatus: 'granted' }) as never);
        mockHasPermission.mockResolvedValue(AUTHORIZED as never);

        const permissions = loadOrchestrator();
        const primer = answerPrimer(permissions, true);
        const granted = jest.fn();
        permissions.onGranted('notifications', granted);

        await permissions.default.requestOnceMoreIfDeclined('notifications', { trigger: 'streakProtect' });

        expect(primer).not.toHaveBeenCalled();
        expect(mockAndroidRequest).not.toHaveBeenCalled();
        expect(granted).toHaveBeenCalledTimes(1);
    });
});
