// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, beforeEach } from '@jest/globals';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    APP_UPDATE_DISMISSED_STORAGE_KEY,
    IAppUpdatePolicy,
    checkAppUpdatePrompt,
    getAppUpdatePromptType,
    markRecommendedUpdateDismissed,
} from '../../main/utilities/appUpdatePrompt';

/**
 * App Update Prompt Tests
 *
 * `components/Layout.tsx` shows the update modal purely on the verdict of these functions. The
 * failure that matters most is a false "required" — that locks a user out of the app — so
 * every degraded path (offline, a 5xx, an unknown status) must resolve to no prompt at all.
 */

jest.mock('axios', () => ({ get: jest.fn() }));

const mockedGet = axios.get as unknown as jest.Mock;

const policy = (overrides: Partial<IAppUpdatePolicy>): IAppUpdatePolicy => ({
    status: 'none',
    currentVersion: '1.20.0',
    minimumVersion: null,
    recommendedVersion: null,
    ...overrides,
});

describe('getAppUpdatePromptType', () => {
    it('blocks on a required update, whatever was dismissed before', () => {
        expect(getAppUpdatePromptType(policy({ status: 'required', recommendedVersion: '1.21.0' }), '1.21.0')).toBe('required');
    });

    it('nudges on a recommended update the user has not dismissed', () => {
        expect(getAppUpdatePromptType(policy({ status: 'recommended', recommendedVersion: '1.21.0' }), null)).toBe('recommended');
    });

    it('stays quiet for a recommended version already dismissed', () => {
        expect(getAppUpdatePromptType(policy({ status: 'recommended', recommendedVersion: '1.21.0' }), '1.21.0')).toBeNull();
    });

    it('nudges again once a newer version is recommended', () => {
        expect(getAppUpdatePromptType(policy({ status: 'recommended', recommendedVersion: '1.22.0' }), '1.21.0')).toBe('recommended');
    });

    it('shows nothing for no policy or an unknown status', () => {
        expect(getAppUpdatePromptType(null)).toBeNull();
        expect(getAppUpdatePromptType(policy({ status: 'none' }))).toBeNull();
        expect(getAppUpdatePromptType({ status: 'blocked' } as any)).toBeNull();
    });
});

describe('checkAppUpdatePrompt', () => {
    beforeEach(async () => {
        mockedGet.mockReset();
        await AsyncStorage.clear();
    });

    it('asks the users-service policy endpoint', async () => {
        mockedGet.mockResolvedValue({ data: policy({ status: 'none' }) } as never);

        await checkAppUpdatePrompt();

        expect(mockedGet).toHaveBeenCalledWith('/users-service/app-version/policy');
    });

    it('returns the prompt along with the version a dismissal is recorded against', async () => {
        mockedGet.mockResolvedValue({ data: policy({ status: 'recommended', recommendedVersion: '1.21.0' }) } as never);

        expect(await checkAppUpdatePrompt()).toEqual({ type: 'recommended', recommendedVersion: '1.21.0' });
    });

    it('remembers a dismissal across checks', async () => {
        mockedGet.mockResolvedValue({ data: policy({ status: 'recommended', recommendedVersion: '1.21.0' }) } as never);

        await markRecommendedUpdateDismissed('1.21.0');

        expect(await AsyncStorage.getItem(APP_UPDATE_DISMISSED_STORAGE_KEY)).toBe('1.21.0');
        expect(await checkAppUpdatePrompt()).toBeNull();
    });

    it('shows nothing when the request fails', async () => {
        mockedGet.mockRejectedValue(new Error('500') as never);

        expect(await checkAppUpdatePrompt()).toBeNull();
    });

    // The interceptor resolves a transient GET failure with an empty body instead of rejecting.
    it('shows nothing for the offline fallback response', async () => {
        mockedGet.mockResolvedValue({ data: {}, isOfflineFallback: true } as never);

        expect(await checkAppUpdatePrompt()).toBeNull();
    });
});
