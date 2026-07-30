import { it, describe, expect } from '@jest/globals';
import { IPact } from 'therr-react/types';
import isPactInviteAwaitingResponse from '../../main/utilities/pactInviteState';

/**
 * Pact invite response-gating regression tests.
 *
 * A prior version of the pact screens gated Accept/Decline on
 * `pact.partnerUserId === currentUserId && pact.status === 'pending'`. That
 * column is only populated for 1:1 invites — group invites (created via
 * `partnerUserIds`) leave it null and track membership in `pact_members`, so
 * group invitees had no way to accept anywhere in the app. It also hid the
 * actions once another invitee had accepted first, since that flips the pact
 * itself to `active` while the remaining member invites are still pending.
 *
 * This mirrors the authorization in users-service `src/handlers/pacts.ts`.
 */

const ME = 'user-me';
const CREATOR = 'user-creator';

const buildPact = (overrides: Partial<IPact> = {}): IPact => ({
    id: 'pact-1',
    creatorUserId: CREATOR,
    habitGoalId: 'goal-1',
    pactType: 'accountability',
    status: 'pending',
    durationDays: 30,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
} as IPact);

const buildMember = (userId: string, role: 'creator' | 'partner', status: string) => ({
    id: `member-${userId}`,
    pactId: 'pact-1',
    userId,
    role,
    status,
    totalCheckins: 0,
    completedCheckins: 0,
    currentStreak: 0,
    longestStreak: 0,
});

describe('isPactInviteAwaitingResponse', () => {
    it('recognizes a 1:1 invite addressed to this user', () => {
        const pact = buildPact({ partnerUserId: ME });

        expect(isPactInviteAwaitingResponse(pact, ME)).toBe(true);
    });

    it('recognizes a group invite where partnerUserId is null', () => {
        const pact = buildPact({
            partnerUserId: undefined,
            members: [
                buildMember(CREATOR, 'creator', 'accepted'),
                buildMember(ME, 'partner', 'pending'),
            ],
        } as Partial<IPact>);

        expect(isPactInviteAwaitingResponse(pact, ME)).toBe(true);
    });

    it('still offers a response when another invitee already activated the pact', () => {
        const pact = buildPact({
            status: 'active',
            partnerUserId: undefined,
            members: [
                buildMember(CREATOR, 'creator', 'accepted'),
                buildMember('user-other', 'partner', 'accepted'),
                buildMember(ME, 'partner', 'pending'),
            ],
        } as Partial<IPact>);

        expect(isPactInviteAwaitingResponse(pact, ME)).toBe(true);
    });

    it('does not offer a response once this user has accepted', () => {
        const pact = buildPact({
            status: 'active',
            partnerUserId: ME,
            members: [
                buildMember(CREATOR, 'creator', 'accepted'),
                buildMember(ME, 'partner', 'accepted'),
            ],
        } as Partial<IPact>);

        expect(isPactInviteAwaitingResponse(pact, ME)).toBe(false);
    });

    it('does not offer a response to the pact creator', () => {
        const pact = buildPact({
            partnerUserId: ME,
            members: [
                buildMember(CREATOR, 'creator', 'accepted'),
                buildMember(ME, 'partner', 'pending'),
            ],
        } as Partial<IPact>);

        expect(isPactInviteAwaitingResponse(pact, CREATOR)).toBe(false);
    });

    it('does not offer a response to a non-participant', () => {
        const pact = buildPact({ partnerUserId: ME });

        expect(isPactInviteAwaitingResponse(pact, 'user-stranger')).toBe(false);
    });

    it('handles a missing pact or user id', () => {
        expect(isPactInviteAwaitingResponse(undefined, ME)).toBe(false);
        expect(isPactInviteAwaitingResponse(buildPact({ partnerUserId: ME }), undefined)).toBe(false);
    });
});
