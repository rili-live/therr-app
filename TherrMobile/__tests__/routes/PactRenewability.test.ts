import { it, describe, expect, beforeAll, afterAll } from '@jest/globals';
import { isPactRenewable, isPactSuperseded } from '../../main/routes/Habits/pactState';

/**
 * Pact renewal CTA gating.
 *
 * `isPactRenewable` decides whether the "re-commit for another N days" CTA is
 * drawn on a pact card and on the pact detail screen. It mirrors
 * `isPactRenewable` in users-service (`src/utilities/pactHelpers.ts`), which is
 * the authority — the server re-checks it and rejects a renewal it disagrees
 * with — so these cases are the same ones that helper's tests cover.
 *
 * The case worth guarding is `active` past `endDate`. The nightly digest sweep
 * is what flips a finished pact to `expired`, so between a pact ending and the
 * next sweep it still reads `active`. Gating on status alone would tell a user
 * who opens the app that morning that a visibly-finished pact is still running,
 * and hide the only CTA that screen exists to offer.
 */

const NOW = new Date('2026-08-26T12:00:00.000Z');

const pact = (status: string, endDate?: string | null): any => ({
    id: 'pact-1',
    status,
    endDate: endDate === undefined ? '2026-09-30T00:00:00.000Z' : endDate,
    durationDays: 30,
});

describe('isPactRenewable', () => {
    beforeAll(() => {
        jest.useFakeTimers().setSystemTime(NOW);
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    it('renews a finished cycle regardless of how it finished', () => {
        expect(isPactRenewable(pact('completed'))).toBe(true);
        expect(isPactRenewable(pact('expired'))).toBe(true);
    });

    it('renews an active pact whose endDate has passed but the sweep has not run', () => {
        expect(isPactRenewable(pact('active', '2026-08-25T00:00:00.000Z'))).toBe(true);
    });

    it('does not renew an active pact that is still running', () => {
        expect(isPactRenewable(pact('active', '2026-09-30T00:00:00.000Z'))).toBe(false);
    });

    it('treats an active pact with no endDate as still running', () => {
        // Matches shouldExpirePact server-side: an open-ended pact has no cycle
        // to have finished, so there is nothing to re-commit to.
        expect(isPactRenewable(pact('active', null))).toBe(false);
    });

    it('does not renew a pact that was walked away from or never started', () => {
        // Deliberate: someone who abandoned a pact should start a fresh one on
        // purpose, and a pending pact never had a cycle to finish.
        expect(isPactRenewable(pact('abandoned', '2026-08-25T00:00:00.000Z'))).toBe(false);
        expect(isPactRenewable(pact('pending', '2026-08-25T00:00:00.000Z'))).toBe(false);
    });

    it('is false rather than throwing on missing or malformed input', () => {
        // The CTA is drawn from list data that can arrive partial; a bad row
        // must hide the button, not take down the row it belongs to.
        expect(isPactRenewable(null)).toBe(false);
        expect(isPactRenewable(undefined)).toBe(false);
        expect(isPactRenewable({} as any)).toBe(false);
        expect(isPactRenewable(pact('active', 'not-a-date'))).toBe(false);
    });

    /**
     * The reported bug: each tap of "re-commit" added what looked like a duplicate pact.
     *
     * The CTA stayed live on a cycle that had already been continued, because
     * renewability was purely a question about *this* pact's dates and status — and a
     * renewal with partners is created `pending`, so nothing about the finished cycle
     * changed to switch its button off. Every tap therefore started another parallel
     * cycle. The server is idempotent about it now, but the button should not be there
     * to press in the first place.
     */
    it('does not offer to re-commit a cycle that has already been continued', () => {
        expect(isPactRenewable({
            ...pact('expired', '2026-08-25T00:00:00.000Z'),
            supersededByPactId: 'pact-2',
        })).toBe(false);
    });

    // An `abandoned` successor — which is what declining a 1:1 renewal produces — is not
    // reported in `supersededByPactId`, so the finished cycle stays re-committable. That
    // is the difference between a partner saying no and the habit being over.
    it('still offers a cycle whose only renewal was declined', () => {
        expect(isPactRenewable({
            ...pact('expired', '2026-08-25T00:00:00.000Z'),
            supersededByPactId: null,
        })).toBe(true);
    });
});

describe('isPactSuperseded', () => {
    it('is true only when a successor is actually named', () => {
        expect(isPactSuperseded({ supersededByPactId: 'pact-2' })).toBe(true);
        expect(isPactSuperseded({ supersededByPactId: null })).toBe(false);
        expect(isPactSuperseded({})).toBe(false);
        expect(isPactSuperseded(null)).toBe(false);
        expect(isPactSuperseded(undefined)).toBe(false);
    });
});
