import { FeatureFlags } from 'therr-js-utilities/constants';

/**
 * How many tabs the HABITS menu shows, and how wide each one is.
 *
 * Deliberately free of React Native imports so it can be unit-tested directly,
 * the same trick `routes/Habits/pactState.ts` and
 * `routes/Journal/journalGrouping.ts` use — `screenWidth` is passed in rather
 * than read from `Dimensions`.
 *
 * WHY THE COUNT IS DERIVED RATHER THAN CONSTANT
 *
 * `routes/index.tsx` registers the `Journal` screen only when
 * ENABLE_HABITS_JOURNAL is on. A tab rendered unconditionally would therefore
 * survive the flag being switched off and call `navigate('Journal')` against a
 * navigator with no such screen — which does nothing at all, no error, no
 * screen change. A kill-switch that leaves a dead button behind has not killed
 * anything, so the tab and the route read the same flag.
 *
 * 5 is also the ceiling `validateFeatureFlags` enforces, and that check is not
 * cosmetic: every tab is `screenWidth / tabCount` wide, so a sixth would push
 * the labels past their glyphs on a small device.
 */
export const HABITS_TAB_COUNT_MAX = 5;

export interface IHabitsTabLayout {
    isJournalEnabled: boolean;
    tabCount: number;
    buttonWidth: number;
}

export const getHabitsTabLayout = (
    screenWidth: number,
    featureFlags: Record<string, boolean> = {},
): IHabitsTabLayout => {
    // `=== true` rather than truthiness, matching how `Layout.tsx` filters
    // routes on `requiredFeatures`. A flag that is merely present must not
    // count as enabled, or the tab and the route could disagree.
    const isJournalEnabled = featureFlags[FeatureFlags.ENABLE_HABITS_JOURNAL] === true;
    const tabCount = isJournalEnabled ? HABITS_TAB_COUNT_MAX : HABITS_TAB_COUNT_MAX - 1;

    return {
        isJournalEnabled,
        tabCount,
        buttonWidth: screenWidth / tabCount,
    };
};
