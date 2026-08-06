import 'react-native';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, beforeEach, jest } from '@jest/globals';

/**
 * The contacts prominent-disclosure gate.
 *
 * Version 20 of the Android app was rejected under Google Play's User Data policy:
 * "Your app is uploading users' Contact List information to https://api.therr.com/
 * without an adequate disclosure."
 *
 * Two things caused that, and both are covered here:
 *
 *  1. The primer copy claimed the address book "stays on your device" while
 *     `utilities/contacts.ts` was posting it to the API. (Covered by the locale
 *     dictionaries; the modal renders `summary`/`detail`/`optOut`, not `body`.)
 *  2. `request()` short-circuited on an existing OS grant, so anyone who had already
 *     allowed READ_CONTACTS re-uploaded their address book on every subsequent sync
 *     without the disclosure ever being shown. Holding the OS permission is not
 *     consent to the upload — Play policy says the runtime dialog can never be the
 *     disclosure — so the gate below must be independent of the OS grant.
 */

const mockCheck = jest.fn();
const mockSecureGetItem = jest.fn();
const mockSecureSetItem = jest.fn();
const mockRequestOSContactsPermissions = jest.fn();

jest.mock('@react-native-firebase/messaging', () => ({
    AuthorizationStatus: { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 },
    getMessaging: () => ({}),
    hasPermission: jest.fn(),
    requestPermission: jest.fn(),
}));

jest.mock('@notifee/react-native', () => ({
    __esModule: true,
    default: { requestPermission: jest.fn() },
}));

jest.mock('../../main/utilities/SecureStorage', () => ({
    __esModule: true,
    default: {
        getItem: (...args: any[]) => mockSecureGetItem(...args),
        setItem: (...args: any[]) => mockSecureSetItem(...args),
    },
}));

jest.mock('react-native-permissions', () => ({
    check: (...args: any[]) => mockCheck(...args),
    PERMISSIONS: {
        IOS: { CONTACTS: 'ios.permission.CONTACTS', CAMERA: 'ios.permission.CAMERA' },
        ANDROID: {
            READ_CONTACTS: 'android.permission.READ_CONTACTS',
            CAMERA: 'android.permission.CAMERA',
        },
    },
    RESULTS: { GRANTED: 'granted', BLOCKED: 'blocked', DENIED: 'denied' },
}));

jest.mock('../../main/utilities/requestOSPermissions', () => ({
    requestOSCameraPermissions: jest.fn(),
    requestOSContactsPermissions: (...args: any[]) => mockRequestOSContactsPermissions(...args),
}));

// `import 'react-native'` above runs this factory before the `@jest/globals` bindings
// are initialized, so it must not reach for `jest` — hence the plain stub. Contacts and
// camera never touch PermissionsAndroid; only the notifications path does.
jest.mock('react-native', () => ({
    Platform: { OS: 'android', Version: 34 },
    PermissionsAndroid: {
        PERMISSIONS: { POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS' },
        request: () => Promise.resolve('denied'),
    },
}));

// Re-required per test so the orchestrator's module-level state cache and granted-listener
// registry start clean; jest.resetModules() in beforeEach is what makes that work.
const loadOrchestrator = () => require('../../main/utilities/permissionsOrchestrator');

/** Mirrors what SecureStorage would hand back for a user in a given persisted state. */
const persistedState = (state: any) => JSON.stringify(state);

/** The last value written to SecureStorage, parsed. */
const lastPersisted = () => JSON.parse((mockSecureSetItem.mock.calls.at(-1) as any[])[1]);

describe('contacts prominent disclosure gate', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        mockSecureGetItem.mockResolvedValue(null as never);
        mockSecureSetItem.mockResolvedValue(undefined as never);
        mockCheck.mockResolvedValue('granted' as never);
        mockRequestOSContactsPermissions.mockResolvedValue({} as never);
    });

    it('shows the disclosure before collecting even when READ_CONTACTS is already granted', async () => {
        // The exact state of a user upgrading from the rejected build: OS permission
        // held, no record of ever having seen an adequate disclosure.
        const permissions = loadOrchestrator();
        const primerListener = jest.fn(({ resolve }: any) => resolve(true));
        permissions.registerPrimerListener(primerListener);

        const result = await permissions.default.request('contacts', { trigger: 'findFriendsTap' });

        expect(primerListener).toHaveBeenCalledTimes(1);
        expect((primerListener.mock.calls[0] as any[])[0].type).toBe('contacts');
        expect(result.status).toBe('granted');
    });

    it('does not re-ask the OS when the grant was already held and only consent was missing', async () => {
        const permissions = loadOrchestrator();
        permissions.registerPrimerListener(({ resolve }: any) => resolve(true));

        await permissions.default.request('contacts', { trigger: 'findFriendsTap' });

        expect(mockRequestOSContactsPermissions).not.toHaveBeenCalled();
    });

    it('records the accepted disclosure revision so the next sync does not re-prompt', async () => {
        const permissions = loadOrchestrator();
        permissions.registerPrimerListener(({ resolve }: any) => resolve(true));

        await permissions.default.request('contacts', { trigger: 'findFriendsTap' });

        expect(lastPersisted().contacts.disclosureAcceptedRevision).toBe(1);
    });

    it('skips the disclosure once the current revision has been accepted', async () => {
        mockSecureGetItem.mockResolvedValue(persistedState({
            contacts: { softAskDismissCount: 0, disclosureAcceptedRevision: 1 },
        }) as never);

        const permissions = loadOrchestrator();
        const primerListener = jest.fn();
        permissions.registerPrimerListener(primerListener);

        const result = await permissions.default.request('contacts', { trigger: 'findFriendsTap' });

        expect(primerListener).not.toHaveBeenCalled();
        expect(result).toEqual({ status: 'granted', source: 'cached' });
    });

    it('re-asks a user whose accepted revision predates the current disclosure', async () => {
        mockSecureGetItem.mockResolvedValue(persistedState({
            contacts: { softAskDismissCount: 0, disclosureAcceptedRevision: 0 },
        }) as never);

        const permissions = loadOrchestrator();
        const primerListener = jest.fn(({ resolve }: any) => resolve(true));
        permissions.registerPrimerListener(primerListener);

        await permissions.default.request('contacts', { trigger: 'findFriendsTap' });

        expect(primerListener).toHaveBeenCalledTimes(1);
    });

    it('denies — and collects nothing — when the user declines the disclosure', async () => {
        const permissions = loadOrchestrator();
        permissions.registerPrimerListener(({ resolve }: any) => resolve(false));
        const onDenied = jest.fn();
        const grantedListener = jest.fn();
        permissions.onGranted('contacts', grantedListener);

        const result = await permissions.default.request('contacts', {
            trigger: 'findFriendsTap',
            onDenied,
        });

        expect(result).toEqual({ status: 'denied', source: 'soft' });
        expect(onDenied).toHaveBeenCalledWith('soft');
        expect(grantedListener).not.toHaveBeenCalled();
        expect(lastPersisted().contacts.disclosureAcceptedRevision).toBeUndefined();
    });

    it('denies when no primer is mounted rather than falling through to collection', async () => {
        const permissions = loadOrchestrator();
        permissions.registerPrimerListener(null);

        const result = await permissions.default.request('contacts', { trigger: 'findFriendsTap' });

        expect(result.status).toBe('denied');
    });

    it('lets the soft-ask cap throttle nagging but never suppress a pending disclosure', async () => {
        // Two prior dismissals on this same app version. For a permission we simply do
        // not hold, that stops the asking. It must not silently green-light an upload
        // the user has never been told about.
        mockSecureGetItem.mockResolvedValue(persistedState({
            contacts: { softAskDismissCount: 2, appVersionAtLastAsk: '1.0.0' },
        }) as never);

        const permissions = loadOrchestrator();
        const primerListener = jest.fn(({ resolve }: any) => resolve(true));
        permissions.registerPrimerListener(primerListener);

        const result = await permissions.default.request('contacts', { trigger: 'findFriendsTap' });

        expect(primerListener).toHaveBeenCalledTimes(1);
        expect(result.status).toBe('granted');
    });

    it('stays blocked without prompting when the OS has permanently denied contacts', async () => {
        mockCheck.mockResolvedValue('blocked' as never);

        const permissions = loadOrchestrator();
        const primerListener = jest.fn();
        permissions.registerPrimerListener(primerListener);

        const result = await permissions.default.request('contacts', { trigger: 'findFriendsTap' });

        expect(result).toEqual({ status: 'blocked', source: 'cached' });
        expect(primerListener).not.toHaveBeenCalled();
    });

    it('leaves on-device permissions alone — camera still short-circuits on an existing grant', async () => {
        const permissions = loadOrchestrator();
        const primerListener = jest.fn();
        permissions.registerPrimerListener(primerListener);

        const result = await permissions.default.request('camera', { trigger: 'capturePress' });

        expect(primerListener).not.toHaveBeenCalled();
        expect(result).toEqual({ status: 'granted', source: 'cached' });
    });
});
