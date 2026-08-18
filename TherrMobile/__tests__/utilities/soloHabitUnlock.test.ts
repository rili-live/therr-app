import { it, describe, expect } from '@jest/globals';
import { getSoloUnlockProgress } from '../../main/utilities/soloHabitUnlock';

/**
 * The solo-unlock progress model.
 *
 * Solo habits unlock after inviting a set number of distinct people. The whole
 * value of raising that number from one to three rests on the user being able
 * to see how close they are — so the states that decide whether a progress line
 * renders matter as much as the arithmetic. Getting `hasProgress` wrong shows
 * "0 of 0 friends invited", which reads as a broken promise and is worse than
 * saying nothing.
 */
const eligibility = (overrides: any = {}): any => ({
    canCreateSolo: false,
    invitedCount: 1,
    soloUnlockInviteCount: 3,
    activeHabitCount: 0,
    isAtHabitLimit: false,
    habitLimit: null,
    ...overrides,
});

describe('getSoloUnlockProgress', () => {
    it('reports how many invites are left', () => {
        const progress = getSoloUnlockProgress(eligibility(), true);

        expect(progress.isUnlocked).toBe(false);
        expect(progress.hasProgress).toBe(true);
        expect(progress.invitedCount).toBe(1);
        expect(progress.requiredCount).toBe(3);
        expect(progress.remaining).toBe(2);
    });

    it('reports unlocked when the server says so', () => {
        const progress = getSoloUnlockProgress(eligibility({ canCreateSolo: true, invitedCount: 3 }), true);

        expect(progress.isUnlocked).toBe(true);
        expect(progress.remaining).toBe(0);
    });

    it('treats unloaded eligibility as locked with nothing to show', () => {
        // The safe direction. Showing the affordance before the answer arrives
        // only walks the user into a 403 the server was always going to send.
        [null, undefined].forEach((value) => {
            const progress = getSoloUnlockProgress(value, true);

            expect(progress.isUnlocked).toBe(false);
            expect(progress.hasProgress).toBe(false);
        });
    });

    it('shows no progress line when the server sends no counts', () => {
        // An older server predating the threshold. Locked is still locked, but
        // promising an unlock without being able to say its price is worse than
        // staying quiet about it.
        const progress = getSoloUnlockProgress(eligibility({
            invitedCount: undefined,
            soloUnlockInviteCount: undefined,
        }), true);

        expect(progress.isUnlocked).toBe(false);
        expect(progress.hasProgress).toBe(false);
    });

    it('never reports negative remaining invites', () => {
        // A user past the threshold who is somehow still locked — a stale
        // eligibility payload, a server-side override — must not be told to
        // invite "-1 more friends".
        const progress = getSoloUnlockProgress(eligibility({ invitedCount: 5, soloUnlockInviteCount: 3 }), true);

        expect(progress.remaining).toBe(0);
    });

    it('ignores a nonsensical required count rather than dividing by it', () => {
        const progress = getSoloUnlockProgress(eligibility({ soloUnlockInviteCount: 0 }), true);

        expect(progress.hasProgress).toBe(false);
    });
});

describe('getSoloUnlockProgress with ENABLE_HABITS_SOLO off', () => {
    it('reports locked with nothing to render, however unlocked the server says the user is', () => {
        // The flag is the kill switch. Before it was consulted here it was
        // consulted nowhere, so turning it off disabled nothing at all.
        const progress = getSoloUnlockProgress(
            eligibility({ canCreateSolo: true, invitedCount: 3 }),
            false,
        );

        expect(progress.isUnlocked).toBe(false);
        expect(progress.hasProgress).toBe(false);
    });

    it('suppresses the progress numbers as well as the unlock', () => {
        // Both halves have to go together. A build with solo habits switched
        // off that still counted down "invite 2 more friends to unlock solo
        // habits" would be advertising a feature it has no way to deliver —
        // the failure mode that made a half-wired flag worse than none.
        const progress = getSoloUnlockProgress(eligibility({ invitedCount: 2 }), false);

        expect(progress.hasProgress).toBe(false);
        expect(progress.invitedCount).toBe(0);
        expect(progress.requiredCount).toBe(0);
        expect(progress.remaining).toBe(0);
    });
});
