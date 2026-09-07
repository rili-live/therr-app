import { it, describe, expect } from '@jest/globals';
import { getCheckedInToday, getMemberMeta } from '../../main/components/Habits/PactMemberRow';

/**
 * The Friend Streak surface (therr-app docs/WORK_IN_PROGRESS.md § 2.6.2).
 *
 * Duolingo's Friend Streak — a streak shared with up to five people, no
 * leaderboard and no messaging — makes learners 22% more likely to complete
 * their daily lesson. It adds nothing but a second reader, which only works if
 * a partner's absence is actually *noticeable*. This row rendered
 * "partner · active" and nothing else, so it was not.
 *
 * The one thing this indicator must never do is imply someone missed a day when
 * the server simply did not say. `checkedInToday` was added to users-service
 * after this screen shipped, so an older service returns nothing at all, and
 * "unknown" has to render as absent rather than as a hollow "not yet" badge.
 */

const translate = (key: string, params?: any): string => {
    if (key === 'pages.pacts.memberStreak') {
        return `${params.count}-day streak`;
    }
    return key.split('.').pop() as string;
};

const member = (overrides: any = {}) => ({
    id: 'member-1',
    pactId: 'pact-1',
    userId: 'user-1',
    role: 'partner' as const,
    status: 'active',
    totalCheckins: 10,
    completedCheckins: 9,
    currentStreak: 12,
    longestStreak: 20,
    ...overrides,
});

describe('pact member — today state', () => {
    it('reads checkedInToday when the server reports it', () => {
        expect(getCheckedInToday(member({ checkedInToday: true }) as any)).toBe(true);
        expect(getCheckedInToday(member({ checkedInToday: false }) as any)).toBe(false);
    });

    // The distinction the whole indicator rests on: absent is not false.
    it('reports undefined — not false — when the server did not say', () => {
        expect(getCheckedInToday(member() as any)).toBeUndefined();
    });
});

describe('pact member — meta line', () => {
    it('shows an active member their shared streak', () => {
        expect(getMemberMeta(member() as any, translate)).toContain('12-day streak');
    });

    // A pending invitee has no shared streak yet; someone who left has a number
    // about a habit they are no longer keeping with you.
    it('omits the streak for a member who is not active', () => {
        expect(getMemberMeta(member({ status: 'pending' }) as any, translate)).not.toContain('streak');
        expect(getMemberMeta(member({ status: 'left' }) as any, translate)).not.toContain('streak');
    });

    it('omits a zero streak rather than rendering "0-day streak"', () => {
        expect(getMemberMeta(member({ currentStreak: 0 }) as any, translate)).not.toContain('streak');
    });

    it('still leads with role and status', () => {
        expect(getMemberMeta(member() as any, translate)).toBe('partner · active · 12-day streak');
    });
});
