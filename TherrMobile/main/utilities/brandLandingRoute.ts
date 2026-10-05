import AsyncStorage from '@react-native-async-storage/async-storage';
import { BrandVariations, FeatureFlags } from 'therr-js-utilities/constants';
import { IUserState } from 'therr-react/types';
import { CURRENT_BRAND_VARIATION } from '../config/brandConfig';
import getConfig from './getConfig';
import { isUserEmailVerified } from './authUtils';

/**
 * Screen the navigator should mount on, rather than falling through to the
 * first route the user happens to be authorized for.
 *
 * `routes/index.tsx` declares no `initialRouteName`, so React Navigation makes
 * the landing screen whichever authorized route comes first in the array. For
 * an authenticated HABITS user that is `CreateProfile`: `Landing`/`Login` are
 * filtered out once signed in, and `Map` — the landing screen on Therr — is
 * feature-flagged off for HABITS. Every cold start therefore rendered the
 * profile form for a frame or two before `Layout.resetToHabitsLanding()`
 * swung the user over to the dashboard.
 *
 * Returning `undefined` keeps the legacy first-authorized-route behavior, which
 * is still correct for every brand that lands on `Map`.
 *
 * The conditions here deliberately mirror Layout's route filter: naming a route
 * that got filtered out of the navigator makes React Navigation warn and fall
 * back to the first screen, which is the very bug this prevents.
 */
export const getBrandInitialRouteName = (user?: IUserState): string | undefined => {
    if (CURRENT_BRAND_VARIATION !== BrandVariations.HABITS || !user?.isAuthenticated) {
        return undefined;
    }

    // Onboarding users (EMAIL_VERIFIED_MISSING_PROPERTIES) do not clear
    // HabitsDashboard's EMAIL_VERIFIED gate, so it is filtered out of the
    // navigator for them. Completing their profile is where the landing reset
    // sends them anyway.
    if (!isUserEmailVerified(user)) {
        return 'CreateProfile';
    }

    const featureFlags = getConfig().featureFlags || {};

    return featureFlags[FeatureFlags.ENABLE_HABITS] ? 'HabitsDashboard' : undefined;
};

// Mirrors `HABITS_PUSH_OPTIN_SHOWN` in routes/Pacts/HabitsPushOptIn.tsx. Redeclared rather
// than imported so this utility does not pull a screen component into every caller.
const HABITS_PUSH_OPTIN_SHOWN_KEY = 'HABITS_PUSH_OPTIN_SHOWN';

/**
 * Where a HABITS user with a complete profile lands: the one-time push opt-in on their
 * first authenticated landing, the dashboard ever after.
 *
 * Shared by Layout's auth-transition reset and the end of CreateProfile. The latter used
 * to `navigate('Map')` — a route HABITS filters out of the navigator — so finishing
 * onboarding left the user stranded on the last profile stage.
 */
export const getHabitsLandingRouteName = async (): Promise<'HabitsPushOptIn' | 'HabitsDashboard'> => {
    let optInShown = 'true';
    try {
        optInShown = (await AsyncStorage.getItem(HABITS_PUSH_OPTIN_SHOWN_KEY)) || '';
    } catch {
        // best-effort — fall through to dashboard if AsyncStorage is broken
        optInShown = 'true';
    }

    return optInShown ? 'HabitsDashboard' : 'HabitsPushOptIn';
};

export interface IHeaderLogoTarget {
    name: string;
    params?: Record<string, any>;
}

/**
 * Where the top-left logo goes — the app's "home" button.
 *
 * On HABITS this used to fall through to `Home`, which on that brand is the
 * share-feedback form: a user stuck in onboarding who tapped the logo to start
 * over was dropped onto a screen asking them for feedback. Home on HABITS is the
 * habits dashboard. `PactOnboardingGuard` already decides what that shows — the
 * first-pact walkthrough until the user has started, their habits after — so the
 * logo needs no knowledge of either.
 *
 * `initialTab: 'habits'` is explicit rather than omitted. React Navigation keeps
 * a screen's previous params when it is navigated to without new ones, so a user
 * who reached the dashboard through "View sent invites" (`initialTab: 'outgoing'`,
 * which bypasses the guard) would otherwise stay on that bypassed view and never
 * see the walkthrough again.
 */
export const getHeaderLogoTarget = ({
    isAuthenticated,
    isEmailVerified,
}: {
    isAuthenticated: boolean;
    isEmailVerified: boolean;
}): IHeaderLogoTarget => {
    const featureFlags = getConfig()?.featureFlags || {};
    const isHabits = CURRENT_BRAND_VARIATION === BrandVariations.HABITS;

    if (isAuthenticated && !isEmailVerified) {
        return { name: 'CreateProfile' };
    }
    if (isHabits && !isAuthenticated) {
        return { name: 'Landing' };
    }
    if (isHabits && featureFlags[FeatureFlags.ENABLE_HABITS]) {
        return { name: 'HabitsDashboard', params: { initialTab: 'habits' } };
    }
    if (featureFlags.ENABLE_MAP === true) {
        return { name: 'Map', params: isAuthenticated ? { shouldShowPreview: false } : undefined };
    }

    return { name: 'Home' };
};

export default getBrandInitialRouteName;
