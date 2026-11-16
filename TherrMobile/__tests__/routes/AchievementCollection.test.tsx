import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { BrandVariations } from 'therr-js-utilities/constants';

/**
 * The Achievements screen's body, the badge detail view and the profile's badge shelf,
 * rendered the way their screens render them. What has to hold is what a user would
 * notice: rewards and near-finished achievements come first, every ladder is in the
 * grid with its locked badges folded away until asked for, a reward can be claimed
 * from the detail view, and nobody is offered a claim on someone else's badge.
 */
jest.mock('lottie-react-native', () => 'LottieView');
// A 360dp phone, the narrowest the app is designed for: three badges to a row.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
    __esModule: true,
    default: () => ({ width: 360, height: 780, scale: 2, fontScale: 1 }),
}));

import AchievementCollection, { UP_NEXT_LIMIT } from '../../main/routes/Achievements/AchievementCollection';
import AchievementDetail from '../../main/routes/Achievements/AchievementDetail';
import AchievementShowcaseItem, { buildShowcaseItems } from '../../main/routes/Achievements/AchievementShowcase';
import AchievementTile from '../../main/routes/Achievements/AchievementTile';
import { getBadgeGridCardWidth, getBadgeGridColumns } from '../../main/routes/Achievements/AchievementBadgeCell';
import { buildStyles as buildAchievementStyles } from '../../main/styles/achievements';
import { getBadgeTrack, toAchievementBadge } from '../../main/utilities/achievementCollection';
import translator from '../../main/utilities/translator';

const themeAchievements = buildAchievementStyles('light');
const translate = (key: string, params?: any) => translator('en-us', key, params);
const daysAgo = (days: number) => new Date(Date.UTC(2026, 10, 15) - days * 86400000).toISOString();

let nextId = 0;
const row = (achievementClass: string, achievementId: string, overrides: any = {}) => {
    nextId += 1;
    return {
        id: `ua-${nextId}`,
        achievementClass,
        achievementId,
        progressCount: 0,
        completedAt: null,
        unclaimedRewardPts: 0,
        ...overrides,
    };
};

const ROWS = [
    row('socialite', 'socialite_1_1_2', { completedAt: daysAgo(1), unclaimedRewardPts: '1.00', progressCount: 25 }),
    row('habitBuilder', 'habitBuilder_1_1', { completedAt: daysAgo(40), progressCount: 3 }),
    row('habitBuilder', 'habitBuilder_1_1_1', { completedAt: daysAgo(30), progressCount: 7 }),
    row('habitBuilder', 'habitBuilder_1_1_2', { completedAt: daysAgo(20), progressCount: 14 }),
    row('habitBuilder', 'habitBuilder_1_1_3', { progressCount: 24 }),
    row('socialite', 'socialite_1_1', { progressCount: 2 }),
    row('socialite', 'socialite_1_1_3', { progressCount: 1 }),
    row('accountability', 'accountability_1_1_2', { progressCount: 1 }),
    row('consistency', 'consistency_1_1', { progressCount: 3 }),
];

// The virtualized list schedules its render batches on timers that outlive a test.
beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
});

const render = (element: React.ReactElement) => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
        tree = renderer.create(element);
    });
    return tree!;
};

const textOf = (tree: renderer.ReactTestRenderer) => tree.root
    .findAll((node) => typeof node.type === 'string' && typeof node.props.children === 'string')
    .map((node) => node.props.children as string);
const hostByTestId = (tree: renderer.ReactTestRenderer, testID: string) => tree.root
    .findAll((node) => typeof node.type === 'string' && node.props.testID === testID);
const pressableByTestId = (tree: renderer.ReactTestRenderer, testID: string) => tree.root
    .findAll((node) => node.props.testID === testID && typeof node.props.onPress === 'function')[0];
const badgeCells = (tree: renderer.ReactTestRenderer) => tree.root.findAll(
    (node) => typeof node.type === 'string' && typeof node.props.testID === 'string'
        && node.props.testID.startsWith('achievement-badge-cell-') && node.props.testID !== 'achievement-badge-cell-gift',
);

const renderCollection = (props: any = {}) => {
    const onClaim = jest.fn();
    const onPressBadge = jest.fn();
    const tree = render(
        <AchievementCollection
            achievements={Object.fromEntries(ROWS.map((item) => [item.id, item]))}
            brandVariation={BrandVariations.HABITS}
            claimingIds={{}}
            onClaim={onClaim}
            onPressBadge={onPressBadge}
            // The list is virtualized; mount all of it so a test can look at any ladder.
            initialNumToRender={500}
            themeAchievements={themeAchievements}
            translate={translate}
            {...props}
        />,
    );
    return { tree, onClaim, onPressBadge };
};

describe('AchievementCollection', () => {
    it('leads with the reward to claim, then the achievements closest to done', () => {
        const { tree } = renderCollection();
        const tiles = tree.root.findAllByType(AchievementTile).map((tile) => tile.props.badge);

        expect(tiles[0].state).toBe('claimable');
        expect(tiles[0].config.title).toBe('Initiator');

        const upNext = tiles.slice(1);
        expect(upNext).toHaveLength(UP_NEXT_LIMIT);
        expect(upNext[0].config.title).toBe('Habit Formed'); // 24 of 30
        expect(upNext.every((badge: any) => badge.state === 'inProgress')).toBe(true);

        const text = textOf(tree);
        expect(text.indexOf('Ready to Claim')).toBeLessThan(text.indexOf('Up Next'));
        expect(text.indexOf('Up Next')).toBeLessThan(text.indexOf('Your Collection'));
    });

    it('hands the claimed badge back when the row\'s claim button is pressed', () => {
        const { tree, onClaim } = renderCollection();
        const tile = tree.root.findAllByType(AchievementTile)[0];

        act(() => tile.props.handleClaim());

        expect(onClaim).toHaveBeenCalledTimes(1);
        expect((onClaim.mock.calls[0][0] as any).userAchievement.id).toBe(ROWS[0].id);
    });

    it('shows the spinner on the row whose claim is in flight, and only that one', () => {
        const { tree } = renderCollection({ claimingIds: { [ROWS[0].id]: true } });
        const tiles = tree.root.findAllByType(AchievementTile);

        expect(tiles[0].props.isClaiming).toBe(true);
        expect(tiles.slice(1).every((tile) => tile.props.isClaiming === false)).toBe(true);
    });

    it('has no action sections for a user who has not started anything, but still shows the collection', () => {
        const { tree } = renderCollection({ achievements: {} });
        const text = textOf(tree);

        expect(tree.root.findAllByType(AchievementTile)).toHaveLength(0);
        expect(text).not.toContain('Ready to Claim');
        expect(text).not.toContain('Up Next');
        expect(text).toContain('Your Collection');
        expect(text).toContain('0 of 91 earned');
    });

    it('falls back to the empty message for a brand with no achievements', () => {
        const { tree } = renderCollection({
            achievements: {},
            brandVariation: 'notABrand',
            ListEmptyComponent: <React.Fragment>{'nothing here'}</React.Fragment>,
        });

        expect(JSON.stringify(tree.toJSON())).toContain('nothing here');
        expect(textOf(tree)).not.toContain('Your Collection');
    });

    it('folds a ladder\'s locked badges behind a "+N" cell and opens them on press', () => {
        const { tree } = renderCollection({ achievements: { a: ROWS[1], b: ROWS[2], c: ROWS[3], d: ROWS[4] } });
        const habitBuilderCells = () => badgeCells(tree)
            .filter((node) => node.props.testID.startsWith('achievement-badge-cell-habitBuilder:'));

        // Three earned, one in progress, one locked teaser — and the rest held back.
        expect(habitBuilderCells()).toHaveLength(5);
        expect(textOf(tree)).toContain('+3');

        const more = tree.root.findAll(
            (node) => node.props.testID === 'achievement-badge-more' && typeof node.props.onPress === 'function'
                && node.props.accessibilityLabel === 'Show 3 more locked badges',
        )[0];
        act(() => more.props.onPress());

        expect(habitBuilderCells()).toHaveLength(8);
        expect(textOf(tree)).toContain('Show less');
    });

    it('collapses a ladder from its header and keeps the count on it', () => {
        const { tree } = renderCollection();
        const header = pressableByTestId(tree, 'achievement-class-header-dailyStreak');
        const dailyStreakCells = () => badgeCells(tree)
            .filter((node) => node.props.testID.startsWith('achievement-badge-cell-dailyStreak:'));

        expect(dailyStreakCells().length).toBeGreaterThan(0);
        expect(header.props.accessibilityState).toEqual({ expanded: true });

        act(() => header.props.onPress());

        expect(dailyStreakCells()).toHaveLength(0);
        expect(pressableByTestId(tree, 'achievement-class-header-dailyStreak').props.accessibilityState).toEqual({ expanded: false });
        expect(textOf(tree)).toContain('0/14');
    });

    it('opens the badge a cell stands for, locked ones included', () => {
        const { tree, onPressBadge } = renderCollection({ achievements: {} });
        const cell = tree.root.findAll(
            (node) => node.props.testID === 'achievement-badge-cell-dailyStreak:dailyStreak_1_1' && typeof node.props.onPress === 'function',
        )[0];

        act(() => cell.props.onPress());

        expect(onPressBadge).toHaveBeenCalledTimes(1);
        expect(onPressBadge.mock.calls[0][0]).toEqual(expect.objectContaining({ state: 'locked', achievementId: 'dailyStreak_1_1' }));
    });
});

describe('badge grid geometry', () => {
    it('is three across on a phone and widens on larger screens', () => {
        expect([320, 360, 412, 480, 600, 840].map(getBadgeGridColumns)).toEqual([3, 3, 3, 4, 5, 6]);
    });

    it('keeps the card inside its cell at every width', () => {
        [320, 360, 393, 412, 480, 600, 840, 1024].forEach((width) => {
            const columns = getBadgeGridColumns(width);
            const cell = (width - 48 - 8 * (columns - 1)) / columns;

            expect(getBadgeGridCardWidth(width, columns)).toBeLessThanOrEqual(cell);
        });
    });
});

describe('AchievementDetail', () => {
    const renderDetail = (userAchievement: any, props: any = {}) => {
        const badge = toAchievementBadge(userAchievement)!;
        const onClaim = jest.fn();
        const onSelectBadge = jest.fn();
        const tree = render(
            <AchievementDetail
                badge={badge}
                track={getBadgeTrack(badge, ROWS)}
                isCelebrating={false}
                isClaiming={false}
                isReadOnly={false}
                showAnimation
                onClaim={onClaim}
                onSelectBadge={onSelectBadge}
                themeAchievements={themeAchievements}
                translate={translate}
                {...props}
            />,
        );
        return { tree, onClaim, onSelectBadge };
    };

    it('says what an in-progress achievement asks for and how far along it is', () => {
        const { tree } = renderDetail(ROWS[4]);
        const text = textOf(tree);

        expect(text).toEqual(expect.arrayContaining([
            'Habit Builder · Level IV',
            'Habit Formed',
            'Reach a 30-day streak on a habit',
            '24 of 30',
            '6 to go',
            'Level 4 of 8',
        ]));
        // Confetti is for an achievement that has been earned.
        expect(tree.root.findAllByType('LottieView' as any)).toHaveLength(0);
        expect(hostByTestId(tree, 'achievement-detail-claim')).toHaveLength(0);
    });

    it('offers the claim where the reward is, instead of sending the user back to find it', () => {
        const { tree, onClaim } = renderDetail(ROWS[0]);
        const claim = pressableByTestId(tree, 'achievement-detail-claim');

        expect(claim).toBeTruthy();
        act(() => claim.props.onPress());
        expect(onClaim).toHaveBeenCalledTimes(1);
        expect(textOf(tree)).toContain('Earned November 14, 2026');
    });

    it('never offers a claim on someone else\'s badge', () => {
        const { tree } = renderDetail(ROWS[0], { isReadOnly: true });

        expect(tree.root.findAll((node) => node.props.testID === 'achievement-detail-claim')).toHaveLength(0);
    });

    it('celebrates a claim that was just made, and shows the reward as a gain', () => {
        const claimed = { ...ROWS[0], unclaimedRewardPts: 0 };
        const { tree } = renderDetail(claimed, { isCelebrating: true });
        const text = textOf(tree);

        expect(tree.root.findAllByType('LottieView' as any)).toHaveLength(1);
        expect(text).toEqual(expect.arrayContaining(['You earned', '+1', '+20']));
        expect(tree.root.findAll((node) => node.props.testID === 'achievement-detail-claim')).toHaveLength(0);
    });

    it('explains a locked achievement and still shows what it is worth', () => {
        const { tree } = renderDetail({ achievementClass: 'dailyStreak', achievementId: 'dailyStreak_1_1_5' });
        const text = textOf(tree);

        expect(text).toEqual(expect.arrayContaining(['Full Year', 'Locked', 'Rewards', '10', '500']));
        // Not "0 of 165": a badge the user has not reached has no progress to report.
        expect(text.some((line) => line.includes(' of 165'))).toBe(false);
    });

    it('lets the user walk the ladder from its steps', () => {
        const { tree, onSelectBadge } = renderDetail(ROWS[4]);
        const steps = tree.root.findAll(
            (node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('achievement-detail-step-')
                && typeof node.props.onPress === 'function' && typeof node.type !== 'string',
        ).filter((node, index, all) => all.findIndex((other) => other.props.testID === node.props.testID) === index);

        expect(steps).toHaveLength(8);
        expect(steps.filter((step) => step.props.accessibilityState.selected)).toHaveLength(1);

        act(() => steps[5].props.onPress());
        expect(onSelectBadge.mock.calls[0][0]).toEqual(expect.objectContaining({ achievementId: 'habitBuilder_1_1_5' }));
    });

    it('leaves the ladder off an achievement that is not on one', () => {
        const { tree } = renderDetail({ achievementClass: 'dailyStreak', achievementId: 'dailyStreak_1_5' });
        const text = textOf(tree);

        expect(text).toContain('Daily Streak');
        expect(text.some((line) => line.startsWith('Level '))).toBe(false);
    });
});

describe('profile badge shelf', () => {
    it('shows earned badges, then a couple of rows of what is in progress', () => {
        const items = buildShowcaseItems({ userAchievements: ROWS, columns: 3, translate, showCollectionLink: true });
        const headers = items.filter((item) => item.kind === 'header') as any[];

        expect(headers.map((header) => [header.title, header.count])).toEqual([['Earned', 4], ['In Progress', 5]]);
        // Only the first header carries the link to the full collection.
        expect(headers.map((header) => header.hasLink)).toEqual([true, false]);
        expect(items.filter((item) => item.kind === 'row')).toHaveLength(2 + 2);
    });

    it('is empty for someone with no achievements, so the tab can show its empty state', () => {
        expect(buildShowcaseItems({ userAchievements: [], columns: 3, translate, showCollectionLink: false })).toEqual([]);
    });

    it('offers the collection link on the owner\'s shelf only', () => {
        const renderHeader = (showCollectionLink: boolean) => {
            const [header] = buildShowcaseItems({ userAchievements: ROWS, columns: 3, translate, showCollectionLink });
            return render(
                <AchievementShowcaseItem
                    item={header}
                    columns={3}
                    cardWidth={75}
                    onPressBadge={() => undefined}
                    onPressCollection={() => undefined}
                    themeAchievements={themeAchievements}
                    translate={translate}
                />,
            );
        };

        expect(textOf(renderHeader(true))).toContain('Full collection');
        expect(textOf(renderHeader(false))).not.toContain('Full collection');
    });
});
