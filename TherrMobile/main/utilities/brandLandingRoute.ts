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

export default getBrandInitialRouteName;
