import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

/**
 * Decides when to tell the user their installed build is behind.
 *
 * The server owns the policy (users-service `utilities/appVersionPolicy.ts`): it compares the
 * `x-app-version` this build sends against per-brand, per-OS `main.config` rows, so raising
 * a minimum takes one UPDATE and no release. This side only decides how to present it:
 *
 *   required    blocking dialog, no way past it but the store
 *   recommended dismissible nudge, shown once per recommended version
 *
 * Every failure — offline, a 5xx, a corrupt storage read — resolves to "show nothing". An
 * update prompt that misfires and locks a user out is far worse than one that never shows.
 */

export const APP_UPDATE_DISMISSED_STORAGE_KEY = 'appUpdatePromptDismissedVersion';

/** Re-ask the server at most this often when the app comes back to the foreground. */
export const APP_UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export type AppUpdateStatus = 'none' | 'recommended' | 'required';

export interface IAppUpdatePolicy {
    status: AppUpdateStatus;
    currentVersion: string | null;
    minimumVersion: string | null;
    recommendedVersion: string | null;
}

export type AppUpdatePromptType = 'recommended' | 'required';

export const fetchAppUpdatePolicy = (): Promise<IAppUpdatePolicy | null> => axios
    .get('/users-service/app-version/policy')
    // The interceptor resolves a transient GET failure with `{ data: {} }`, which has no status.
    .then((response) => (response?.data?.status ? response.data as IAppUpdatePolicy : null))
    .catch(() => null);

/**
 * Which prompt, if any, a policy calls for. A recommended update the user already dismissed
 * stays dismissed until the server recommends a newer version; a required one never does.
 */
export const getAppUpdatePromptType = (
    policy: IAppUpdatePolicy | null | undefined,
    dismissedRecommendedVersion?: string | null,
): AppUpdatePromptType | null => {
    if (policy?.status === 'required') {
        return 'required';
    }

    if (policy?.status === 'recommended' && policy.recommendedVersion !== dismissedRecommendedVersion) {
        return 'recommended';
    }

    return null;
};

export const getDismissedRecommendedVersion = (): Promise<string | null> => AsyncStorage
    .getItem(APP_UPDATE_DISMISSED_STORAGE_KEY)
    .catch(() => null);

export const markRecommendedUpdateDismissed = (version: string | null): Promise<void> => {
    if (!version) {
        return Promise.resolve();
    }

    return AsyncStorage.setItem(APP_UPDATE_DISMISSED_STORAGE_KEY, version).catch(() => undefined);
};

export interface IAppUpdatePrompt {
    type: AppUpdatePromptType;
    /** The version a dismissal is recorded against. */
    recommendedVersion: string | null;
}

/** Fetch the policy and resolve the prompt to show right now, if any. Never rejects. */
export const checkAppUpdatePrompt = async (): Promise<IAppUpdatePrompt | null> => {
    const policy = await fetchAppUpdatePolicy();

    if (!policy || policy.status === 'none') {
        return null;
    }

    const dismissedVersion = policy.status === 'recommended'
        ? await getDismissedRecommendedVersion()
        : null;
    const type = getAppUpdatePromptType(policy, dismissedVersion);

    return type ? { type, recommendedVersion: policy.recommendedVersion } : null;
};
