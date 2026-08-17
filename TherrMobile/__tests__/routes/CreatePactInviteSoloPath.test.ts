import { it, describe, expect } from '@jest/globals';
import {
    canAdvanceFromPartnerStep,
    getBackTarget,
    getFinalAction,
    getNextStep,
    isSoloReview,
} from '../../main/routes/Pacts/wizardSteps';

/**
 * The create-habit wizard's partner step, locked and unlocked.
 *
 * Friends with Habits requires you to bring people with you before you can
 * track a habit alone — that mandatory invite is the growth loop. The wizard is
 * the only creation flow, so its partner step is where the requirement is
 * actually enforced on the client.
 *
 * The rule has two halves and both are easy to break:
 *   - Locked, the step must not advance without a partner. Letting it through
 *     walks the user to a review step whose submit button the server will 403.
 *   - Unlocked, it must advance with nobody selected, or the unlock the user
 *     earned by inviting three friends buys them nothing.
 */
describe('leaving the partner step', () => {
    it('always advances once a partner is chosen', () => {
        expect(canAdvanceFromPartnerStep(1, false)).toBe(true);
        expect(canAdvanceFromPartnerStep(1, true)).toBe(true);
    });

    it('blocks an empty selection while solo is locked', () => {
        // The growth loop. Without this the invite requirement is unenforced on
        // the client and the user only discovers it at the 403.
        expect(canAdvanceFromPartnerStep(0, false)).toBe(false);
    });

    it('allows an empty selection once solo is unlocked', () => {
        expect(canAdvanceFromPartnerStep(0, true)).toBe(true);
    });
});

describe('wizard step transitions', () => {
    const pact = { isSoloMode: false, canCreateSolo: false };
    const unlockedPact = { isSoloMode: false, canCreateSolo: true };
    const solo = { isSoloMode: true, canCreateSolo: true };
    const lockedSolo = { isSoloMode: true, canCreateSolo: false };

    it('walks 1 → 2 → 3 in the normal pact flow', () => {
        expect(getNextStep(1, pact)).toBe(2);
        expect(getNextStep(2, pact)).toBe(3);
    });

    it('skips the partner step for an unlocked solo entry', () => {
        expect(getNextStep(1, solo)).toBe(3);
    });

    it('ignores solo mode while still locked', () => {
        // Solo mode is a shortcut through a door the user already opened, never
        // a way around the lock. A stale deep link or an affordance rendered
        // before eligibility loaded must fall back to the partner step rather
        // than delivering them to a review they cannot submit.
        expect(getNextStep(1, lockedSolo)).toBe(2);
    });

    it('leaves the wizard when going back from the first step', () => {
        expect(getBackTarget(1, pact)).toBe('exit');
        expect(getBackTarget(1, solo)).toBe('exit');
    });

    it('steps back through the partner step in the pact flow', () => {
        expect(getBackTarget(3, pact)).toBe(2);
        expect(getBackTarget(3, unlockedPact)).toBe(2);
        expect(getBackTarget(2, pact)).toBe(1);
    });

    it('skips back over the partner step for an unlocked solo entry', () => {
        // Symmetry with the forward skip. Landing on step 2 going backwards
        // would strand the user on the picker they deliberately bypassed.
        expect(getBackTarget(3, solo)).toBe(1);
    });

    it('steps back into the partner step when solo mode was ignored', () => {
        // It was rendered on the way forward, so it must be there on the way
        // back — otherwise back-then-next silently loops.
        expect(getBackTarget(3, lockedSolo)).toBe(2);
    });
});

describe('wizard final action', () => {
    it('sends invites when partners were selected', () => {
        expect(getFinalAction(1)).toBe('send');
        expect(getFinalAction(5)).toBe('send');
    });

    it('starts a personal habit when nobody was selected', () => {
        // The label and the handler are chosen from this together — a
        // "Send invite" button that sends to nobody either no-ops or errors,
        // and both read to the user as a broken button.
        expect(getFinalAction(0)).toBe('startSolo');
    });

    it('treats the review as solo purely on the partner count', () => {
        // Deliberately not keyed on `isSoloMode`: a user who opened the partner
        // picker, selected someone, then changed their mind and deselected must
        // land in exactly the same place as one who never opened it.
        expect(isSoloReview(0)).toBe(true);
        expect(isSoloReview(1)).toBe(false);
    });
});
