/* eslint-disable quotes, max-len */
import { expect } from 'chai';

/**
 * Pacts handler — nudge eligibility + cooldown regression tests.
 *
 * `nudgePact` lets the creator re-ping partners who haven't responded to a
 * pending pact. Only the creator may nudge, only pending pacts qualify, there
 * must be at least one still-pending partner, and each partner is rate-limited
 * by a 7-day cooldown keyed on their `nudgedAt`.
 *
 * These tests mirror the decision tree from `src/handlers/pacts.ts` in pure
 * form so we can exercise it without standing up Express, Stores, or push
 * notifications — matching the style of `handlers-pacts-bulk.test.ts`.
 */

const NUDGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // keep in sync with handler

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

// Mirrors the per-partner cooldown gate: a partner is skipped only when it was
// nudged within the cooldown window. A null/undefined nudgedAt is always eligible.
const isPartnerNudgeable = (partner: INudgeMember, nowMs: number): boolean => {
    if (!partner.nudgedAt) {
        return true;
    }
    const nudgedMs = new Date(partner.nudgedAt).getTime();
    return nowMs - nudgedMs >= NUDGE_COOLDOWN_MS;
};

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
});
