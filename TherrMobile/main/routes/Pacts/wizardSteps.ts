/**
 * Step transitions for the create-habit wizard.
 *
 * Extracted from the route so the rules survive a refactor of the screen and
 * can be tested without the native module graph, the same reason
 * `routes/Habits/pactState.ts` lives apart from the dashboard.
 *
 * The rule that matters here is that the partner step is optional *only once
 * the user has unlocked solo habits* by inviting enough people. Before that,
 * choosing a partner is the only way forward — which is the app's growth loop
 * and is deliberate. What the unlock changes is that the requirement is finite
 * and visible: the wizard shows how many invites are left rather than simply
 * refusing to continue.
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

export interface IWizardContext {
    /**
     * Entered from a "track on my own" affordance, which skips partner
     * selection outright rather than merely allowing it to be skipped.
     */
    isSoloMode: boolean;
    /**
     * Whether the user has met the invite threshold. Server-driven; the client
     * only mirrors it, since `POST /habits/user-habits` enforces it regardless.
     */
    canCreateSolo: boolean;
}

/**
 * Solo mode is a shortcut through a door the user has already unlocked, never a
 * way around the lock. Entering it while still locked (a stale deep link, an
 * affordance rendered before eligibility loaded) falls back to the normal path
 * rather than delivering them to a review step they cannot submit.
 */
const isSoloShortcut = ({ isSoloMode, canCreateSolo }: IWizardContext): boolean => isSoloMode && canCreateSolo;

export const getNextStep = (
    step: WizardStep,
    context: IWizardContext,
): WizardStep => {
    if (step === 1) {
        return isSoloShortcut(context) ? 3 : 2;
    }

    return 3;
};

export const getBackTarget = (
    step: WizardStep,
    context: IWizardContext,
): WizardBackTarget => {
    if (step === 1) {
        return 'exit';
    }

    // Solo mode never rendered step 2, so walking back into it would strand the
    // user on a partner picker they deliberately bypassed.
    if (step === 3 && isSoloShortcut(context)) {
        return 1;
    }

    return (step - 1) as WizardStep;
};

/**
 * Whether the user may leave the partner step.
 *
 * Picking someone always works. Continuing with nobody is the solo path, so it
 * requires the unlock — this is the client half of the rule the server enforces
 * on create, and the reason a locked user still gets the "choose a friend"
 * prompt rather than a dead end at the review step.
 */
export const canAdvanceFromPartnerStep = (
    selectedPartnerCount: number,
    canCreateSolo: boolean,
): boolean => selectedPartnerCount > 0 || canCreateSolo;

/**
 * Whether the review step is reviewing a personal habit. Keyed on the partner
 * count rather than on `isSoloMode` so that clearing every partner on step 2
 * lands in the same place as entering solo mode did.
 */
export const isSoloReview = (selectedPartnerCount: number): boolean => selectedPartnerCount === 0;

export const getFinalAction = (
    selectedPartnerCount: number,
): WizardFinalAction => (isSoloReview(selectedPartnerCount) ? 'startSolo' : 'send');
