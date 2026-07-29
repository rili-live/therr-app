import AsyncStorage from '@react-native-async-storage/async-storage';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, beforeEach, expect } from '@jest/globals';

// `main/constants` (the source of the onboarding name placeholders) pulls in
// notifee, which reaches for its native module at import time.
jest.mock('@notifee/react-native', () => ({
    __esModule: true,
    default: { createChannel: jest.fn() },
    AndroidImportance: { HIGH: 4, DEFAULT: 3, LOW: 2 },
    AndroidVisibility: { PUBLIC: 1 },
}));

const mockGetUserInterests = jest.fn();
jest.mock('therr-react/services', () => ({
    UsersService: {
        getUserInterests: (...args: any[]) => mockGetUserInterests(...args),
    },
}));

import {
    DEFAULT_PROFILE_COMPLETION_FLAGS,
    getProfileCompletionFlags,
    getProfileCompletionSummary,
    markContactsSkipped,
    markContactsSynced,
    markInterestsSelected,
    syncInterestsFlag,
} from '../../main/utilities/profileCompletion';

const buildUser = (details: any = {}, ) => ({
    details: {
        id: 'user-123',
        userName: 'testuser',
        ...details,
    },
} as any);

const allFlags = {
    hasSelectedInterests: true,
    hasSyncedContacts: true,
    hasSkippedContacts: false,
};

beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
});

describe('getProfileCompletionSummary', () => {
    it('reports every step as remaining for a brand new profile', () => {
        const summary = getProfileCompletionSummary(buildUser(), DEFAULT_PROFILE_COMPLETION_FLAGS);

        expect(summary.totalCount).toBe(5);
        expect(summary.resolvedCount).toBe(0);
        expect(summary.remainingCount).toBe(5);
        expect(summary.isComplete).toBe(false);
        expect(summary.percentComplete).toBe(0);
    });

    it('walks the user through steps in order via nextStep', () => {
        const summary = getProfileCompletionSummary(buildUser(), DEFAULT_PROFILE_COMPLETION_FLAGS);
        expect(summary.nextStep?.key).toBe('name');

        const withName = getProfileCompletionSummary(
            buildUser({ firstName: 'Zack', lastName: 'Anselm' }),
            DEFAULT_PROFILE_COMPLETION_FLAGS,
        );
        expect(withName.nextStep?.key).toBe('interests');
        expect(withName.remainingCount).toBe(4);
    });

    it('maps each step to the CreateProfile stage that resumes it', () => {
        const summary = getProfileCompletionSummary(buildUser(), DEFAULT_PROFILE_COMPLETION_FLAGS);
        const stagesByKey = summary.steps.reduce((acc: any, step) => ({ ...acc, [step.key]: step.stage }), {});

        expect(stagesByKey).toEqual({
            name: 'details',
            interests: 'interests',
            picture: 'picture',
            phone: 'phone',
            contacts: 'contacts',
        });
    });

    it('treats the iOS placeholder name as no name at all', () => {
        // Onboarding seeds "Anonymous User" on iOS so an account can be created
        // without a name. Counting that as a finished step would silently hide
        // the very nudge this checklist exists for.
        const placeholder = getProfileCompletionSummary(
            buildUser({ firstName: 'Anonymous', lastName: 'User' }),
            DEFAULT_PROFILE_COMPLETION_FLAGS,
        );
        expect(placeholder.steps.find((s) => s.key === 'name')?.isComplete).toBe(false);

        // A real first name paired with the placeholder surname still counts.
        const realName = getProfileCompletionSummary(
            buildUser({ firstName: 'Zack', lastName: 'User' }),
            DEFAULT_PROFILE_COMPLETION_FLAGS,
        );
        expect(realName.steps.find((s) => s.key === 'name')?.isComplete).toBe(true);
    });

    it('completes the picture step only when a profile picture exists', () => {
        const withPicture = getProfileCompletionSummary(
            buildUser({ media: { profilePicture: { path: 'some/path.jpeg' } } }),
            DEFAULT_PROFILE_COMPLETION_FLAGS,
        );

        expect(withPicture.steps.find((s) => s.key === 'picture')?.isComplete).toBe(true);
    });

    it('counts a skipped contact sync as resolved but never as complete', () => {
        const summary = getProfileCompletionSummary(buildUser(), {
            ...DEFAULT_PROFILE_COMPLETION_FLAGS,
            hasSkippedContacts: true,
        });
        const contactsStep = summary.steps.find((s) => s.key === 'contacts');

        expect(contactsStep?.isSkipped).toBe(true);
        expect(contactsStep?.isComplete).toBe(false);
        expect(summary.resolvedCount).toBe(1);
        expect(summary.nextStep?.key).toBe('name');
    });

    it('prefers a real sync over a previous skip', () => {
        const summary = getProfileCompletionSummary(buildUser(), {
            ...DEFAULT_PROFILE_COMPLETION_FLAGS,
            hasSkippedContacts: true,
            hasSyncedContacts: true,
        });
        const contactsStep = summary.steps.find((s) => s.key === 'contacts');

        expect(contactsStep?.isComplete).toBe(true);
        expect(contactsStep?.isSkipped).toBe(false);
    });

    it('is complete — and has no next step — once every step is resolved', () => {
        const summary = getProfileCompletionSummary(
            buildUser({
                firstName: 'Zack',
                lastName: 'Anselm',
                phoneNumber: '+15555555555',
                media: { profilePicture: { path: 'some/path.jpeg' } },
            }),
            allFlags,
        );

        expect(summary.isComplete).toBe(true);
        expect(summary.remainingCount).toBe(0);
        expect(summary.percentComplete).toBe(1);
        expect(summary.nextStep).toBeUndefined();
    });
});

describe('persisted completion flags', () => {
    it('defaults to nothing done when no flags are stored', async () => {
        await expect(getProfileCompletionFlags('user-123')).resolves.toEqual(DEFAULT_PROFILE_COMPLETION_FLAGS);
    });

    it('round-trips each flag through storage', async () => {
        await markContactsSynced('user-123');
        await markInterestsSelected('user-123');

        await expect(getProfileCompletionFlags('user-123')).resolves.toEqual({
            hasSelectedInterests: true,
            hasSyncedContacts: true,
            hasSkippedContacts: false,
        });
    });

    it('clears a prior skip when contacts are actually synced', async () => {
        await markContactsSkipped('user-123');
        await markContactsSynced('user-123');

        const flags = await getProfileCompletionFlags('user-123');
        expect(flags.hasSyncedContacts).toBe(true);
        expect(flags.hasSkippedContacts).toBe(false);
    });

    it('scopes flags per user so a second account starts fresh', async () => {
        await markContactsSynced('user-123');

        await expect(getProfileCompletionFlags('user-456')).resolves.toEqual(DEFAULT_PROFILE_COMPLETION_FLAGS);
    });

    it('degrades to "nothing done" rather than throwing on corrupt storage', async () => {
        await AsyncStorage.setItem('profileCompletionFlags:user-123', 'not-json');

        await expect(getProfileCompletionFlags('user-123')).resolves.toEqual(DEFAULT_PROFILE_COMPLETION_FLAGS);
    });
});

describe('syncInterestsFlag', () => {
    it('seeds the flag for accounts that picked interests before it existed', async () => {
        mockGetUserInterests.mockResolvedValue({ data: [{ interestId: 'a', isEnabled: true }] });

        const flags = await syncInterestsFlag('user-123');

        expect(flags.hasSelectedInterests).toBe(true);
        await expect(getProfileCompletionFlags('user-123'))
            .resolves.toEqual(expect.objectContaining({ hasSelectedInterests: true }));
    });

    it('leaves the step open when the account has no enabled interests', async () => {
        mockGetUserInterests.mockResolvedValue({ data: [] });

        await expect(syncInterestsFlag('user-123')).resolves.toEqual(DEFAULT_PROFILE_COMPLETION_FLAGS);
    });

    it('does not re-request once the flag is already set', async () => {
        await markInterestsSelected('user-123');

        const flags = await syncInterestsFlag('user-123');

        expect(flags.hasSelectedInterests).toBe(true);
        expect(mockGetUserInterests).not.toHaveBeenCalled();
    });

    it('degrades to the stored flags when the request fails', async () => {
        mockGetUserInterests.mockRejectedValue(new Error('offline'));

        await expect(syncInterestsFlag('user-123')).resolves.toEqual(DEFAULT_PROFILE_COMPLETION_FLAGS);
    });
});
