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
 * `routes/index.tsx` registers the `Journal` and `HabitsFeed` screens only
 * when their flag is on. A tab rendered unconditionally would therefore survive
 * the flag being switched off and call `navigate('Journal')` against a
 * navigator with no such screen — which does nothing at all, no error, no
 * screen change. A kill-switch that leaves a dead button behind has not killed
 * anything, so each tab and its route read the same flag.
 *
 * WHY FEED, NOT AWARDS
 *
 * The public feed (`ENABLE_HABITS_FEED`) takes the optional-tab slot the Awards
 * (Achievements) tab used to hold. Achievements is still reachable from the
 * drawer, so it keeps its route and its `ENABLE_ACHIEVEMENTS` gate — it is only
 * off the bottom bar. That is why this layout counts the feed flag here and no
 * longer the achievements flag: the bar shows at most one of these optional
 * social tabs, and the product chose the feed for it.
 *
 * 5 is also the ceiling `validateFeatureFlags` enforces, and that check is not
 * cosmetic: every tab is `screenWidth / tabCount` wide, so a sixth would push
 * the labels past their glyphs on a small device. The fixed three are Habits,
 * Connect and Profile.
 */
export const HABITS_TAB_COUNT_MAX = 5;

const HABITS_TAB_COUNT_MIN = 3;

export interface IHabitsTabLayout {
    isJournalEnabled: boolean;
    isFeedEnabled: boolean;
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
    const isFeedEnabled = featureFlags[FeatureFlags.ENABLE_HABITS_FEED] === true;
    const tabCount = HABITS_TAB_COUNT_MIN
        + (isJournalEnabled ? 1 : 0)
        + (isFeedEnabled ? 1 : 0);

    return {
        isJournalEnabled,
        isFeedEnabled,
        tabCount,
        buttonWidth: screenWidth / tabCount,
    };
};
