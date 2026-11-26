import { it, describe, expect } from '@jest/globals';
import { IPact, IPactMember } from 'therr-react/types';
import getFormerMemberState from '../../main/utilities/pactFormerMember';

/**
 * A creator whose open pact the digest handed to a new host is marked `left` and was, until this
 * state existed, shown their old pact as if nothing had happened — with a join request
 * notification pointing at it and nothing on screen to answer it with.
 */

const ME = 'user-me';
const HOST = 'user-host';
const NOW = Date.parse('2026-11-26T12:00:00.000Z');

const member = (userId: string, overrides: Partial<IPactMember> = {}): IPactMember => ({
    userId,
    role: userId === HOST ? 'creator' : 'partner',
    status: 'active',
    userName: userId,
    ...overrides,
} as IPactMember);

const buildPact = (overrides: Partial<IPact> = {}, me: Partial<IPactMember> = { status: 'left' }): IPact => ({
    id: 'pact-1',
    creatorUserId: HOST,
    habitGoalId: 'goal-1',
    pactType: 'accountability',
    status: 'active',
    durationDays: 30,
    isOpen: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    members: [member(HOST), member(ME, me)],
    ...overrides,
} as IPact);

describe('getFormerMemberState', () => {
    it('names the new host to a creator the pact was handed away from, and offers to rejoin', () => {
        const state = getFormerMemberState(buildPact(), ME, NOW);

        expect(state?.hostMember?.userId).toBe(HOST);
        expect(state?.canAskToRejoin).toBe(true);
    });

    it('is nothing for a current member, the host, or someone with no seat at all', () => {
        expect(getFormerMemberState(buildPact({}, { status: 'active' }), ME, NOW)).toBeNull();
        expect(getFormerMemberState(buildPact(), HOST, NOW)).toBeNull();
        expect(getFormerMemberState(buildPact({ members: [member(HOST)] }), ME, NOW)).toBeNull();
        expect(getFormerMemberState(undefined, ME, NOW)).toBeNull();
    });

    it('offers no rejoin on a closed, ended or past-its-end pact, nor to someone removed', () => {
        expect(getFormerMemberState(buildPact({ isOpen: false }), ME, NOW)?.canAskToRejoin).toBe(false);
        expect(getFormerMemberState(buildPact({ status: 'completed' }), ME, NOW)?.canAskToRejoin).toBe(false);
        expect(getFormerMemberState(buildPact({ endDate: '2026-11-20T00:00:00.000Z' }), ME, NOW)?.canAskToRejoin).toBe(false);
        expect(getFormerMemberState(buildPact({}, { status: 'removed' }), ME, NOW)?.canAskToRejoin).toBe(false);
    });
});
