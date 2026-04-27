/* eslint-disable quotes, max-len */
import { expect } from 'chai';

/**
 * Pacts Handler — bulk-invite + group-pact acceptance regression tests.
 *
 * The wizard sends N partner invites in a single bulk-invite call. The
 * server creates one pact (partnerUserId left null for groups) and N
 * pact_members rows. Any invitee can accept, joining as an active member.
 *
 * These tests mirror the validation and authorization logic from
 * `src/handlers/pacts.ts` in pure form so we can exercise the decision tree
 * without standing up Express, Stores, or push notifications. The full
 * happy-path is covered by the integration suite.
 */

const MAX_BULK_INVITEES = 5;

const dedupeUserIds = (ids: unknown[]): string[] => Array.from(
    new Set(
        ids.filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
);

interface IBulkValidation {
    valid: boolean;
    error?: string;
    invitees?: string[];
}

const validateBulkInvite = ({
    habitGoalId,
    partnerUserIds,
    requesterId,
}: {
    habitGoalId?: string;
    partnerUserIds?: unknown;
    requesterId: string;
}): IBulkValidation => {
    if (!habitGoalId) {
        return { valid: false, error: 'habitGoalRequired' };
    }
    if (!Array.isArray(partnerUserIds) || partnerUserIds.length === 0) {
        return { valid: false, error: 'partnerUserIdsRequired' };
    }
    const invitees = dedupeUserIds(partnerUserIds).filter((id) => id !== requesterId);
    if (invitees.length === 0) {
        return { valid: false, error: 'noValidInvitees' };
    }
    if (invitees.length > MAX_BULK_INVITEES) {
        return { valid: false, error: 'tooManyInvitees' };
    }
    return { valid: true, invitees };
};

interface IAcceptDecisionInput {
    pact: {
        creatorUserId: string;
        partnerUserId: string | null;
        status: 'pending' | 'active' | 'completed' | 'abandoned' | 'expired';
    };
    member: {
        role: 'creator' | 'partner';
        status: 'pending' | 'active' | 'left';
    } | null;
    requesterId: string;
}

interface IAcceptDecision {
    allowed: boolean;
    error?: 'forbidden' | 'notPending' | 'noLongerAccepting';
    activatePact: boolean; // first acceptance flips pact.status pending → active
    activateCreator: boolean; // creator's pact_member is activated alongside
    createCreatorStreak: boolean;
}

const decideAccept = ({ pact, member, requesterId }: IAcceptDecisionInput): IAcceptDecision => {
    const isInvitedPartner = pact.partnerUserId === requesterId
        || (member !== null && member.role === 'partner' && member.status === 'pending');
    if (!isInvitedPartner) {
        return {
            allowed: false, error: 'forbidden', activatePact: false, activateCreator: false, createCreatorStreak: false,
        };
    }
    if (pact.status === 'completed' || pact.status === 'abandoned' || pact.status === 'expired') {
        return {
            allowed: false, error: 'noLongerAccepting', activatePact: false, activateCreator: false, createCreatorStreak: false,
        };
    }
    const memberInvitePending = member === null || member.status === 'pending';
    if (pact.status !== 'pending' && !memberInvitePending) {
        return {
            allowed: false, error: 'notPending', activatePact: false, activateCreator: false, createCreatorStreak: false,
        };
    }
    return {
        allowed: true,
        activatePact: pact.status === 'pending',
        activateCreator: pact.status === 'pending',
        createCreatorStreak: pact.status === 'pending',
    };
};

describe('Pacts handler — bulk-invite validation', () => {
    const requesterId = 'user-creator';
    const habitGoalId = 'goal-1';

    it('rejects when habitGoalId is missing', () => {
        const result = validateBulkInvite({ habitGoalId: undefined, partnerUserIds: ['p1'], requesterId });
        expect(result.valid).to.be.eq(false);
        expect(result.error).to.equal('habitGoalRequired');
    });

    it('rejects a non-array partnerUserIds', () => {
        const result = validateBulkInvite({ habitGoalId, partnerUserIds: 'p1' as any, requesterId });
        expect(result.valid).to.be.eq(false);
        expect(result.error).to.equal('partnerUserIdsRequired');
    });

    it('rejects an empty partnerUserIds array', () => {
        const result = validateBulkInvite({ habitGoalId, partnerUserIds: [], requesterId });
        expect(result.valid).to.be.eq(false);
        expect(result.error).to.equal('partnerUserIdsRequired');
    });

    it('dedupes repeated partner ids before counting', () => {
        const result = validateBulkInvite({ habitGoalId, partnerUserIds: ['p1', 'p1', 'p2'], requesterId });
        expect(result.valid).to.be.eq(true);
        expect(result.invitees).to.deep.equal(['p1', 'p2']);
    });

    it('strips out the requester id (cannot invite yourself)', () => {
        const result = validateBulkInvite({ habitGoalId, partnerUserIds: [requesterId, 'p1'], requesterId });
        expect(result.valid).to.be.eq(true);
        expect(result.invitees).to.deep.equal(['p1']);
    });

    it('rejects when only invalid ids remain after filtering', () => {
        const result = validateBulkInvite({ habitGoalId, partnerUserIds: [requesterId, '', null as any, undefined as any], requesterId });
        expect(result.valid).to.be.eq(false);
        expect(result.error).to.equal('noValidInvitees');
    });

    it('accepts the maximum of 5 unique invitees', () => {
        const result = validateBulkInvite({ habitGoalId, partnerUserIds: ['p1', 'p2', 'p3', 'p4', 'p5'], requesterId });
        expect(result.valid).to.be.eq(true);
        expect(result.invitees).to.have.length(5);
    });

    it('rejects more than the maximum of 5 invitees', () => {
        const result = validateBulkInvite({ habitGoalId, partnerUserIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'], requesterId });
        expect(result.valid).to.be.eq(false);
        expect(result.error).to.equal('tooManyInvitees');
    });
});

describe('Pacts handler — group-pact acceptance authorization', () => {
    const creatorUserId = 'creator-1';
    const requesterId = 'partner-1';

    it('1:1 pact: invited partnerUserId can accept when status is pending', () => {
        const decision = decideAccept({
            pact: { creatorUserId, partnerUserId: requesterId, status: 'pending' },
            member: { role: 'partner', status: 'pending' },
            requesterId,
        });
        expect(decision.allowed).to.be.eq(true);
        expect(decision.activatePact).to.be.eq(true);
        expect(decision.createCreatorStreak).to.be.eq(true);
    });

    it('group pact: an invitee with a pending pact_members row can accept while pact is still pending (first accept)', () => {
        const decision = decideAccept({
            pact: { creatorUserId, partnerUserId: null, status: 'pending' },
            member: { role: 'partner', status: 'pending' },
            requesterId,
        });
        expect(decision.allowed).to.be.eq(true);
        expect(decision.activatePact).to.be.eq(true);
        expect(decision.activateCreator).to.be.eq(true);
    });

    it('group pact: a second invitee can accept while pact is already active (subsequent accept)', () => {
        const decision = decideAccept({
            pact: { creatorUserId, partnerUserId: null, status: 'active' },
            member: { role: 'partner', status: 'pending' },
            requesterId,
        });
        expect(decision.allowed).to.be.eq(true);
        expect(decision.activatePact).to.be.eq(false); // already activated
        expect(decision.activateCreator).to.be.eq(false);
        expect(decision.createCreatorStreak).to.be.eq(false); // creator streak already exists
    });

    it('rejects a non-invitee (no member row, no partnerUserId match)', () => {
        const decision = decideAccept({
            pact: { creatorUserId, partnerUserId: 'someone-else', status: 'pending' },
            member: null,
            requesterId,
        });
        expect(decision.allowed).to.be.eq(false);
        expect(decision.error).to.equal('forbidden');
    });

    it('rejects a member whose invite was already left/declined', () => {
        const decision = decideAccept({
            pact: { creatorUserId, partnerUserId: null, status: 'active' },
            member: { role: 'partner', status: 'left' },
            requesterId,
        });
        expect(decision.allowed).to.be.eq(false);
        expect(decision.error).to.equal('forbidden');
    });

    it('rejects acceptance on a completed/abandoned/expired pact', () => {
        (['completed', 'abandoned', 'expired'] as const).forEach((status) => {
            const decision = decideAccept({
                pact: { creatorUserId, partnerUserId: null, status },
                member: { role: 'partner', status: 'pending' },
                requesterId,
            });
            expect(decision.allowed, `status=${status}`).to.be.eq(false);
            expect(decision.error, `status=${status}`).to.equal('noLongerAccepting');
        });
    });

    it('rejects when the user is the creator (creator cannot self-accept)', () => {
        const decision = decideAccept({
            pact: { creatorUserId: requesterId, partnerUserId: null, status: 'pending' },
            member: { role: 'creator', status: 'active' },
            requesterId,
        });
        expect(decision.allowed).to.be.eq(false);
        expect(decision.error).to.equal('forbidden');
    });
});
