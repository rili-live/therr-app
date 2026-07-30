import { it, describe, expect } from '@jest/globals';
import { IPact } from 'therr-react/types';
import isPactInviteAwaitingResponse, { getSentInviteState } from '../../main/utilities/pactInviteState';

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

/**
 * Sent-invite state drives the Sent tab, which absorbed the nudge + recovery
 * affordances from the retired MyPacts screen. The nudge button must disappear
 * once a nudge has been sent (the service enforces a 7-day cooldown and would
 * reject a second one), and the "invite someone else" escape hatch must only
 * appear after a nudge has gone unanswered for a day.
 */
describe('getSentInviteState', () => {
    const HOUR = 60 * 60 * 1000;
    const NOW = Date.UTC(2026, 6, 30, 12, 0, 0);

    const buildSentPact = (partnerOverrides: Record<string, any> = {}): IPact => buildPact({
        creatorUserId: ME,
        partnerUserId: 'user-partner',
        members: [
            { ...buildMember(ME, 'creator', 'accepted') },
            {
                ...buildMember('user-partner', 'partner', 'pending'),
                invitedAt: new Date(NOW - (3 * 24 * HOUR)).toISOString(),
                ...partnerOverrides,
            },
        ],
    } as Partial<IPact>);

    it('offers a nudge when none has been sent', () => {
        const state = getSentInviteState(buildSentPact(), ME, NOW);

        expect(state.canNudge).toBe(true);
        expect(state.nudgeSentRecently).toBe(false);
        expect(state.showRecoveryPath).toBe(false);
        expect(state.partnerMember?.userId).toBe('user-partner');
        expect(state.invitedAt.getTime()).toBe(NOW - (3 * 24 * HOUR));
    });

    it('acknowledges a recent nudge instead of offering another', () => {
        const state = getSentInviteState(
            buildSentPact({ nudgedAt: new Date(NOW - (2 * HOUR)).toISOString() }),
            ME,
            NOW,
        );

        expect(state.canNudge).toBe(false);
        expect(state.nudgeSentRecently).toBe(true);
        expect(state.showRecoveryPath).toBe(false);
    });

    it('offers the recovery path once a nudge is a day old with no answer', () => {
        const state = getSentInviteState(
            buildSentPact({ nudgedAt: new Date(NOW - (25 * HOUR)).toISOString() }),
            ME,
            NOW,
        );

        expect(state.canNudge).toBe(false);
        expect(state.nudgeSentRecently).toBe(false);
        expect(state.showRecoveryPath).toBe(true);
    });

    it('falls back to the pact createdAt when the member row has no invitedAt', () => {
        const pact = buildPact({
            creatorUserId: ME,
            createdAt: new Date(NOW - (5 * HOUR)).toISOString(),
        });

        const state = getSentInviteState(pact, ME, NOW);

        expect(state.partnerMember).toBeUndefined();
        expect(state.invitedAt.getTime()).toBe(NOW - (5 * HOUR));
        expect(state.canNudge).toBe(true);
    });
});
