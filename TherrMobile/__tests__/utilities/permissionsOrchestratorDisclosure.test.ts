jest.mock('react-native-permissions', () => ({
    check: jest.fn(),
    PERMISSIONS: {
        IOS: { CAMERA: 'ios.camera', CONTACTS: 'ios.contacts' },
        ANDROID: { CAMERA: 'android.camera', READ_CONTACTS: 'android.readContacts' },
    },
    RESULTS: {
        GRANTED: 'granted',
        DENIED: 'denied',
        BLOCKED: 'blocked',
        LIMITED: 'limited',
        UNAVAILABLE: 'unavailable',
    },
}));

jest.mock('@notifee/react-native', () => ({
    __esModule: true,
    default: {
        getNotificationSettings: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
        requestPermission: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
    },
    AuthorizationStatus: { DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 },
}));

jest.mock('../../main/utilities/requestOSPermissions', () => ({
    requestOSCameraPermissions: jest.fn(() => Promise.resolve({})),
    requestOSContactsPermissions: jest.fn(() => Promise.resolve({})),
}));

jest.mock('../../main/utilities/SecureStorage', () => {
    const store: Record<string, string> = {};

    return {
        __esModule: true,
        default: {
            getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
            setItem: jest.fn((key: string, value: string) => {
                store[key] = value;
                return Promise.resolve();
            }),
            removeItem: jest.fn((key: string) => {
                delete store[key];
                return Promise.resolve();
            }),
        },
    };
});

/**
 * The contacts primer is a Google Play "Prominent Disclosure". Version 20 of the Android
 * app was rejected under the User Data policy because it uploaded the address book to
 * api.therr.com while the primer claimed the address book stayed on the device.
 *
 * These tests pin the two properties that make the corrected disclosure actually reach
 * users: an existing OS grant does not skip it, and the soft-ask throttle does not
 * suppress it. Both failure modes are silent — contacts still sync, nothing errors, and
 * only a Play reviewer ever notices.
 */
describe('permissionsOrchestrator prominent disclosure', () => {
    /**
     * The orchestrator caches persisted state in a module-level variable, so each case
     * needs a fresh module registry. `jest.resetModules()` hands out a fresh copy of the
     * mocked modules too, so they must be pulled from that same registry — a top-level
     * import would configure a stale copy the subject never sees.
     */
    const loadOrchestrator = (nativeStatus: string, accept: boolean) => {
        const { check } = require('react-native-permissions');
        const mod = require('../../main/utilities/permissionsOrchestrator');
        const os = require('../../main/utilities/requestOSPermissions');
        (check as jest.Mock).mockResolvedValue(nativeStatus);

        const shown: string[] = [];
        mod.default.registerPrimerListener(({ type, resolve }) => {
            shown.push(type);
            resolve(accept);
        });

        return {
            permissions: mod.default,
            requestOSContactsPermissions: os.requestOSContactsPermissions,
            shown,
        };
    };

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('shows the disclosure for contacts even when the OS permission is already granted', async () => {
        const { permissions, requestOSContactsPermissions, shown } = loadOrchestrator('granted', true);

        const result = await permissions.request('contacts', { trigger: 'findFriendsTap' });

        expect(shown).toEqual(['contacts']);
        expect(result.status).toBe('granted');
        // The OS grant was already held, so there is nothing to re-request.
        expect(requestOSContactsPermissions).not.toHaveBeenCalled();
    });

    it('does not re-show the disclosure once accepted at the current revision', async () => {
        const { permissions, shown } = loadOrchestrator('granted', true);

        await permissions.request('contacts', { trigger: 'findFriendsTap' });
        await permissions.request('contacts', { trigger: 'findFriendsTap' });

        expect(shown).toEqual(['contacts']);
    });

    it('still shows the disclosure after the soft-ask cap is exhausted', async () => {
        const { permissions, shown } = loadOrchestrator('denied', false);

        // Two declines is SOFT_ASK_CAP — a normal permission stops asking after this.
        await permissions.request('contacts', { trigger: 'findFriendsTap' });
        await permissions.request('contacts', { trigger: 'findFriendsTap' });
        await permissions.request('contacts', { trigger: 'findFriendsTap' });

        expect(shown).toHaveLength(3);
    });

    it('throttles a permission with no disclosure at the soft-ask cap', async () => {
        const { permissions, shown } = loadOrchestrator('denied', false);

        await permissions.request('camera', { trigger: 'capturePress' });
        await permissions.request('camera', { trigger: 'capturePress' });
        await permissions.request('camera', { trigger: 'capturePress' });

        expect(shown).toHaveLength(2);
    });

    it('does not prompt at all when the OS has blocked contacts', async () => {
        const { permissions, shown } = loadOrchestrator('blocked', true);

        const result = await permissions.request('contacts', { trigger: 'findFriendsTap' });

        expect(shown).toEqual([]);
        expect(result.status).toBe('blocked');
    });
});
