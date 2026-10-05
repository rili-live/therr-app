import { it, describe, expect } from '@jest/globals';
import { getOnboardingTapAction } from '../../main/components/Habits/onboardingTapAction';

/**
 * In user testing, a first-time Friends with Habits user tapped each card on
 * the first-pact walkthrough, then each number in its stepper, got no response
 * from any of them and left. Every step now answers a tap; these pin what each
 * one does.
 */
describe('getOnboardingTapAction', () => {
    it('opens the wizard from step 1, the one step the user can do right now', () => {
        expect(getOnboardingTapAction(1, { hasOutgoingInvite: false })).toBe('openWizard');
        expect(getOnboardingTapAction(1, { hasOutgoingInvite: true })).toBe('openWizard');
    });

    it('explains the invite requirement on steps 2 and 3 before an invite is out', () => {
        expect(getOnboardingTapAction(2, { hasOutgoingInvite: false })).toBe('explainInviteGate');
        expect(getOnboardingTapAction(3, { hasOutgoingInvite: false })).toBe('explainInviteGate');
    });

    it('shows the sent invites from step 3 once one is waiting to be accepted', () => {
        expect(getOnboardingTapAction(3, { hasOutgoingInvite: true })).toBe('viewSentInvites');
    });

    it('never lets step 2 skip the invite', () => {
        expect(getOnboardingTapAction(2, { hasOutgoingInvite: true })).toBe('explainInviteGate');
    });
});
