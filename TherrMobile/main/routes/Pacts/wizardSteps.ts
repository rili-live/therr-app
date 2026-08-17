/**
 * Step transitions for the create-habit wizard.
 *
 * Extracted from the route so the rules survive a refactor of the screen and
 * can be tested without the native module graph, the same reason
 * `routes/Habits/pactState.ts` lives apart from the dashboard.
 *
 * The rule that matters here is that the partner step is optional. It used to
 * be mandatory, and since this wizard is the only way to create a habit, that
 * made "invite a friend" a precondition for tracking anything at all — a user
 * who did not want a partner had no way through. Both exits below (skipping
 * step 2, or passing through it having chosen nobody) end at the same personal
 * habit.
 */

export type WizardStep = 1 | 2 | 3;

/** `exit` means leave the wizard entirely rather than move to another step. */
export type WizardBackTarget = WizardStep | 'exit';

/**
 * What the final button does. A wizard with nobody selected must not offer to
 * send invites — the button would either send none or fail, and both read as
 * broken.
 */
export type WizardFinalAction = 'send' | 'startSolo';

interface IWizardContext {
    /**
     * Entered from a "track on my own" affordance, which skips partner
     * selection outright rather than merely allowing it to be skipped.
     */
    isSoloMode: boolean;
}

export const getNextStep = (
    step: WizardStep,
    { isSoloMode }: IWizardContext,
): WizardStep => {
    if (step === 1) {
        return isSoloMode ? 3 : 2;
    }

    return 3;
};

export const getBackTarget = (
    step: WizardStep,
    { isSoloMode }: IWizardContext,
): WizardBackTarget => {
    if (step === 1) {
        return 'exit';
    }

    // Solo mode never rendered step 2, so walking back into it would strand the
    // user on a partner picker they deliberately bypassed.
    if (step === 3 && isSoloMode) {
        return 1;
    }

    return (step - 1) as WizardStep;
};

/**
 * Whether the review step is reviewing a personal habit. Keyed on the partner
 * count rather than on `isSoloMode` so that clearing every partner on step 2
 * lands in the same place as entering solo mode did.
 */
export const isSoloReview = (selectedPartnerCount: number): boolean => selectedPartnerCount === 0;

export const getFinalAction = (
    selectedPartnerCount: number,
): WizardFinalAction => (isSoloReview(selectedPartnerCount) ? 'startSolo' : 'send');
