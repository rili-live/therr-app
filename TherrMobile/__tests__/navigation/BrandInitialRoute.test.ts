import 'react-native';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { AccessLevels } from 'therr-js-utilities/constants';
import { getBrandInitialRouteName } from '../../main/utilities/brandLandingRoute';

/**
 * Guards the HABITS cold-start landing screen against a visible route flash.
 *
 * `routes/index.tsx` sets no `initialRouteName`, so React Navigation lands the
 * user on the first route they are authorized for. On HABITS that resolves to
 * `CreateProfile` — `Landing`/`Login` drop out once signed in and `Map` is
 * feature-flagged off — so a persisted session rendered the profile form until
 * `Layout.resetToHabitsLanding()` (which awaits AsyncStorage, so never in the
 * same frame) reset the stack to the dashboard. Users saw the wrong screen
 * flash on every launch.
 *
 * `Layout` now passes `getBrandInitialRouteName(user)` to `Stack.Navigator`.
 * Both halves are asserted here: the resolver's answers, and the fact that
 * Layout still hands the result to the navigator — dropping that prop would
 * silently restore the flash with no type error and no test failure anywhere
 * else.
 *
 * The brand and its feature flag are mocked rather than read from the ambient
 * `brandConfig.ts`. The resolver's whole contract is "what does HABITS land on",
 * so reading the branch's own brand made the suite pass only on
 * `niche/HABITS-general` and fail on `general`, where brandConfig selects THERR.
 */

jest.mock('../../main/config/brandConfig', () => {
    const { BrandVariations } = jest.requireActual('therr-js-utilities/constants');

    return {
        __esModule: true,
        CURRENT_BRAND_VARIATION: BrandVariations.HABITS,
        default: { brandVariation: BrandVariations.HABITS },
    };
});

jest.mock('../../main/utilities/getConfig', () => ({
    __esModule: true,
    default: () => ({ featureFlags: { ENABLE_HABITS: true } }),
}));

const LAYOUT_SOURCE_PATH = path.join(__dirname, '../../main/components/Layout.tsx');

const buildUser = (accessLevels: string[], isAuthenticated = true) => ({
    isAuthenticated,
    details: {
        id: 'user-123',
        accessLevels,
    },
} as any);

const fullyVerifiedUser = buildUser([AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED]);
const missingPropertiesUser = buildUser([AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES]);

describe('HABITS initial route', () => {
    it('mounts a verified user straight on the habits dashboard', () => {
        expect(getBrandInitialRouteName(fullyVerifiedUser)).toBe('HabitsDashboard');
    });

    it('mounts an onboarding user on CreateProfile, which their access level allows', () => {
        // HabitsDashboard requires EMAIL_VERIFIED and is filtered out of the
        // navigator for this user, so naming it would warn and fall back.
        expect(getBrandInitialRouteName(missingPropertiesUser)).toBe('CreateProfile');
    });

    it('defers to the route table for a signed-out user', () => {
        expect(getBrandInitialRouteName(buildUser([AccessLevels.DEFAULT], false))).toBeUndefined();
        expect(getBrandInitialRouteName(undefined)).toBeUndefined();
    });

    it('Layout passes the resolved route to Stack.Navigator', () => {
        const source = fs.readFileSync(LAYOUT_SOURCE_PATH, 'utf8');

        expect(source).toMatch(/initialRouteName=\{getBrandInitialRouteName\(user\)\}/);
    });

    it('Layout skips the landing reset when the stack is already on that route', () => {
        // The reset is what remounts the screen; leaving it unconditional would
        // re-run the dashboard's fetches on every launch for no visible gain.
        const source = fs.readFileSync(LAYOUT_SOURCE_PATH, 'utf8');

        expect(source).toMatch(/resetToRouteIfNeeded/);
        expect(source).not.toMatch(/routes: \[\{ name: 'CreateProfile' \}\]/);
    });
});
