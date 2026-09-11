import { it, describe, expect } from '@jest/globals';
import {
    MIN_PACT_MEMBERS,
    canManagePactMembers,
    canRemovePactMember,
} from '../../main/routes/Habits/pactState';

/**
 * Client-side gates for pact member management — mirror the users-service authority
 * (`utilities/pactStreak.ts`). A drift here only shows the wrong affordance; the server
 * re-checks and rejects. These pin the "creator only", "floor of 2", and "solo escape hatch"
 * rules the UI draws from.
 */
describe('canManagePactMembers', () => {
    const creatorId = 'creator-1';

    it('lets the creator manage an active pact', () => {
        expect(canManagePactMembers({ creatorUserId: creatorId, status: 'active' }, creatorId)).toBe(true);
    });

    it('lets the creator manage a still-pending pact', () => {
        expect(canManagePactMembers({ creatorUserId: creatorId, status: 'pending' }, creatorId)).toBe(true);
    });

    it('does not let a non-creator manage members', () => {
        expect(canManagePactMembers({ creatorUserId: creatorId, status: 'active' }, 'someone-else')).toBe(false);
    });

    it('does not offer management on a finished/abandoned pact', () => {
        expect(canManagePactMembers({ creatorUserId: creatorId, status: 'completed' }, creatorId)).toBe(false);
        expect(canManagePactMembers({ creatorUserId: creatorId, status: 'abandoned' }, creatorId)).toBe(false);
    });

    it('does not offer management on a renewable (ended-but-unswept) pact', () => {
        const ended = {
            creatorUserId: creatorId,
            status: 'active',
            endDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        };
        expect(canManagePactMembers(ended, creatorId)).toBe(false);
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
