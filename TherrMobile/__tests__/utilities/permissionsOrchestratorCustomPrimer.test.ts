import 'react-native';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, beforeEach, jest } from '@jest/globals';

/**
 * `requestAfterCustomPrimer` — the entry point for screens that render their own
 * full-screen explainer instead of the shared primer modal.
 *
 * The HABITS onboarding push opt-in screen used to call
 * `PermissionsAndroid.request` / `notifee.requestPermission()` directly. That asks
 * the OS correctly, but nothing else in the app finds out: Layout registers the FCM
 * device token from `permissions.onGranted('notifications')`, so a brand-new user who
 * tapped "Enable" had no device token stored server-side until their next cold start
 * — no push notifications at all for the rest of that session. And because
 * `osAskedAt` was never stamped, the second-session fallback re-prompted someone who
 * had already answered.
 */

const mockHasPermission = jest.fn();
const mockRequestPermission = jest.fn();
const mockNotifeeRequestPermission = jest.fn();
const mockAndroidRequest = jest.fn();
const mockSecureGetItem = jest.fn();
const mockSecureSetItem = jest.fn();

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
    Platform: { OS: 'android', Version: 34 },
    PermissionsAndroid: {
        PERMISSIONS: { POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS' },
        request: (...args: any[]) => mockAndroidRequest(...args),
    },
}));

// Re-required per test so the orchestrator's module-level state cache and granted-listener
// registry start clean; jest.resetModules() in beforeEach is what makes that work.
const loadOrchestrator = () => require('../../main/utilities/permissionsOrchestrator');

describe('permissions.requestAfterCustomPrimer', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        mockSecureGetItem.mockResolvedValue(null as never);
        mockSecureSetItem.mockResolvedValue(undefined as never);
        mockAndroidRequest.mockResolvedValue('granted' as never);
        mockNotifeeRequestPermission.mockResolvedValue({} as never);
        mockRequestPermission.mockResolvedValue(AUTHORIZED as never);
    });

    it('fires onGranted listeners so Layout registers the FCM device token', async () => {
        // Denied before the ask, authorized after it — the real opt-in sequence.
        mockHasPermission
            .mockResolvedValueOnce(DENIED as never)
            .mockResolvedValue(AUTHORIZED as never);

        const permissions = loadOrchestrator();
        const listener = jest.fn();
        permissions.onGranted('notifications', listener);

        const status = await permissions.default.requestAfterCustomPrimer('notifications', {
            trigger: 'habitsOnboarding',
        });

        expect(status).toBe('granted');
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('actually asks the OS rather than assuming the caller did', async () => {
        mockHasPermission
            .mockResolvedValueOnce(DENIED as never)
            .mockResolvedValue(AUTHORIZED as never);

        const permissions = loadOrchestrator();
        await permissions.default.requestAfterCustomPrimer('notifications', { trigger: 'habitsOnboarding' });

        expect(mockAndroidRequest).toHaveBeenCalledWith('android.permission.POST_NOTIFICATIONS');
        expect(mockNotifeeRequestPermission).toHaveBeenCalled();
        expect(mockRequestPermission).toHaveBeenCalled();
    });

    it('stamps osAskedAt so the second-session fallback does not re-prompt', async () => {
        mockHasPermission
            .mockResolvedValueOnce(DENIED as never)
            .mockResolvedValue(AUTHORIZED as never);

        const permissions = loadOrchestrator();
        await permissions.default.requestAfterCustomPrimer('notifications', { trigger: 'habitsOnboarding' });

        expect(mockSecureSetItem).toHaveBeenCalled();
        const persisted = JSON.parse((mockSecureSetItem.mock.calls.at(-1) as any[])[1]);
        expect(persisted.notifications.osAskedAt).toEqual(expect.any(Number));
        expect(persisted.notifications.lastStatus).toBe('granted');
    });

    it('does not show the shared primer modal — the caller is the primer', async () => {
        mockHasPermission
            .mockResolvedValueOnce(DENIED as never)
            .mockResolvedValue(AUTHORIZED as never);

        const permissions = loadOrchestrator();
        const primerListener = jest.fn();
        permissions.registerPrimerListener(primerListener);

        await permissions.default.requestAfterCustomPrimer('notifications', { trigger: 'habitsOnboarding' });

        expect(primerListener).not.toHaveBeenCalled();
    });

    it('reports denial and calls onDenied when the user refuses at the OS prompt', async () => {
        mockHasPermission.mockResolvedValue(DENIED as never);

        const permissions = loadOrchestrator();
        const listener = jest.fn();
        permissions.onGranted('notifications', listener);
        const onDenied = jest.fn();

        const status = await permissions.default.requestAfterCustomPrimer('notifications', {
            trigger: 'habitsOnboarding',
            onDenied,
        });

        expect(status).toBe('denied');
        expect(onDenied).toHaveBeenCalledWith('os');
        expect(listener).not.toHaveBeenCalled();
    });

    it('short-circuits when already granted, but still fires the listeners', async () => {
        mockHasPermission.mockResolvedValue(AUTHORIZED as never);

        const permissions = loadOrchestrator();
        const listener = jest.fn();
        permissions.onGranted('notifications', listener);

        const status = await permissions.default.requestAfterCustomPrimer('notifications', {
            trigger: 'habitsOnboarding',
        });

        expect(status).toBe('granted');
        // Token registration must still happen for a user who granted on a previous install.
        expect(listener).toHaveBeenCalledTimes(1);
        expect(mockAndroidRequest).not.toHaveBeenCalled();
    });

    it('is callable with no options at all', async () => {
        mockHasPermission.mockResolvedValue(AUTHORIZED as never);

        const permissions = loadOrchestrator();
        await expect(permissions.default.requestAfterCustomPrimer('notifications')).resolves.toBe('granted');
    });
});
