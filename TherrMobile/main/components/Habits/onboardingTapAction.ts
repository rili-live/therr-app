/**
 * What a tap on the first-pact walkthrough's stepper or cards does.
 *
 * Kept apart from `PactPreviewOverlay` so the rule can be tested without the
 * native module graph, the same reason `routes/Pacts/wizardSteps.ts` is.
 *
 * WHY THE CARDS RESPOND AT ALL
 *
 * The walkthrough shows a 1-2-3 stepper and three numbered cards above a single
 * "invite" button. In user testing, a first-time user tapped each card and then
 * each number, got nothing back from any of them, concluded the screen was
 * broken and left through the drawer. They were never told why it would not let
 * them continue. Numbered steps and cards read as controls, so this gives every
 * one of them an answer:
 *
 * - Step 1 (pick a habit) is something the user can actually do right now, and
 *   it is the wizard's own first step, so it opens the wizard. The invite step
 *   is still ahead of them there; nothing is skipped.
 * - Step 3, once an invite is out, is "waiting for them to accept", and the
 *   sent-invites list is where that waiting is visible.
 * - Anything else explains the gate: continuing requires inviting a friend.
 */
export type OnboardingStepNumber = 1 | 2 | 3;

export type OnboardingTapAction = 'openWizard' | 'viewSentInvites' | 'explainInviteGate';

export const getOnboardingTapAction = (
    step: OnboardingStepNumber,
    { hasOutgoingInvite }: { hasOutgoingInvite: boolean },
): OnboardingTapAction => {
    if (step === 1) {
        return 'openWizard';
    }

    if (step === 3 && hasOutgoingInvite) {
        return 'viewSentInvites';
    }

    return 'explainInviteGate';
};
