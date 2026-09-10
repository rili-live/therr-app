import { expect } from 'chai';
import {
    NUDGE_COOLDOWN_MS,
    classifyDispatchResult,
    flattenNudgeOutcomes,
    getCooldownOutcome,
} from '../../src/utilities/pactNudgeOutcome';

/**
 * Pacts handler — nudge eligibility + cooldown regression tests.
 *
 * `nudgePact` lets the creator re-ping partners who haven't responded to a
 * pending pact. Only the creator may nudge, only pending pacts qualify, there
 * must be at least one still-pending partner, and each partner is rate-limited
 * by a 7-day cooldown keyed on their `nudgedAt`.
 *
 * The authorization tree below is mirrored from `src/handlers/pacts.ts` in pure form so we
 * can exercise it without standing up Express, Stores, or push notifications — matching the
 * style of `handlers-pacts-bulk.test.ts`. Everything past that gate (the cooldown gate, the
 * dispatch classification and the result flattening) lives in `src/utilities/pactNudgeOutcome`
 * and is imported here directly, so these assertions cover the code that actually runs.
 */

interface INudgeMember {
    role: 'creator' | 'partner';
    status: 'pending' | 'active' | 'left';
    nudgedAt?: string | null;
}

type NudgeError = 'notFound' | 'forbidden' | 'notPending' | 'noPendingPartners';

const decideNudge = ({
    pact,
    members,
    requesterId,
}: {
    pact: { creatorUserId: string; status: string } | null;
    members: INudgeMember[];
    requesterId: string;
}): { allowed: boolean; error?: NudgeError } => {
    if (!pact) {
        return { allowed: false, error: 'notFound' };
    }
    if (pact.creatorUserId !== requesterId) {
        return { allowed: false, error: 'forbidden' };
    }
    if (pact.status !== 'pending') {
        return { allowed: false, error: 'notPending' };
    }
    const pendingPartners = members.filter((m) => m.role === 'partner' && m.status === 'pending');
    if (pendingPartners.length === 0) {
        return { allowed: false, error: 'noPendingPartners' };
    }
    return { allowed: true };
};

// The cooldown gate, expressed as the handler consumes it: an outcome means "skipped".
const isPartnerNudgeable = (partner: INudgeMember, nowMs: number): boolean => (
    getCooldownOutcome('partner-1', partner.nudgedAt, nowMs) === null
);

describe('Pacts handler — nudge authorization', () => {
    const creatorUserId = 'creator-1';
    const pendingPartner: INudgeMember = { role: 'partner', status: 'pending' };

    it('rejects a nudge on a pact that does not exist', () => {
        const decision = decideNudge({ pact: null, members: [], requesterId: creatorUserId });
        expect(decision.allowed).to.be.eq(false);
        expect(decision.error).to.equal('notFound');
    });

    it('rejects a nudge from anyone other than the creator', () => {
        const decision = decideNudge({
            pact: { creatorUserId, status: 'pending' },
            members: [pendingPartner],
            requesterId: 'partner-1',
        });
        expect(decision.allowed).to.be.eq(false);
        expect(decision.error).to.equal('forbidden');
    });

    it('rejects a nudge on a non-pending pact', () => {
        (['active', 'completed', 'abandoned', 'expired'] as const).forEach((status) => {
            const decision = decideNudge({
                pact: { creatorUserId, status },
                members: [pendingPartner],
                requesterId: creatorUserId,
            });
            expect(decision.allowed, `status=${status}`).to.be.eq(false);
            expect(decision.error, `status=${status}`).to.equal('notPending');
        });
    });

    it('rejects a nudge when no partner is still pending', () => {
        const decision = decideNudge({
            pact: { creatorUserId, status: 'pending' },
            members: [
                { role: 'creator', status: 'active' },
                { role: 'partner', status: 'active' },
                { role: 'partner', status: 'left' },
            ],
            requesterId: creatorUserId,
        });
        expect(decision.allowed).to.be.eq(false);
        expect(decision.error).to.equal('noPendingPartners');
    });

    it('allows the creator to nudge when at least one partner is pending', () => {
        const decision = decideNudge({
            pact: { creatorUserId, status: 'pending' },
            members: [{ role: 'creator', status: 'active' }, pendingPartner],
            requesterId: creatorUserId,
        });
        expect(decision.allowed).to.be.eq(true);
        expect(decision.error).to.be.eq(undefined);
    });
});

describe('Pacts handler — nudge cooldown gate', () => {
    const nowMs = new Date('2026-06-08T00:00:00.000Z').getTime();

    it('is nudgeable when the partner has never been nudged', () => {
        expect(isPartnerNudgeable({ role: 'partner', status: 'pending' }, nowMs)).to.be.eq(true);
        expect(isPartnerNudgeable({ role: 'partner', status: 'pending', nudgedAt: null }, nowMs)).to.be.eq(true);
    });

    it('is NOT nudgeable inside the 7-day cooldown window', () => {
        const sixDaysAgo = new Date(nowMs - (6 * 24 * 60 * 60 * 1000)).toISOString();
        expect(isPartnerNudgeable({ role: 'partner', status: 'pending', nudgedAt: sixDaysAgo }, nowMs)).to.be.eq(false);
    });

    it('is nudgeable again once the full cooldown has elapsed', () => {
        const exactlySevenDaysAgo = new Date(nowMs - NUDGE_COOLDOWN_MS).toISOString();
        const eightDaysAgo = new Date(nowMs - (8 * 24 * 60 * 60 * 1000)).toISOString();
        expect(isPartnerNudgeable({ role: 'partner', status: 'pending', nudgedAt: exactlySevenDaysAgo }, nowMs)).to.be.eq(true);
        expect(isPartnerNudgeable({ role: 'partner', status: 'pending', nudgedAt: eightDaysAgo }, nowMs)).to.be.eq(true);
    });

    it('reports nextNudgeAvailableAt exactly one cooldown after the last nudge', () => {
        const sixDaysAgoMs = nowMs - (6 * 24 * 60 * 60 * 1000);
        const sixDaysAgo = new Date(sixDaysAgoMs).toISOString();
        const outcome = getCooldownOutcome('partner-1', sixDaysAgo, nowMs);
        expect(outcome).to.not.be.eq(null);
        expect(outcome?.nudged).to.be.eq(false);
        expect(outcome?.reason).to.equal('cooldown');
        expect(outcome?.nextNudgeAvailableAt).to.equal(new Date(sixDaysAgoMs + NUDGE_COOLDOWN_MS).toISOString());
    });

    // A NaN comparison is false, so an unparseable timestamp would otherwise fall through the
    // cooldown check as "eligible" — but with `nextNudgeAvailableAt: "Invalid Date"` attached
    // had it been built anyway. Treat it as eligible, with no outcome payload.
    it('treats an unparseable nudgedAt as eligible rather than emitting an invalid date', () => {
        expect(getCooldownOutcome('partner-1', 'not-a-date' as any, nowMs)).to.be.eq(null);
    });
});

describe('Pacts handler — nudge dispatch classification', () => {
    it('counts an on-brand partner as nudged (the brand push is sent next)', () => {
        expect(classifyDispatchResult('p1', { isOnBrand: true }))
            .to.deep.equal({ partnerId: 'p1', nudged: true });
    });

    it('counts an off-brand invite that actually went out as nudged', () => {
        expect(classifyDispatchResult('p1', { isOnBrand: false, invitedVia: 'email' }))
            .to.deep.equal({ partnerId: 'p1', nudged: true });
    });

    // The regression this exists for: `dispatchPactInvitation` returns a bare
    // `{ isOnBrand: false }` both for a real off-brand send and for a partner it could not
    // reach at all. Reading only `isOnBrand` reported "Nudge sent!" for the unreachable case
    // and started the 7-day cooldown on a nudge that never left the building.
    it('does NOT count an undeliverable partner as nudged', () => {
        expect(classifyDispatchResult('p1', { isOnBrand: false, undeliverableReason: 'noContactMethod' }))
            .to.deep.equal({ partnerId: 'p1', nudged: false, reason: 'undeliverable' });
        expect(classifyDispatchResult('p1', { isOnBrand: false, undeliverableReason: 'partnerNotFound' }))
            .to.deep.equal({ partnerId: 'p1', nudged: false, reason: 'undeliverable' });
        expect(classifyDispatchResult('p1', { isOnBrand: false }))
            .to.deep.equal({ partnerId: 'p1', nudged: false, reason: 'undeliverable' });
    });

    // A dispatch that threw is reported as null by the handler's catch. It used to be
    // swallowed into `{ isOnBrand: true }`, which claimed success for a failed send.
    it('reports a thrown dispatch as an error, not a success', () => {
        expect(classifyDispatchResult('p1', null))
            .to.deep.equal({ partnerId: 'p1', nudged: false, reason: 'error' });
        expect(classifyDispatchResult('p1', undefined))
            .to.deep.equal({ partnerId: 'p1', nudged: false, reason: 'error' });
    });
});

describe('Pacts handler — nudge result flattening', () => {
    it('keeps a per-partner entry for a rejected dispatch instead of dropping it', () => {
        const partnerIds = ['p1', 'p2'];
        const settled: any[] = [
            { status: 'fulfilled', value: { partnerId: 'p1', nudged: true } },
            { status: 'rejected', reason: new Error('boom') },
        ];
        const results = flattenNudgeOutcomes(settled, partnerIds);
        expect(results).to.have.length(2);
        expect(results[0]).to.deep.equal({ partnerId: 'p1', nudged: true });
        expect(results[1]).to.deep.equal({ partnerId: 'p2', nudged: false, reason: 'error' });
    });
});
