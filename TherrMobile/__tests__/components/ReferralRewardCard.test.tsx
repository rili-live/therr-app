import 'react-native';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import {
    it, describe, expect, jest, beforeEach,
} from '@jest/globals';
import fs from 'fs';
import path from 'path';

/**
 * The founder-unlock referral card, plus the wiring that makes the two growth-loop pushes and
 * challenge links land somewhere. The card must disappear for anyone it does not apply to —
 * telling a paying customer to "bring 3 friends to unlock" asks them to pay twice.
 */

jest.mock('@react-native-firebase/analytics', () => ({
    __esModule: true,
    getAnalytics: jest.fn(() => ({})),
    logEvent: jest.fn(() => Promise.resolve()),
}));

const mockGetReferralReward = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('therr-react/services', () => ({
    HabitsChallengesService: {
        getReferralReward: (...args: any[]) => mockGetReferralReward(...args),
    },
}));

import ReferralRewardCard from '../../main/components/Habits/ReferralRewardCard';
import { buildStyles as buildHabitsStyles } from '../../main/styles/habits';

const themeHabits = buildHabitsStyles('light') as any;
const translate = (key: string, params?: any) => (
    params ? `${key}(${Object.values(params).join(',')})` : key
);
const flushPromises = () => new Promise<void>((resolve) => { setImmediate(resolve); });

const progress = (overrides: any = {}) => ({
    requiredFriendCount: 3,
    requiredActiveDays: 3,
    qualifiedCount: 1,
    friends: [
        { userName: 'sam', activeDays: 3, isVerified: true, isQualified: true },
        { userName: 'jo', activeDays: 1, isVerified: true, isQualified: false },
        { userName: 'al', activeDays: 2, isVerified: false, isQualified: false },
    ],
    isGranted: false,
    isEntitled: false,
    isAvailable: true,
    ...overrides,
});

const renderCard = async () => {
    const navigation: any = { navigate: jest.fn() };
    let component: renderer.ReactTestRenderer;
    await act(async () => {
        component = renderer.create(
            <ReferralRewardCard navigation={navigation} themeHabits={themeHabits} translate={translate} source="paywall" />,
        );
        await flushPromises();
    });
    // @ts-ignore - assigned inside act
    return { component: component as renderer.ReactTestRenderer, navigation };
};

const allText = (component: renderer.ReactTestRenderer): string => JSON.stringify(component.toJSON());

describe('ReferralRewardCard', () => {
    beforeEach(() => {
        mockGetReferralReward.mockReset();
    });

    it('shows progress and where each friend stands', async () => {
        mockGetReferralReward.mockResolvedValue({ data: progress() });
        const { component, navigation } = await renderCard();
        const text = allText(component);

        expect(text).toContain('pages.referralReward.progressRemaining(1,3,2)');
        expect(text).toContain('pages.referralReward.friendDone');
        expect(text).toContain('pages.referralReward.friendDays(1,3)');
        expect(text).toContain('pages.referralReward.friendUnverified');

        const cta = component.root.findAll((node) => node.props?.accessibilityLabel === 'pages.referralReward.cta'
            && typeof node.props?.onPress === 'function')[0];
        await act(async () => { cta.props.onPress(); });
        expect(navigation.navigate).toHaveBeenCalledWith('CreatePactInvite');
    });

    it.each([
        ['already paid', { isEntitled: true }],
        ['already earned', { isGranted: true }],
        ['offer off or sold out', { isAvailable: false }],
    ])('renders nothing when %s', async (_label, overrides) => {
        mockGetReferralReward.mockResolvedValue({ data: progress(overrides) });
        const { component } = await renderCard();
        expect(component.toJSON()).toBeNull();
    });

    it('renders nothing when the read fails', async () => {
        mockGetReferralReward.mockRejectedValue(new Error('offline'));
        const { component } = await renderCard();
        expect(component.toJSON()).toBeNull();
    });
});

describe('growth-loop wiring', () => {
    const layoutSource = fs.readFileSync(path.resolve(__dirname, '../../main/components/Layout.tsx'), 'utf8');
    const routesSource = fs.readFileSync(path.resolve(__dirname, '../../main/routes/index.tsx'), 'utf8');

    it('registers the challenge screens the links and pushes navigate to', () => {
        expect(routesSource).toMatch(/name: 'ChallengeDetail'/);
        expect(routesSource).toMatch(/name: 'CreateChallenge'/);
    });

    it('routes both new pushes, so a tap never falls through to nothing', () => {
        expect(layoutSource).toMatch(/case PushNotifications\.Types\.challengeJoined:/);
        expect(layoutSource).toMatch(/case PushNotifications\.Types\.habitsReferralRewardEarned:/);
    });

    it('handles challenge links before the claim-pact link, and drains a stashed one after the landing reset', () => {
        expect(layoutSource.indexOf('parseChallengeUrl(url)')).toBeGreaterThan(-1);
        expect(layoutSource.indexOf('parseChallengeUrl(url)')).toBeLessThan(layoutSource.indexOf('url?.match(claimPactRegex)'));
        expect(layoutSource).toMatch(/this\.hasResetToHabitsLanding = true;\s*\n\s*this\.drainPendingChallenge\(\);/);
    });
});
