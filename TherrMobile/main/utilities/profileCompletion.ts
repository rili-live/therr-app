import AsyncStorage from '@react-native-async-storage/async-storage';
import { IUserState } from 'therr-react/types';
import { UsersService } from 'therr-react/services';
import { DEFAULT_FIRSTNAME, DEFAULT_LASTNAME } from '../constants';

/**
 * Profile completion model shared by the ProfileCompletion screen, the profile
 * link that points at it, the incomplete-profile banner, and the guided
 * CreateProfile flow. Keeping the step list in one place means the screen, the
 * banners, and the onboarding stages can never disagree about what is left to do.
 */

export type IProfileStepKey = 'name' | 'interests' | 'picture' | 'phone' | 'contacts';

/** Stages of the guided CreateProfile flow that a step can resume at. */
export type IProfileStage = 'details' | 'interests' | 'picture' | 'phone' | 'contacts' | 'invite';

/**
 * Completion signals that are not derivable from `user.details`. Persisted per
 * user to AsyncStorage so the checklist survives relaunches without adding a
 * round trip on every render.
 */
export interface IProfileCompletionFlags {
    hasSelectedInterests: boolean;
    hasSyncedContacts: boolean;
    hasSkippedContacts: boolean;
}

export interface IProfileCompletionStep {
    key: IProfileStepKey;
    /** Stage the guided flow jumps to when this step is tapped. */
    stage: IProfileStage;
    /** FontAwesome5 icon name. */
    icon: string;
    labelKey: string;
    descriptionKey: string;
    isComplete: boolean;
    /**
     * Explicitly passed on (only possible for optional steps like contact
     * sync). Counts as resolved for progress, but renders differently so the
     * checklist never claims the user did something they declined.
     */
    isSkipped: boolean;
}

export interface IProfileCompletionSummary {
    steps: IProfileCompletionStep[];
    /** Steps that are complete OR intentionally skipped. */
    resolvedCount: number;
    totalCount: number;
    remainingCount: number;
    /** 0 - 1, used to fill the progress bar. */
    percentComplete: number;
    isComplete: boolean;
    /** First unresolved step, i.e. where "Continue" should take the user. */
    nextStep?: IProfileCompletionStep;
}

export const DEFAULT_PROFILE_COMPLETION_FLAGS: IProfileCompletionFlags = {
    hasSelectedInterests: false,
    hasSyncedContacts: false,
    hasSkippedContacts: false,
};

const STORAGE_KEY_PREFIX = 'profileCompletionFlags';

const getStorageKey = (userId?: string) => `${STORAGE_KEY_PREFIX}:${userId || 'anonymous'}`;

export const getProfileCompletionFlags = (userId?: string): Promise<IProfileCompletionFlags> =>
    AsyncStorage.getItem(getStorageKey(userId))
        .then((value) => {
            if (!value) {
                return { ...DEFAULT_PROFILE_COMPLETION_FLAGS };
            }

            return {
                ...DEFAULT_PROFILE_COMPLETION_FLAGS,
                ...JSON.parse(value),
            };
        })
        // Storage is a cache, never a source of truth: a read failure should
        // degrade to "nothing done yet" rather than break the screen.
        .catch(() => ({ ...DEFAULT_PROFILE_COMPLETION_FLAGS }));

export const setProfileCompletionFlags = (
    userId: string | undefined,
    updates: Partial<IProfileCompletionFlags>,
): Promise<IProfileCompletionFlags> => getProfileCompletionFlags(userId).then((flags) => {
    const merged = { ...flags, ...updates };

    return AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(merged))
        .then(() => merged)
        .catch(() => merged);
});

export const markContactsSynced = (userId?: string) => setProfileCompletionFlags(userId, {
    hasSyncedContacts: true,
    hasSkippedContacts: false,
});

export const markContactsSkipped = (userId?: string) => setProfileCompletionFlags(userId, {
    hasSkippedContacts: true,
});

export const markInterestsSelected = (userId?: string) => setProfileCompletionFlags(userId, {
    hasSelectedInterests: true,
});

/**
 * Interests are not mirrored into Redux, and accounts created before this
 * checklist existed have no local flag. Seed the flag from the API once so
 * long-standing users are not asked to redo a step they already finished.
 */
export const syncInterestsFlag = (userId?: string): Promise<IProfileCompletionFlags> =>
    getProfileCompletionFlags(userId).then((flags) => {
        if (flags.hasSelectedInterests) {
            return flags;
        }

        return UsersService.getUserInterests()
            .then((response: any) => {
                const hasInterests = Array.isArray(response?.data)
                    ? response.data.some((interest: any) => interest?.isEnabled !== false)
                    : false;

                if (!hasInterests) {
                    return flags;
                }

                return setProfileCompletionFlags(userId, { hasSelectedInterests: true });
            })
            .catch(() => flags);
    });

/**
 * iOS onboarding seeds the name inputs with a placeholder so the account can be
 * created without one. Treat that exact placeholder pair as "no name given"
 * rather than as a completed step.
 */
const hasRealName = (details: any) => {
    const firstName = details?.firstName;

    if (!firstName) {
        return false;
    }

    return !(firstName === DEFAULT_FIRSTNAME && details?.lastName === DEFAULT_LASTNAME);
};

export const getProfileCompletionSummary = (
    user: IUserState,
    flags: IProfileCompletionFlags = DEFAULT_PROFILE_COMPLETION_FLAGS,
): IProfileCompletionSummary => {
    const details = user?.details;

    const steps: IProfileCompletionStep[] = [
        {
            key: 'name',
            stage: 'details',
            icon: 'user-edit',
            labelKey: 'pages.profileCompletion.steps.name.label',
            descriptionKey: 'pages.profileCompletion.steps.name.description',
            isComplete: hasRealName(details),
            isSkipped: false,
        },
        {
            key: 'interests',
            stage: 'interests',
            icon: 'heart',
            labelKey: 'pages.profileCompletion.steps.interests.label',
            descriptionKey: 'pages.profileCompletion.steps.interests.description',
            isComplete: !!flags.hasSelectedInterests,
            isSkipped: false,
        },
        {
            key: 'picture',
            stage: 'picture',
            icon: 'camera',
            labelKey: 'pages.profileCompletion.steps.picture.label',
            descriptionKey: 'pages.profileCompletion.steps.picture.description',
            isComplete: !!details?.media?.profilePicture,
            isSkipped: false,
        },
        {
            key: 'phone',
            stage: 'phone',
            icon: 'shield-alt',
            labelKey: 'pages.profileCompletion.steps.phone.label',
            descriptionKey: 'pages.profileCompletion.steps.phone.description',
            isComplete: !!details?.phoneNumber,
            isSkipped: false,
        },
        {
            key: 'contacts',
            stage: 'contacts',
            icon: 'address-book',
            labelKey: 'pages.profileCompletion.steps.contacts.label',
            descriptionKey: 'pages.profileCompletion.steps.contacts.description',
            isComplete: !!flags.hasSyncedContacts,
            isSkipped: !flags.hasSyncedContacts && !!flags.hasSkippedContacts,
        },
    ];

    const totalCount = steps.length;
    const resolvedCount = steps.filter((step) => step.isComplete || step.isSkipped).length;
    const nextStep = steps.find((step) => !step.isComplete && !step.isSkipped);

    return {
        steps,
        resolvedCount,
        totalCount,
        remainingCount: totalCount - resolvedCount,
        percentComplete: totalCount ? resolvedCount / totalCount : 1,
        isComplete: resolvedCount === totalCount,
        nextStep,
    };
};
