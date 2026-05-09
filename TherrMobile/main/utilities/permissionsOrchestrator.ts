import { PermissionsAndroid, Platform } from 'react-native';
import { check, PERMISSIONS, RESULTS } from 'react-native-permissions';
import {
    AuthorizationStatus,
    getMessaging,
    hasPermission,
    requestPermission,
} from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import DeviceInfo from 'react-native-device-info';
import SecureStorage from './SecureStorage';
import {
    requestOSCameraPermissions,
    requestOSContactsPermissions,
} from './requestOSPermissions';

export type PermType = 'notifications' | 'camera' | 'contacts';

export type Trigger =
    | 'capturePress'
    | 'findFriendsTap'
    | 'firstMomentPosted'
    | 'firstMessageSent'
    | 'firstConnectionAccepted'
    | 'secondSession';

type Status = 'granted' | 'denied' | 'blocked';

export interface PermState {
    softAskedAt?: number;
    softAskDismissCount: number;
    osAskedAt?: number;
    lastStatus?: Status;
    appVersionAtLastAsk?: string;
}

export interface RequestOptions {
    trigger: Trigger;
    storePermissionsResponse?: (perms: any) => void;
    onGranted?: () => void;
    onDenied?: (source: 'soft' | 'os') => void;
}

export interface RequestResult {
    status: Status;
    source: 'cached' | 'soft' | 'os';
}

interface PrimerRequest {
    type: PermType;
    resolve: (allowed: boolean) => void;
}

type PrimerListener = (req: PrimerRequest) => void;

const STORAGE_KEY = 'therrPermissionPrompts';
const SOFT_ASK_CAP = 2;
const noopStore = () => {};

let cache: Record<string, PermState> | null = null;
let primerListener: PrimerListener | null = null;
const grantedListeners: Record<PermType, Array<() => void>> = {
    notifications: [],
    camera: [],
    contacts: [],
};

const loadState = async (): Promise<Record<string, PermState>> => {
    if (cache) return cache;
    try {
        const raw = await SecureStorage.getItem(STORAGE_KEY);
        cache = raw ? JSON.parse(raw) : {};
    } catch {
        cache = {};
    }
    return cache!;
};

const persistState = async (state: Record<string, PermState>) => {
    cache = state;
    try {
        await SecureStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Persist failure is non-fatal — caches stay in-memory until next launch.
    }
};

const getStateFor = async (type: PermType): Promise<PermState> => {
    const all = await loadState();
    return all[type] || { softAskDismissCount: 0 };
};

const updateStateFor = async (type: PermType, patch: Partial<PermState>) => {
    const all = await loadState();
    const prev = all[type] || { softAskDismissCount: 0 };
    const next = { ...all, [type]: { ...prev, ...patch } };
    await persistState(next);
};

const checkNotifications = async (): Promise<Status> => {
    try {
        const status = await hasPermission(getMessaging());
        const granted = status === AuthorizationStatus.AUTHORIZED
            || status === AuthorizationStatus.PROVISIONAL;
        if (granted) return 'granted';
        if (status === AuthorizationStatus.DENIED) return 'denied';
        return 'denied';
    } catch {
        return 'denied';
    }
};

const checkRNPermission = async (
    iosPerm: any,
    androidPerm: any,
): Promise<Status> => {
    const perm = Platform.OS === 'ios' ? iosPerm : androidPerm;
    if (!perm) return 'denied';
    const result = await check(perm);
    if (result === RESULTS.GRANTED) return 'granted';
    if (result === RESULTS.BLOCKED) return 'blocked';
    return 'denied';
};

const nativeCheck = async (type: PermType): Promise<Status> => {
    if (type === 'notifications') return checkNotifications();
    if (type === 'camera') {
        return checkRNPermission(PERMISSIONS.IOS.CAMERA, PERMISSIONS.ANDROID.CAMERA);
    }
    if (type === 'contacts') {
        return checkRNPermission(PERMISSIONS.IOS.CONTACTS, PERMISSIONS.ANDROID.READ_CONTACTS);
    }
    return 'denied';
};

const requestNotificationsOS = async (): Promise<Status> => {
    // Mirrors the chain previously inlined in Layout.requestNotificationPermissions:
    // Android 13+ POST_NOTIFICATIONS → notifee → Firebase messaging.
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
        try {
            await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        } catch {
            // Continue — notifee/FCM still need their prompts on iOS / older Android.
        }
    }
    try {
        await notifee.requestPermission();
    } catch {
        // Continue to FCM.
    }
    try {
        await requestPermission(getMessaging());
    } catch {
        // Treated as denied below via the post-request check.
    }
    return checkNotifications();
};

const performOSRequest = async (
    type: PermType,
    storePermissionsResponse: (perms: any) => void,
): Promise<Status> => {
    if (type === 'notifications') return requestNotificationsOS();
    if (type === 'camera') {
        try {
            await requestOSCameraPermissions(storePermissionsResponse);
        } catch {
            return 'denied';
        }
        return checkRNPermission(PERMISSIONS.IOS.CAMERA, PERMISSIONS.ANDROID.CAMERA);
    }
    if (type === 'contacts') {
        try {
            await requestOSContactsPermissions(storePermissionsResponse);
        } catch {
            return 'denied';
        }
        return checkRNPermission(PERMISSIONS.IOS.CONTACTS, PERMISSIONS.ANDROID.READ_CONTACTS);
    }
    return 'denied';
};

const showPrimer = (type: PermType): Promise<boolean> => new Promise((resolve) => {
    if (!primerListener) {
        // No subscriber mounted yet — treat as a soft "not now" so we never
        // skip straight to the OS prompt without an explainer.
        resolve(false);
        return;
    }
    primerListener({ type, resolve });
});

const fireGrantedListeners = (type: PermType) => {
    const fns = grantedListeners[type].slice();
    fns.forEach((fn) => {
        try {
            fn();
        } catch {
            // Listener errors must not break the orchestrator flow.
        }
    });
};

const request = async (type: PermType, opts: RequestOptions): Promise<RequestResult> => {
    const native = await nativeCheck(type);
    if (native === 'granted') {
        await updateStateFor(type, { lastStatus: 'granted' });
        opts.onGranted?.();
        fireGrantedListeners(type);
        return { status: 'granted', source: 'cached' };
    }
    if (native === 'blocked') {
        await updateStateFor(type, { lastStatus: 'blocked' });
        opts.onDenied?.('os');
        return { status: 'blocked', source: 'cached' };
    }

    const state = await getStateFor(type);
    const currentVersion = DeviceInfo.getVersion();
    const sameVersion = state.appVersionAtLastAsk === currentVersion;

    if (sameVersion && (state.softAskDismissCount || 0) >= SOFT_ASK_CAP) {
        return { status: 'denied', source: 'cached' };
    }

    if (!sameVersion && (state.softAskDismissCount || 0) > 0) {
        await updateStateFor(type, {
            softAskDismissCount: 0,
            appVersionAtLastAsk: currentVersion,
        });
    }

    const allowed = await showPrimer(type);
    if (!allowed) {
        const refreshed = await getStateFor(type);
        await updateStateFor(type, {
            softAskedAt: Date.now(),
            softAskDismissCount: (refreshed.softAskDismissCount || 0) + 1,
            appVersionAtLastAsk: currentVersion,
        });
        opts.onDenied?.('soft');
        return { status: 'denied', source: 'soft' };
    }

    const status = await performOSRequest(type, opts.storePermissionsResponse || noopStore);
    await updateStateFor(type, {
        osAskedAt: Date.now(),
        lastStatus: status,
        appVersionAtLastAsk: currentVersion,
    });
    if (status === 'granted') {
        opts.onGranted?.();
        fireGrantedListeners(type);
    } else {
        opts.onDenied?.('os');
    }
    return { status, source: 'os' };
};

const requestIfAppropriate = async (type: PermType, opts: RequestOptions): Promise<void> => {
    const native = await nativeCheck(type);
    if (native === 'granted') {
        await updateStateFor(type, { lastStatus: 'granted' });
        opts.onGranted?.();
        fireGrantedListeners(type);
        return;
    }
    const state = await getStateFor(type);
    // Once the OS has been asked once, opportunistic triggers stop. A user who
    // explicitly visits the relevant feature can still re-enter via request().
    if (state.osAskedAt) return;
    await request(type, opts);
};

const getStatus = (type: PermType): Promise<Status> => nativeCheck(type);

const maybeShowSecondSessionFallback = async (
    navigationTourCount: number | undefined,
): Promise<void> => {
    if ((navigationTourCount || 0) < 1) return;
    await requestIfAppropriate('notifications', { trigger: 'secondSession' });
};

export const registerPrimerListener = (fn: PrimerListener | null) => {
    primerListener = fn;
};

export const onGranted = (type: PermType, fn: () => void): (() => void) => {
    grantedListeners[type].push(fn);
    return () => {
        grantedListeners[type] = grantedListeners[type].filter((f) => f !== fn);
    };
};

const permissions = {
    request,
    requestIfAppropriate,
    getStatus,
    maybeShowSecondSessionFallback,
    registerPrimerListener,
    onGranted,
};

export default permissions;
