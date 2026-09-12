import { it, describe, expect } from '@jest/globals';
import {
    MIN_PACT_MEMBERS,
    canManagePactMembers,
    canRemovePactMember,
    getNonTerminalPactMemberIds,
} from '../../main/routes/Habits/pactState';

/**
 * Client-side gates for pact member management — mirror the users-service authority
 * (`utilities/pactStreak.ts`). A drift here only shows the wrong affordance; the server
 * re-checks and rejects. These pin the "creator only", "floor of 2", and "solo escape hatch"
 * rules the UI draws from.
 */
describe('canManagePactMembers', () => {
    const creatorId = 'creator-1';
    // `activeMemberCount` is hydrated by a users-service that has the member routes; every
    // "may manage" case below carries it, and one case checks that its absence hides the feature.
    const live = { creatorUserId: creatorId, activeMemberCount: 2 };

    it('lets the creator manage an active pact', () => {
        expect(canManagePactMembers({ ...live, status: 'active' }, creatorId)).toBe(true);
    });

    it('lets the creator manage a still-pending pact', () => {
        expect(canManagePactMembers({ ...live, status: 'pending' }, creatorId)).toBe(true);
    });

    it('does not let a non-creator manage members', () => {
        expect(canManagePactMembers({ ...live, status: 'active' }, 'someone-else')).toBe(false);
    });

    it('does not offer management on a finished/abandoned pact', () => {
        expect(canManagePactMembers({ ...live, status: 'completed' }, creatorId)).toBe(false);
        expect(canManagePactMembers({ ...live, status: 'abandoned' }, creatorId)).toBe(false);
    });

    it('does not offer management on a renewable (ended-but-unswept) pact', () => {
        const ended = {
            ...live,
            status: 'active',
            endDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        };
        expect(canManagePactMembers(ended, creatorId)).toBe(false);
    });

    it('hides member management when the service has not hydrated activeMemberCount (older backend)', () => {
        // The mobile and backend releases ship independently; against a users-service without
        // the member routes the "add members" tap would 404 at the gateway.
        expect(canManagePactMembers({ creatorUserId: creatorId, status: 'active' }, creatorId)).toBe(false);
        expect(canManagePactMembers({ creatorUserId: creatorId, status: 'pending' }, creatorId)).toBe(false);
    });
});

describe('getNonTerminalPactMemberIds', () => {
    it('lists active members and open invites, but not those who left or were removed', () => {
        const pact = {
            members: [
                { userId: 'creator', status: 'active' },
                { userId: 'partner', status: 'active' },
                { userId: 'invited', status: 'pending' },
                { userId: 'gone', status: 'left' },
                { userId: 'booted', status: 'removed' },
                { userId: 'declined', status: 'declined' },
            ],
        };
        expect(getNonTerminalPactMemberIds(pact)).toEqual(['creator', 'partner', 'invited']);
    });

    it('is empty for a pact with no members loaded', () => {
        expect(getNonTerminalPactMemberIds({})).toEqual([]);
        expect(getNonTerminalPactMemberIds(null)).toEqual([]);
    });

    it('skips member rows without a userId', () => {
        expect(getNonTerminalPactMemberIds({ members: [{ status: 'active' }, { userId: 'a', status: 'active' }] })).toEqual(['a']);
    });
});

describe('canRemovePactMember', () => {
    it('always allows rescinding a pending invite', () => {
        expect(canRemovePactMember({ activeMemberCount: 2 }, { role: 'partner', status: 'pending' })).toBe(true);
    });

    it('allows removing an active member only while the floor still holds', () => {
        expect(MIN_PACT_MEMBERS).toBe(2);
        // 3 active -> 2 remain, still a pact
        expect(canRemovePactMember({ activeMemberCount: 3 }, { role: 'partner', status: 'active' })).toBe(true);
        // 2 active -> 1 remain, below the floor (the last member takes continue-solo instead)
        expect(canRemovePactMember({ activeMemberCount: 2 }, { role: 'partner', status: 'active' })).toBe(false);
    });

    it('never removes the creator', () => {
        expect(canRemovePactMember({ activeMemberCount: 3 }, { role: 'creator', status: 'active' })).toBe(false);
    });

    it('treats an unknown active count as not removable (safe direction)', () => {
        expect(canRemovePactMember({}, { role: 'partner', status: 'active' })).toBe(false);
    });

    it('does not remove a member who has already left', () => {
        expect(canRemovePactMember({ activeMemberCount: 3 }, { role: 'partner', status: 'left' })).toBe(false);
    });
});
