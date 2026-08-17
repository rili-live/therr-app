import { it, describe, expect } from '@jest/globals';
import { FeatureFlags } from 'therr-js-utilities/constants';
import { getHabitsTabLayout, HABITS_TAB_COUNT_MAX } from '../../main/components/ButtonMenu/habitsTabLayout';

/**
 * The HABITS tab bar's dependence on ENABLE_HABITS_JOURNAL.
 *
 * `routes/index.tsx` registers the `Journal` screen only when that flag is on.
 * The tab used to render unconditionally, so switching the flag off left a
 * visible button calling `navigate('Journal')` against a navigator with no such
 * screen — which does nothing at all: no error, no screen change, no clue. A
 * kill-switch that leaves a dead button behind has not killed anything.
 *
 * The width arithmetic is pinned alongside it because the two have to move
 * together — a hidden tab whose slot is still reserved leaves a visible gap.
 */
const SCREEN_WIDTH = 400;

describe('getHabitsTabLayout', () => {
    it('shows the journal tab and divides the bar five ways when the flag is on', () => {
        const layout = getHabitsTabLayout(SCREEN_WIDTH, {
            [FeatureFlags.ENABLE_HABITS_JOURNAL]: true,
        });

        expect(layout.isJournalEnabled).toBe(true);
        expect(layout.tabCount).toBe(HABITS_TAB_COUNT_MAX);
        expect(layout.buttonWidth).toBe(80);
    });

    it('hides the journal tab and reclaims its width when the flag is off', () => {
        // The reclaim is the half that is easy to forget: hiding the button
        // while still dividing by five leaves a blank fifth of the tab bar.
        const layout = getHabitsTabLayout(SCREEN_WIDTH, {
            [FeatureFlags.ENABLE_HABITS_JOURNAL]: false,
        });

        expect(layout.isJournalEnabled).toBe(false);
        expect(layout.tabCount).toBe(4);
        expect(layout.buttonWidth).toBe(100);
    });

    it('treats a missing flag as off', () => {
        expect(getHabitsTabLayout(SCREEN_WIDTH, {}).isJournalEnabled).toBe(false);
    });

    it('treats an absent flag map as off rather than throwing', () => {
        expect(getHabitsTabLayout(SCREEN_WIDTH).isJournalEnabled).toBe(false);
    });

    it('requires exactly true, matching how Layout filters routes on requiredFeatures', () => {
        // `Layout.tsx` tests `featureFlags[flag] === true`. Anything looser here
        // would let the tab appear for a route that was never registered.
        const truthyButNotTrue = getHabitsTabLayout(SCREEN_WIDTH, {
            [FeatureFlags.ENABLE_HABITS_JOURNAL]: 1 as any,
        });

        expect(truthyButNotTrue.isJournalEnabled).toBe(false);
    });

    it('never exceeds the tab ceiling validateFeatureFlags enforces', () => {
        [true, false].forEach((enabled) => {
            const layout = getHabitsTabLayout(SCREEN_WIDTH, {
                [FeatureFlags.ENABLE_HABITS_JOURNAL]: enabled,
            });

            expect(layout.tabCount).toBeLessThanOrEqual(HABITS_TAB_COUNT_MAX);
            expect(layout.tabCount).toBeGreaterThanOrEqual(3);
        });
    });
});
