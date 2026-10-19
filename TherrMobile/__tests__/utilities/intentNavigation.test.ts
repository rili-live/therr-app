// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { getIntentNavigation } from '../../main/utilities/intentNavigation';

/**
 * Intent Navigation Tests
 *
 * Regression: `Layout.handleFirebasePushNotificationEvent` sent every signed-out user to Login,
 * target or not. The cold-start launch intent (`android.intent.action.MAIN`) always reaches that
 * handler and routes nowhere, so every signed-out Android launch skipped the Landing slides and
 * opened on Login — 17 of 22 paid Friends with Habits installs, with zero sign-in taps.
 */
describe('getIntentNavigation', () => {
    it('leaves a signed-out user on Landing when the intent routes nowhere (the launcher MAIN intent)', () => {
        expect(getIntentNavigation(true, '')).toBeNull();
        expect(getIntentNavigation(true, undefined)).toBeNull();
    });

    it('sends a signed-out user to Login when there is a screen to return to after signing in', () => {
        expect(getIntentNavigation(true, 'HabitsDashboard')).toBe('login');
    });

    it('routes a signed-in user straight to the target', () => {
        expect(getIntentNavigation(false, 'PactDetail')).toBe('target');
    });

    it('does nothing for a signed-in user with no target', () => {
        expect(getIntentNavigation(false, '')).toBeNull();
    });
});

describe('Layout wiring', () => {
    // The helper only matters if the handler obeys it; an unconditional `if (isNotAuthorized)` coming
    // back in a merge would reintroduce the bug with this file's tests still green.
    const layout = fs.readFileSync(path.join(__dirname, '../../main/components/Layout.tsx'), 'utf8');

    it('decides the Login redirect through getIntentNavigation', () => {
        expect(layout).toContain('getIntentNavigation(isNotAuthorized, targetRouteView)');
        expect(layout).not.toMatch(/if \(isNotAuthorized\) \{\s*this\.setState\(\{\s*targetRouteView/);
    });
});
