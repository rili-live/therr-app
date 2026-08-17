import { it, describe, expect } from '@jest/globals';
import {
    getBackTarget,
    getFinalAction,
    getNextStep,
    isSoloReview,
} from '../../main/routes/Pacts/wizardSteps';

/**
 * The create-habit wizard's solo path.
 *
 * There was previously no way to create a habit without inviting someone. The
 * pact wizard is the only creation flow in the app; its step 2 refused to
 * advance without at least one partner selected; and the "track this on my own"
 * escape hatch was itself gated on having already sent a pact invite. Each
 * piece looked reasonable alone, and together they formed a closed loop with no
 * exit for a user who simply wanted to track something privately.
 *
 * These cases pin the two ways out — entering in solo mode, and walking through
 * the partner step without choosing anyone — and the fact that both end at the
 * same personal habit rather than at an invite send.
 */
describe('wizard step transitions', () => {
    const pact = { isSoloMode: false };
    const solo = { isSoloMode: true };

    it('walks 1 → 2 → 3 in the normal pact flow', () => {
        expect(getNextStep(1, pact)).toBe(2);
        expect(getNextStep(2, pact)).toBe(3);
    });

    it('skips the partner step entirely in solo mode', () => {
        // The whole point of the mode: a user who came from "track on my own"
        // should never be shown a partner picker at all.
        expect(getNextStep(1, solo)).toBe(3);
    });

    it('advances past the partner step with nobody selected', () => {
        // The regression this feature exists to prevent. Step 2 used to refuse
        // here, which — the wizard being the only creation flow — meant no
        // habit at all for anyone unwilling to involve a friend.
        expect(getNextStep(2, pact)).toBe(3);
    });

    it('leaves the wizard when going back from the first step', () => {
        expect(getBackTarget(1, pact)).toBe('exit');
        expect(getBackTarget(1, solo)).toBe('exit');
    });

    it('steps back through the partner step in the pact flow', () => {
        expect(getBackTarget(3, pact)).toBe(2);
        expect(getBackTarget(2, pact)).toBe(1);
    });

    it('skips back over the partner step in solo mode', () => {
        // Symmetry with the forward skip. Landing on step 2 going backwards
        // would strand the user on the picker they deliberately bypassed, with
        // no partner selected and no obvious way onward.
        expect(getBackTarget(3, solo)).toBe(1);
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
