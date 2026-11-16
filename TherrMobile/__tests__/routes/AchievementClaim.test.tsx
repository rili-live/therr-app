import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, jest, beforeEach, afterEach } from '@jest/globals';

/**
 * The badge detail screen, as a screen: what it does with the route it is opened with
 * and with a claim. It is reached three ways — from the Achievements grid (possibly for a
 * locked badge with no backend row), straight after a claim on the list, and from someone
 * else's profile — and each hands it a different shape of params.
 */
jest.mock('lottie-react-native', () => 'LottieView');
// Its ScrollView schedules a native-handler update on setImmediate, which fires after the
// Jest environment is torn down and takes the worker with it.
jest.mock('react-native-gesture-handler', () => ({ ScrollView: 'ScrollView' }));
jest.mock('../../main/components/ButtonMenu/MainButtonMenu', () => 'MainButtonMenu');
jest.mock('../../main/components/Modals/SharePromptModal', () => 'SharePromptModal');
jest.mock('../../main/components/BaseStatusBar', () => 'BaseStatusBar');
jest.mock('../../main/components/TherrIcon', () => 'TherrIcon');
jest.mock('../../main/utilities/toasts', () => ({
    showToast: { success: jest.fn(), error: jest.fn() },
}));
jest.mock('../../main/utilities/appReviewPrompt', () => ({
    recordPositiveSignal: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../main/utilities/rewardFeedback', () => ({
    triggerClaimErrorFeedback: jest.fn(),
    triggerClaimPressFeedback: jest.fn(),
    triggerClaimSuccessFeedback: jest.fn(),
    triggerRewardCelebration: jest.fn(() => jest.fn()),
}));

import { AchievementClaim } from '../../main/routes/Achievements/AchievementClaim';
import AchievementDetail from '../../main/routes/Achievements/AchievementDetail';
import { triggerRewardCelebration } from '../../main/utilities/rewardFeedback';
import { showToast } from '../../main/utilities/toasts';

const CLAIMABLE = {
    id: 'ua-1',
    achievementClass: 'socialite',
    achievementId: 'socialite_1_1_2',
    progressCount: 25,
    completedAt: '2026-11-14T12:00:00.000Z',
    unclaimedRewardPts: '1.00',
};
const IN_PROGRESS = {
    id: 'ua-2',
    achievementClass: 'habitBuilder',
    achievementId: 'habitBuilder_1_1_3',
    progressCount: 24,
    completedAt: null,
    unclaimedRewardPts: 0,
};

const deferred = () => {
    let resolve: (value?: any) => void = () => undefined;
    let reject: (reason?: any) => void = () => undefined;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

const mount = ({ params, achievements = [CLAIMABLE, IN_PROGRESS], claim }: { params?: any; achievements?: any[]; claim?: any }) => {
    const navigation = {
        setOptions: jest.fn(),
        navigate: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn(() => true),
    };
    const claimMyAchievement = claim || jest.fn(() => Promise.resolve());
    const getMyAchievements = jest.fn(() => Promise.resolve());
    let tree: renderer.ReactTestRenderer;
    act(() => {
        tree = renderer.create(
            <AchievementClaim
                navigation={navigation}
                route={{ params }}
                user={{
                    achievements: Object.fromEntries(achievements.map((row) => [row.id, row])),
                    details: { id: 'me' },
                    settings: { locale: 'en-us', mobileThemeName: 'light' },
                } as any}
                claimMyAchievement={claimMyAchievement}
                getMyAchievements={getMyAchievements}
                updateUser={jest.fn()}
            />,
        );
    });
    return { tree: tree!, navigation, claimMyAchievement, getMyAchievements };
};

const detailOf = (tree: renderer.ReactTestRenderer) => tree.root.findAllByType(AchievementDetail)[0];
const flush = async () => {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    });
};

beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
});

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
});

describe('AchievementClaim (badge detail screen)', () => {
    it('says the achievement is unavailable, rather than crashing, when opened with no params', () => {
        const { tree } = mount({ params: undefined });

        expect(tree.root.findAllByType(AchievementDetail)).toHaveLength(0);
        expect(JSON.stringify(tree.toJSON())).toContain('available in this version');
    });

    it('does the same for an achievement this build has no config for', () => {
        const { tree } = mount({
            params: { userAchievement: { id: 'ua-9', achievementClass: 'habitBuilder', achievementId: 'habitBuilder_9_9' } },
        });

        expect(tree.root.findAllByType(AchievementDetail)).toHaveLength(0);
    });

    it('shows a locked badge from just its class and id', () => {
        const { tree } = mount({
            params: { userAchievement: { achievementClass: 'dailyStreak', achievementId: 'dailyStreak_1_1_5' } },
        });

        expect(detailOf(tree).props.badge).toEqual(expect.objectContaining({ state: 'locked', achievementId: 'dailyStreak_1_1_5' }));
        expect(detailOf(tree).props.isReadOnly).toBe(false);
    });

    it('reads the freshest state of the badge from the store, not the copy it was opened with', () => {
        const stale = { ...IN_PROGRESS, progressCount: 3 };
        const { tree } = mount({ params: { userAchievement: stale } });

        expect(detailOf(tree).props.badge.progressCount).toBe(24);
    });

    it('opens already celebrating, with nothing left to claim, straight after a claim on the list', () => {
        // The list navigates as soon as its claim resolves; the store may still say "unclaimed".
        const { tree } = mount({ params: { userAchievement: { ...CLAIMABLE, unclaimedRewardPts: 0 }, isClaiming: true } });

        expect(detailOf(tree).props.isCelebrating).toBe(true);
        expect(detailOf(tree).props.badge.state).toBe('earned');
    });

    it('claims in place: sends the row, then celebrates and stops offering the claim', async () => {
        const { tree, claimMyAchievement } = mount({ params: { userAchievement: CLAIMABLE } });

        expect(detailOf(tree).props.badge.state).toBe('claimable');

        act(() => detailOf(tree).props.onClaim());
        expect(claimMyAchievement).toHaveBeenCalledWith('ua-1', '1.00');
        expect(detailOf(tree).props.isClaiming).toBe(true);

        // A second press while the request is in flight sends nothing more.
        act(() => detailOf(tree).props.onClaim());
        expect(claimMyAchievement).toHaveBeenCalledTimes(1);

        await flush();

        expect(detailOf(tree).props.isClaiming).toBe(false);
        expect(detailOf(tree).props.isCelebrating).toBe(true);
        expect(detailOf(tree).props.badge.state).toBe('earned');
        expect(triggerRewardCelebration).toHaveBeenCalledTimes(1);
        expect(tree.root.findByType('SharePromptModal' as any).props.isVisible).toBe(true);
        // The share copy names the badge that was earned.
        expect(tree.root.findByType('SharePromptModal' as any).props.shareMessage).toContain('Initiator');
    });

    it('leaves the reward claimable and tells the user when the claim fails', async () => {
        const { tree } = mount({
            params: { userAchievement: CLAIMABLE },
            claim: jest.fn(() => Promise.reject(new Error('offline'))),
        });

        act(() => detailOf(tree).props.onClaim());
        await flush();

        expect(showToast.error).toHaveBeenCalledTimes(1);
        expect(detailOf(tree).props.badge.state).toBe('claimable');
        expect(detailOf(tree).props.isClaiming).toBe(false);
        expect(triggerRewardCelebration).not.toHaveBeenCalled();
    });

    it('starts no celebration for a claim that lands after the user has left the screen', async () => {
        const pending = deferred();
        const { tree } = mount({ params: { userAchievement: CLAIMABLE }, claim: jest.fn(() => pending.promise) });

        act(() => detailOf(tree).props.onClaim());
        act(() => tree.unmount());
        pending.resolve();
        await flush();

        expect(triggerRewardCelebration).not.toHaveBeenCalled();
    });

    it('does nothing when asked to claim a badge with no reward waiting', () => {
        const { tree, claimMyAchievement } = mount({ params: { userAchievement: IN_PROGRESS } });

        act(() => detailOf(tree).props.onClaim());

        expect(claimMyAchievement).not.toHaveBeenCalled();
    });

    it('is read-only, and draws from the owner\'s rows, when opened from someone else\'s profile', () => {
        const theirs = [{ ...CLAIMABLE, id: 'their-1', unclaimedRewardPts: undefined }];
        const { tree, claimMyAchievement, getMyAchievements } = mount({
            params: { userAchievement: theirs[0], ownerAchievements: theirs },
            achievements: [],
        });

        expect(detailOf(tree).props.isReadOnly).toBe(true);
        expect(detailOf(tree).props.badge.state).toBe('earned');

        act(() => detailOf(tree).props.onClaim());
        expect(claimMyAchievement).not.toHaveBeenCalled();
        expect(getMyAchievements).not.toHaveBeenCalled();
    });

    it('walks the ladder in place when a level step is chosen', () => {
        const { tree } = mount({ params: { userAchievement: IN_PROGRESS } });
        const next = detailOf(tree).props.track[4];

        act(() => detailOf(tree).props.onSelectBadge(next));

        expect(detailOf(tree).props.badge.achievementId).toBe('habitBuilder_1_1_4');
        expect(detailOf(tree).props.badge.state).toBe('locked');
    });

    it('goes back to where it was opened from, and to Achievements only when there is nowhere to go back to', () => {
        const { tree, navigation } = mount({ params: { userAchievement: IN_PROGRESS } });
        const headerLeft = (navigation.setOptions.mock.calls[0][0] as any).headerLeft;
        const back = headerLeft();

        act(() => back.props.onPress());
        expect(navigation.goBack).toHaveBeenCalledTimes(1);
        expect(navigation.navigate).not.toHaveBeenCalled();

        navigation.canGoBack.mockReturnValue(false);
        act(() => back.props.onPress());
        expect(navigation.navigate).toHaveBeenCalledWith('Achievements');
        expect(tree).toBeTruthy();
    });
});
