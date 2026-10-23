import { it, describe, expect } from '@jest/globals';
import {
    buildChallengeShareMessage,
    buildChallengeUrl,
    formatChallengeScore,
    formatChallengeTimeLeft,
    getChallengeActions,
    isChallenge,
    parseChallengeUrl,
    shouldShowReferralReward,
} from '../../main/routes/Challenges/challengeFormat';

/**
 * Join-by-link challenge helpers. The parser matters most: this host is an App Link, so every
 * habits.therr.com URL opens the app, and a challenge link the app fails to recognise lands the
 * user on the dashboard with no sign of the challenge they tapped.
 */

const translate = (key: string, params?: any) => (
    params ? `${key}(${Object.values(params).join(',')})` : key
);

const challenge = (overrides: any = {}): any => ({
    id: 'c1',
    joinToken: 'AbCdEf123456',
    title: 'October miles',
    habitGoalId: 'g1',
    goal: { name: 'Run', amountUnit: null },
    creator: { userName: 'casey', displayName: 'Casey' },
    startDate: '2026-10-01',
    endDate: '2026-10-30',
    status: 'active',
    hasStarted: true,
    hasEnded: false,
    daysLeft: 8,
    durationDays: 30,
    memberCount: 2,
    maxMembers: 50,
    isFull: false,
    rankedBy: 'checkinDays',
    standings: [],
    viewer: null,
    ...overrides,
});

describe('parseChallengeUrl', () => {
    it('reads the token from every shape the link arrives in', () => {
        expect(parseChallengeUrl('https://habits.therr.com/c/AbCdEf123456')).toBe('AbCdEf123456');
        expect(parseChallengeUrl('https://www.habits.therr.com/c/AbCdEf123456/')).toBe('AbCdEf123456');
        expect(parseChallengeUrl('https://habits.therr.com/c/AbCdEf123456?utm_source=share')).toBe('AbCdEf123456');
        expect(parseChallengeUrl('https://HABITS.therr.com/c/AbCdEf123456#top')).toBe('AbCdEf123456');
    });

    it('ignores anything that is not a challenge link', () => {
        expect(parseChallengeUrl('https://habits.therr.com/c/AbCdEf123456/card.png')).toBeNull();
        expect(parseChallengeUrl('https://habits.therr.com/c/short')).toBeNull();
        expect(parseChallengeUrl('https://www.therr.com/c/AbCdEf123456')).toBeNull();
        expect(parseChallengeUrl('https://habits.therr.com/claim-pact/AbCdEf123456')).toBeNull();
        expect(parseChallengeUrl(undefined)).toBeNull();
    });

    it('round-trips with buildChallengeUrl', () => {
        expect(parseChallengeUrl(buildChallengeUrl('Zz9Yy8Xx7Ww6'))).toBe('Zz9Yy8Xx7Ww6');
    });
});

describe('formatting', () => {
    it('scores by days, or by amount on a measured goal', () => {
        expect(formatChallengeScore({ checkinDays: 1, totalAmount: 0 }, challenge(), translate)).toBe('pages.challenges.scoreDay(1)');
        expect(formatChallengeScore({ checkinDays: 4, totalAmount: 0 }, challenge(), translate)).toBe('pages.challenges.scoreDays(4)');
        expect(formatChallengeScore(
            { checkinDays: 4, totalAmount: 42.46 },
            challenge({ rankedBy: 'amount', goal: { name: 'Run', amountUnit: 'km' } }),
            translate,
        )).toBe('42.5 km');
    });

    it('describes the time left', () => {
        expect(formatChallengeTimeLeft(challenge(), translate)).toBe('pages.challenges.timeDaysLeft(8)');
        expect(formatChallengeTimeLeft(challenge({ daysLeft: 1 }), translate)).toBe('pages.challenges.timeLastDay');
        expect(formatChallengeTimeLeft(challenge({ hasStarted: false }), translate)).toBe('pages.challenges.timeNotStarted');
        expect(formatChallengeTimeLeft(challenge({ hasEnded: true }), translate)).toBe('pages.challenges.timeEnded');
    });

    it('names the leader in the share text only once someone has checked in', () => {
        expect(buildChallengeShareMessage(challenge(), translate)).toContain('pages.challenges.shareMessage(');
        const led = challenge({ standings: [{ rank: 1, userName: 'sam', displayName: 'Sam', checkinDays: 3, totalAmount: 0 }] });
        expect(buildChallengeShareMessage(led, translate)).toContain('shareMessageWithLeader(October miles,Sam,');
        expect(buildChallengeShareMessage(led, translate)).toContain('https://habits.therr.com/c/AbCdEf123456');
    });
});

describe('getChallengeActions', () => {
    it('offers join to an outsider on a running challenge with room', () => {
        expect(getChallengeActions(challenge({ viewer: { isMember: false, isCreator: false, rank: null } })))
            .toEqual({ canJoin: true, canShare: true, canOpenHabit: false, canLeave: false, canEnd: false });
    });

    it('never offers join on a full, ended or cancelled challenge', () => {
        expect(getChallengeActions(challenge({ isFull: true })).canJoin).toBe(false);
        expect(getChallengeActions(challenge({ hasEnded: true })).canJoin).toBe(false);
        expect(getChallengeActions(challenge({ status: 'cancelled' })).canJoin).toBe(false);
    });

    it('lets a member leave and the creator end, never both', () => {
        const member = getChallengeActions(challenge({ viewer: { isMember: true, isCreator: false, rank: 2 } }));
        expect(member).toMatchObject({ canJoin: false, canOpenHabit: true, canLeave: true, canEnd: false });
        const creator = getChallengeActions(challenge({ viewer: { isMember: true, isCreator: true, rank: 1 } }));
        expect(creator).toMatchObject({ canLeave: false, canEnd: true });
        expect(getChallengeActions(challenge({ hasEnded: true, viewer: { isMember: true, isCreator: true, rank: 1 } })).canEnd)
            .toBe(false);
    });
});

describe('response guards', () => {
    it('treats the offline fallback as no challenge, not an empty one', () => {
        expect(isChallenge({})).toBe(false);
        expect(isChallenge(challenge())).toBe(true);
    });

    it('shows the referral offer only to an unpaid account while it is on', () => {
        const progress: any = {
            requiredFriendCount: 3, requiredActiveDays: 3, qualifiedCount: 1, friends: [], isGranted: false, isEntitled: false, isAvailable: true,
        };
        expect(shouldShowReferralReward(progress)).toBe(true);
        expect(shouldShowReferralReward({ ...progress, isEntitled: true })).toBe(false);
        expect(shouldShowReferralReward({ ...progress, isGranted: true })).toBe(false);
        expect(shouldShowReferralReward({ ...progress, isAvailable: false })).toBe(false);
        expect(shouldShowReferralReward(null)).toBe(false);
    });
});
