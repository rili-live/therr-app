import fs from 'fs';
import path from 'path';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';

/**
 * Guards the coupling between the push-notification routing in `Layout.tsx` and the
 * segment names the habits dashboard actually recognises.
 *
 * `Layout.tsx` resolves a habits notification to `{ targetRouteView: 'HabitsDashboard',
 * targetRouteParams: { initialTab } }`. `Dashboard.tsx` then runs that value through
 * `normalizeInitialTab`, which falls back to `'habits'` for anything it does not know.
 *
 * That fallback is what makes a typo here invisible: the notification still opens the
 * dashboard, and the dashboard still renders a populated screen, so nothing looks
 * broken — the user simply lands on a different segment than the copy promised. It has
 * already happened once: the check-in nudges routed to `initialTab: 'today'`, a segment
 * that has never existed, and every one of them silently resolved to `'habits'`.
 *
 * The source is scanned rather than the component rendered because `Layout` is a large
 * connected class component whose routing lives in two separate resolvers (the Android
 * intent path and the notification-type path). Reading the literals directly covers both
 * without standing up the React tree, and cannot drift from what ships.
 */

const LAYOUT_PATH = path.resolve(__dirname, '../../main/components/Layout.tsx');
const layoutSource = fs.readFileSync(LAYOUT_PATH, 'utf8');

// Mirrors `HabitsTab` in main/routes/Habits/Dashboard.tsx. Duplicated deliberately —
// importing Dashboard.tsx would pull in the whole habits screen and its native
// dependencies for what is a check on two string lists, and a literal list makes an
// accidental deletion from `HabitsTab` visible rather than silently shrinking the
// expectation set.
const VALID_TABS = ['habits', 'pending', 'outgoing', 'all'];

// `normalizeInitialTab` also accepts this legacy alias from in-flight notifications
// sent before the pacts list was folded into the dashboard.
const ACCEPTED_LEGACY_TABS = ['active'];

const ACCEPTED = [...VALID_TABS, ...ACCEPTED_LEGACY_TABS];

/** Every `initialTab: '<literal>'` the routing assigns. */
const collectInitialTabLiterals = (): string[] => {
    const matches = layoutSource.matchAll(/initialTab:\s*'([^']*)'/g);
    return [...matches].map((m) => m[1]);
};

/** Every `buildHabitRoute('<literal>')` call, which forwards its argument as initialTab. */
const collectBuildHabitRouteArgs = (): string[] => {
    const matches = layoutSource.matchAll(/buildHabitRoute\('([^']*)'\)/g);
    return [...matches].map((m) => m[1]);
};

describe('habits notification tab routing', () => {
    it('only ever sends the dashboard a segment it recognises', () => {
        const literals = collectInitialTabLiterals();

        // Guards the guard: if the assignment shape changes, this suite must not
        // quietly start asserting nothing.
        expect(literals.length).toBeGreaterThan(0);

        literals.forEach((tab) => {
            expect(ACCEPTED).toContain(tab);
        });
    });

    it('forwards only recognised segments through buildHabitRoute', () => {
        const args = collectBuildHabitRouteArgs();

        expect(args.length).toBeGreaterThan(0);

        args.forEach((tab) => {
            expect(ACCEPTED).toContain(tab);
        });
    });

    it('never routes a habits notification to the in-app Notifications list', () => {
        // The Notifications screen declares no habits row types, so a habits
        // notification resolving there renders an empty list — the dead end this
        // routing was written to remove.
        const habitsResolver = layoutSource.slice(
            layoutSource.indexOf('getRouteFromNotificationType'),
        );
        const habitsCaseBlock = habitsResolver.slice(
            habitsResolver.indexOf('PushNotifications.Types.pactNudge'),
            habitsResolver.indexOf('default:'),
        );

        expect(habitsCaseBlock.length).toBeGreaterThan(0);
        expect(habitsCaseBlock).not.toContain("targetRouteView: 'Notifications'");
    });
});
