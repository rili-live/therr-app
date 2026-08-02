import { useCallback, useEffect, useRef, useState } from 'react';
import { IUserState } from 'therr-react/types';
import {
    DEFAULT_PROFILE_COMPLETION_FLAGS,
    IProfileCompletionFlags,
    IProfileCompletionSummary,
    getProfileCompletionFlags,
    getProfileCompletionSummary,
    syncInterestsFlag,
} from '../utilities/profileCompletion';

export interface IUseProfileCompletionResult {
    /** Null until the persisted flags have been read at least once. */
    flags: IProfileCompletionFlags | null;
    /**
     * False until the persisted flags land. Callers should render nothing until
     * this flips, otherwise the UI flashes steps the user already finished.
     */
    isReady: boolean;
    summary: IProfileCompletionSummary;
}

/**
 * Reads the profile-completion step model for a user and keeps it fresh.
 *
 * Shared by the profile banner and the ProfileCompletion screen so the two can
 * never disagree about what is left to do. Pass `navigation` to re-read the
 * flags on focus — steps are completed on other screens (the guided
 * CreateProfile flow, contact sync), so the initial render is not trustworthy
 * once the user has navigated away and back.
 */
const useProfileCompletion = (user: IUserState, navigation?: any): IUseProfileCompletionResult => {
    const [flags, setFlags] = useState<IProfileCompletionFlags | null>(null);
    const isUnmountedRef = useRef(false);
    const userId = user?.details?.id;

    useEffect(() => () => {
        isUnmountedRef.current = true;
    }, []);

    const safeSetFlags = useCallback((nextFlags: IProfileCompletionFlags) => {
        if (!isUnmountedRef.current) {
            setFlags(nextFlags);
        }
    }, []);

    const refreshFlags = useCallback(() => {
        getProfileCompletionFlags(userId)
            .then(safeSetFlags)
            .catch(() => safeSetFlags(DEFAULT_PROFILE_COMPLETION_FLAGS));
    }, [safeSetFlags, userId]);

    useEffect(() => {
        // Seed the interests flag for accounts that picked interests before the
        // checklist existed, then read the merged result.
        syncInterestsFlag(userId)
            .then(safeSetFlags)
            .catch(() => safeSetFlags(DEFAULT_PROFILE_COMPLETION_FLAGS));
    }, [safeSetFlags, userId]);

    useEffect(() => {
        const unsubscribe = navigation?.addListener?.('focus', refreshFlags);

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [navigation, refreshFlags]);

    return {
        flags,
        isReady: !!flags,
        summary: getProfileCompletionSummary(user, flags || DEFAULT_PROFILE_COMPLETION_FLAGS),
    };
};

export default useProfileCompletion;
