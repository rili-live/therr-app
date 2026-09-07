import 'react-native';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { AccessLevels } from 'therr-js-utilities/constants';
import { UsersService } from 'therr-react/services';
import { AccessPresets } from '../../main/routes/access';

/**
 * Guards the landing screen against an innocent-looking route reorder.
 *
 * `Layout.tsx` renders the routes array in order through `.filter(...).map(...)`, and the
 * `initialRouteName` it passes to `Stack.Navigator` is `undefined` for every brand except
 * HABITS (see `utilities/brandLandingRoute.ts` and `navigation/BrandInitialRoute.test.ts`).
 * With no initial route named, React Navigation makes the FIRST route the user is
 * authorized for the landing screen. That coupling is invisible at the call site — nothing
 * in `routes/index.tsx` looks order-sensitive, and a reorder produces no type error and no
 * runtime warning. It only shows up as users landing on the wrong screen.
 *
 * The risk became real when `CreateProfile` moved from
 * `EMAIL_VERIFIED_MISSING_PROPERTIES` to `ANY_AUTHENTICATED`: fully verified users now
 * match it too, and `Map` keeps the landing slot solely because it appears earlier in the
 * array. Move `CreateProfile` up and every verified user lands in the onboarding flow.
 *
 * The route order is read from the source file rather than from a copy kept in this test.
 * Importing `routes/index.tsx` directly is not viable — it pulls in every screen component
 * and their native modules — and a hand-maintained mirror of the order would defeat the
 * whole point, since it would not change when someone reorders the real file.
 */

const ROUTES_SOURCE_PATH = path.join(__dirname, '../../main/routes/index.tsx');

interface IParsedRoute {
    name: string;
    accessPresetName?: string;
}

/**
 * Extracts `{ name, access }` pairs from routes/index.tsx in declaration order.
 *
 * Anchored on `name:` so each match starts at a route entry, then looks ahead for that
 * entry's `access: AccessPresets.X`. The lookahead is bounded by the next `name:` so a
 * route with no `access` cannot borrow the following route's preset.
 */
const parseRoutesInOrder = (): IParsedRoute[] => {
    const source = fs.readFileSync(ROUTES_SOURCE_PATH, 'utf8');
    const nameMatches = [...source.matchAll(/\n\s{8}name: '([A-Za-z0-9_]+)',/g)];

    return nameMatches.map((match, index) => {
        const start = match.index ?? 0;
        const end = index + 1 < nameMatches.length ? nameMatches[index + 1].index ?? source.length : source.length;
        const block = source.slice(start, end);
        const accessMatch = block.match(/access: AccessPresets\.([A-Z_]+)/);

        return {
            name: match[1],
            accessPresetName: accessMatch ? accessMatch[1] : undefined,
        };
    });
};

const buildUser = (accessLevels: string[]) => ({
    details: {
        id: 'user-123',
        accessLevels,
    },
} as any);

// Mirrors the two states that reach the authenticated route set. `DEFAULT` alone never
// gets past email verification, so it is not a candidate for the landing slot.
const fullyVerifiedUser = buildUser([AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED]);
const missingPropertiesUser = buildUser([AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES]);

/**
 * Reproduces the route-visibility filter in Layout.tsx: routes with no `access` are always
 * shown, `Landing` is force-hidden for a signed-in user, everything else defers to
 * UsersService.isAuthorized. Feature flags are ignored — they gate individual screens but
 * do not change the ordering property under test.
 */
const firstAuthorizedRoute = (routes: IParsedRoute[], user: any): string | undefined => routes.find((route) => {
    if (route.name === 'Landing' && user?.details?.id) {
        return false;
    }

    if (!route.accessPresetName) {
        return true;
    }

    const access = AccessPresets[route.accessPresetName];

    if (!access) {
        return false;
    }

    return UsersService.isAuthorized(access, user);
})?.name;

describe('Landing route order', () => {
    const routes = parseRoutesInOrder();

    it('parses the route table from source', () => {
        expect(routes.length).toBeGreaterThan(10);
        expect(routes.map((r) => r.name)).toContain('Map');
        expect(routes.map((r) => r.name)).toContain('CreateProfile');
    });

    it('every parsed access preset resolves to a real preset', () => {
        const unresolved = routes
            .filter((route) => route.accessPresetName && !AccessPresets[route.accessPresetName])
            .map((route) => `${route.name} -> AccessPresets.${route.accessPresetName}`);

        expect(unresolved).toEqual([]);
    });

    it('lands a fully verified user on Map, not CreateProfile', () => {
        expect(firstAuthorizedRoute(routes, fullyVerifiedUser)).toBe('Map');
    });

    it('lands a user with missing properties on CreateProfile', () => {
        // Onboarding users fail Landing/Login (public-only) and Map (PUBLIC_PARTIAL),
        // so CreateProfile is their first surviving route.
        expect(firstAuthorizedRoute(routes, missingPropertiesUser)).toBe('CreateProfile');
    });

    it('keeps CreateProfile after Map in the route table', () => {
        const mapIndex = routes.findIndex((route) => route.name === 'Map');
        const createProfileIndex = routes.findIndex((route) => route.name === 'CreateProfile');

        expect(mapIndex).toBeGreaterThanOrEqual(0);
        expect(createProfileIndex).toBeGreaterThanOrEqual(0);
        expect(createProfileIndex).toBeGreaterThan(mapIndex);
    });

    it('CreateProfile is reachable by fully verified users (checklist re-entry)', () => {
        const createProfile = routes.find((route) => route.name === 'CreateProfile');

        expect(createProfile?.accessPresetName).toBe('ANY_AUTHENTICATED');
        expect(UsersService.isAuthorized(AccessPresets.ANY_AUTHENTICATED, fullyVerifiedUser)).toBe(true);
        expect(UsersService.isAuthorized(AccessPresets.ANY_AUTHENTICATED, missingPropertiesUser)).toBe(true);
    });
});
